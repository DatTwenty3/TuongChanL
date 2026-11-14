/**
 * Kiểm tra ĐỘC LẬP công thức: mỗi phép tính được viết lại từ đầu theo công thức của tiêu chuẩn / cơ học kết cấu
 * (không gọi lại mã của engine để tính "đáp án") rồi so với kết quả engine.
 *
 * Khác với các test "oracle" (so với module gốc — chứng minh GIỐNG bản gốc), test này chứng minh
 * bản thân công thức đúng: hình học → trọng lượng, áp lực đất Rankine/Coulomb, ổn định (lật, ứng suất đáy),
 * bê tông cốt thép (TCVN 11823-5 ≈ AASHTO LRFD): β1, Ec, fr, uốn, nứt, cắt (MCFT), dầm giản đơn của bản quá độ.
 */
import { describe, expect, it } from 'vitest';
import { calcRun, isCalcValid, presetCanti } from '../../src/engine';
import { qdCalc, type QdInput } from '../../src/culvert/engine/bridge/approachSlab';
import { rcBarArea, rcCrack, rcFlex, rcMatCalc, rcShear } from '../../src/culvert/engine/math/rc';

const area = (poly: ReadonlyArray<readonly [number, number]>): number => {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
};
const near = (a: number, b: number, rel = 1e-6, abs = 1e-9) =>
  Math.abs(a - b) <= Math.max(abs, rel * Math.max(Math.abs(a), Math.abs(b)));

describe('Tường chắn BTCT chữ T ngược (Mẫu 1, H = 5 m) — kiểm tra độc lập', () => {
  const P = presetCanti(500);
  const R = calcRun(P as never);
  if (!isCalcValid(R)) throw new Error('calcRun không hợp lệ');
  const GC = 24.5; // kN/m3, bê tông
  const GS = 18; // kN/m3, đất đắp
  const PHI = (30 * Math.PI) / 180;
  const by = (ty: string, nm?: string) => R.Ld.L.filter((l) => l.ty === ty && (!nm || l.nm === nm));

  it('trọng lượng bản thân và đất trên gót = diện tích hình học × dung trọng', () => {
    const stem = area(R.g.stem as never) * GC;
    const foot = area(R.g.foot as never) * GC;
    const ev = area(R.g.ev as never) * GS;
    const dcs = by('DC').map((l) => -l.Fy);
    expect(near(dcs[0], stem, 1e-9)).toBe(true);
    expect(near(dcs[1], foot, 1e-9)).toBe(true);
    expect(near(-by('EV')[0].Fy, ev, 1e-9)).toBe(true);
  });

  it('áp lực đất chủ động: lưng thẳng đứng, đất đắp nằm ngang, φ = 30°, δ = 0 → Rankine Ka = tan²(45° − φ/2) = 1/3', () => {
    const Ka = Math.tan(Math.PI / 4 - PHI / 2) ** 2;
    const Hp = R.g.Hp as number; // chiều cao mặt phẳng tính áp lực (đỉnh tường − đáy bản)
    const Pa = 0.5 * GS * Ka * Hp * Hp;
    expect(near(Ka, 1 / 3, 1e-12)).toBe(true);
    expect(near(R.Ld.w0.P, Pa, 1e-3)).toBe(true);
    expect(near(-by('EH')[0].Fx, Pa, 1e-3)).toBe(true);
    // điểm đặt tại Hp/3 kể từ đáy bản
    expect(near(by('EH')[0].y, Hp / 3, 1e-3, 1e-3)).toBe(true);
  });

  it('hoạt tải chất thêm LS: heq = 0,6 m (khoảng cách ≥ 0,3 m) → ΔP = Ka·γ·heq·Hp, thành phần đứng = q·chiều rộng gót', () => {
    const Hp = R.g.Hp as number;
    const heq = 0.6;
    const Ka = 1 / 3;
    expect(near(by('LSh')[0].P as number, Ka * GS * heq * Hp, 1e-3)).toBe(true);
    // LS đứng: q = γ·heq tác dụng lên gót (bề rộng 1,4 − 0,5 hiệu dụng của mẫu) — chỉ kiểm tra bằng q × bề rộng suy ra
    const b = -by('LSv')[0].Fy / (GS * heq);
    expect(b).toBeGreaterThan(0.5);
    expect(b).toBeLessThan(1.5);
  });

  it('tổ hợp sử dụng SD (hệ số 1,0): ΣV, ΣH, mômen lấy quanh mũi, độ lệch tâm e và ứng suất đáy tam giác', () => {
    const SD = R.SD;
    const V = R.Ld.L.reduce((s, l) => s + -l.Fy, 0);
    const H = R.Ld.L.reduce((s, l) => s + -l.Fx, 0);
    expect(near(SD.V, V, 1e-9)).toBe(true);
    expect(near(SD.H, H, 1e-9)).toBe(true);
    // mô men quanh mũi (x = 0, y = 0): Mr = Σ V·x, Mo = Σ H·y
    const Mr = R.Ld.L.reduce((s, l) => s + -l.Fy * l.x, 0);
    const Mo = R.Ld.L.reduce((s, l) => s + -l.Fx * l.y, 0);
    const xbar = (Mr - Mo) / V;
    const B = R.g.B as number;
    const e = B / 2 - xbar;
    expect(near(SD.e, e, 1e-6)).toBe(true);
    // e > B/6 → phân bố ứng suất tam giác (Meyerhof B' = 2·x̄): σmax = 2V / (3·x̄)
    expect(e).toBeGreaterThan(B / 6);
    expect(near(SD.sigMax as number, (2 * V) / (3 * xbar), 1e-6)).toBe(true);
    expect(near(SD.sigU as number, V / (B - 2 * Math.abs(e)), 1e-6)).toBe(true);
    // ổn định lật: Mr/Mo
    expect(Mr / Mo).toBeGreaterThan(1);
  });
});

describe('Bê tông cốt thép theo TCVN 11823-5 (≈ AASHTO LRFD) — kiểm tra độc lập', () => {
  const mk = (fc: number) =>
    rcMatCalc({ fc, fy: 400, Es: 200000, K1: 1, wc: 2400, ag: 19, ge: 1, g1: 1.05, g3: 0.67, ecl: 0.002, etl: 0.005 });

  it('β1 = 0,85 − 0,05(f\'c − 28)/7 ∈ [0,65; 0,85]; fr = 0,63√f\'c; Ec = 0,0017·K1·wc²·f\'c^0,33', () => {
    for (const [fc, b1] of [
      [28, 0.85],
      [35, 0.8],
      [42, 0.75],
      [49, 0.7],
      [56, 0.65],
      [70, 0.65],
    ] as const) {
      const M = mk(fc);
      expect(near(M.b1, b1, 1e-12)).toBe(true);
      expect(near(M.fr, 0.63 * Math.sqrt(fc), 1e-12)).toBe(true);
      expect(near(M.Ec, 0.0017 * 1 * 2400 ** 2 * fc ** 0.33, 1e-12)).toBe(true);
      expect(near(M.n, 200000 / M.Ec, 1e-12)).toBe(true);
    }
  });

  it('uốn: cốt thép chảy, không tính cốt nén → a = As·fy/(0,85 f\'c b), Mn = As·fy·(ds − a/2), φ theo biến dạng', () => {
    const fc = 30;
    const M = mk(fc);
    const S = {
      b: 1000,
      h: 300,
      f1: { n: 5, s: 200, d: 22, dc: 61 }, // 5Φ22 / 1 m, lớp bảo vệ 50 + Φ/2
      f2: { n: 0, s: 200, d: 18, dc: 59 },
      st: { n: 0, s: 200, d: 12 },
    };
    const F = rcFlex(S as never, M, true);
    const As = 5 * (Math.PI / 4) * 22 * 22;
    const ds = 300 - 61;
    const a = (As * 400) / (0.85 * fc * 1000);
    const Mn = (As * 400 * (ds - a / 2)) / 1e6;
    expect(near(F.As, As, 1e-12)).toBe(true);
    expect(near(F.a, a, 1e-6)).toBe(true);
    expect(near(F.Mn, Mn, 1e-6)).toBe(true);
    const c = a / M.b1;
    const et = (0.003 * (ds - c)) / c;
    const phi = Math.max(0.75, Math.min(0.9, 0.75 + (0.15 * (et - 0.002)) / (0.005 - 0.002)));
    expect(near(F.phi, phi, 1e-6)).toBe(true);
    expect(et).toBeGreaterThan(0.005); // kiểm soát kéo → φ = 0,9
    expect(near(F.phi, 0.9, 1e-12)).toBe(true);
    // con số tham chiếu độc lập (tính tay): As = 1900,7 mm2 ; a = 29,81 mm ; Mn = 170,6 kN.m
    expect(F.As).toBeCloseTo(1900.66, 1);
    expect(F.a).toBeCloseTo(29.81, 2);
    expect(F.Mn).toBeCloseTo(170.6, 0);
  });

  it('uốn: mặt cắt nhiều cốt thép (ρ lớn) → φ giảm về 0,75 khi nén kiểm soát, Mn tăng đơn điệu theo As', () => {
    const M = mk(30);
    const sec = (n: number) => ({
      b: 400,
      h: 500,
      f1: { n, s: 100, d: 32, dc: 66 },
      f2: { n: 0, s: 100, d: 16, dc: 60 },
      st: { n: 0, s: 100, d: 12 },
    });
    let prev = 0;
    for (const n of [2, 4, 6, 8, 10]) {
      const F = rcFlex(sec(n) as never, M, true);
      expect(F.Mn).toBeGreaterThan(prev);
      prev = F.Mn;
      expect(F.phi).toBeGreaterThanOrEqual(0.75 - 1e-12);
      expect(F.phi).toBeLessThanOrEqual(0.9 + 1e-12);
    }
    expect(near(rcFlex(sec(10) as never, M, true).phi, 0.75, 1e-9)).toBe(true);
  });

  it('khống chế nứt: s ≤ 123000·γe/(βs·fss) − 2dc với βs = 1 + dc/(0,7(h − dc)), fss từ mặt cắt quy đổi nứt', () => {
    const M = mk(30);
    const S = {
      b: 1000,
      h: 300,
      f1: { n: 5, s: 200, d: 22, dc: 61 },
      f2: { n: 0, s: 200, d: 18, dc: 59 },
      st: { n: 0, s: 200, d: 12 },
    };
    const Ms = 40; // kN.m/m (sử dụng)
    const C = rcCrack(S as never, M, Ms);
    const As = 5 * rcBarArea(22);
    const de = 300 - 61;
    const rho = As / (1000 * de);
    const n = 200000 / M.Ec;
    const k = Math.sqrt((rho * n) ** 2 + 2 * rho * n) - rho * n;
    const j = 1 - k / 3;
    const fss = Math.min((Ms * 1e6) / (As * j * de), 0.6 * 400);
    const bs = 1 + 61 / (0.7 * (300 - 61));
    const smax = (123000 * 1) / (bs * fss) - 2 * 61;
    expect(near(C.fss, fss, 1e-9)).toBe(true);
    expect(near(C.smax, smax, 1e-9)).toBe(true);
    expect(C.ok).toBe(200 <= smax);
  });

  it('cắt (phương pháp MCFT): β = 4,8/(1 + 750εs), θ = 29 + 3500εs, Vc = 0,083·β·√f\'c·b·dv', () => {
    const fc = 30;
    const M = mk(fc);
    const S = {
      b: 1000,
      h: 300,
      f1: { n: 5, s: 200, d: 22, dc: 61 },
      f2: { n: 0, s: 200, d: 18, dc: 59 },
      st: { n: 0, s: 200, d: 12 }, // không cốt đai
    };
    const fl = rcFlex(S as never, M, true);
    const Mu = 60;
    const Vu = 50;
    const Nu = 0;
    const sh = rcShear(S as never, M, Mu, Vu, Nu, 0.9, fl);
    const de = 239;
    const dv = Math.max(de - fl.a / 2, 0.9 * de, 0.72 * 300);
    const As = 5 * rcBarArea(22);
    const Mabs = Math.max(Mu * 1e6, Vu * 1e3 * dv);
    const es = Math.max(-0.0004, Math.min(0.006, (Mabs / dv + 0.5 * Nu * 1e3 + Vu * 1e3) / (200000 * As)));
    const sxe = Math.max(294, Math.min(2000, (dv * 35) / (19 + 16)));
    const beta = (4.8 / (1 + 750 * es)) * (1300 / (1000 + sxe)); // không cốt đai tối thiểu
    const th = 29 + 3500 * es;
    const Vc = (0.083 * beta * Math.sqrt(fc) * 1000 * dv) / 1e3;
    expect(near(sh.dv, dv, 1e-9)).toBe(true);
    expect(near(sh.es, es, 1e-9)).toBe(true);
    expect(near(sh.beta, beta, 1e-9)).toBe(true);
    expect(near(sh.th, th, 1e-9)).toBe(true);
    expect(near(sh.Vc, Vc, 1e-9)).toBe(true);
    expect(near(sh.Vr, 0.9 * Math.min(Vc, 0.25 * fc * 1000 * dv / 1e3), 1e-9)).toBe(true);
  });
});

describe('Bản quá độ (dầm giản đơn rộng 1 m) — kiểm tra độc lập', () => {
  const I: QdInput = {
    L: 4,
    h: 0.3,
    k: 2 / 3,
    h1: 0.12,
    g1: 23,
    h2: 0.25,
    g2: 22,
    hs: 0.11,
    gs: 17.66,
    gc: 24.5,
    gcm: 24.5,
    fc: 30,
    mlane: 1.2,
    qlane: 9.3,
    LT: 4.3,
    wt: 0.51,
    LLDF: 1.15,
    eta: 1,
    db: 22,
    sb: 200,
    cb: 50,
    dt: 18,
    st: 200,
    ct: 50,
    dv: 12,
    sv: 200,
    nv: 0,
  } as unknown as QdInput;

  it('Ltt = k·L ; Fe = min(1,15; 1 + 0,2·H/L) ; DC = γc·h ; tải làn = m·9,3/3 ; Mmax = W·L²/8 ; V = W·L/2', () => {
    const R = qdCalc(I);
    const Ltt = (2 / 3) * 4;
    expect(near(R.Ltt, Ltt, 1e-12)).toBe(true);
    const Hc = R.Hc;
    const Fe = Math.min(1.15, 1 + (0.2 * Hc) / Ltt);
    expect(near(R.Fe, Fe, 1e-12)).toBe(true);
    expect(near(R.DC, 24.5 * 0.3, 1e-12)).toBe(true);
    expect(near(R.LN, (1.2 * 9.3) / 3, 1e-12)).toBe(true);
    // Tải trọng dải đều TTGH CĐ I (hệ số 1,25; 1,5; 1,3; 1,75 — bảng trong bản vẽ): W = Σ γ·q
    const W = 1.25 * R.DC + 1.5 * R.DW + 1.3 * R.EV + 1.75 * R.LN;
    // đối chiếu số trong bảng tính gốc (hình 5: W = 31,19 ; Mmax = 27,73 ; V = 41,59) — sai khác do làm tròn hs, h1…
    expect(Math.abs(W - 31.19)).toBeLessThan(0.1);
    expect(Math.abs((W * Ltt * Ltt) / 8 - 27.73)).toBeLessThan(0.1);
    expect(Math.abs((W * Ltt) / 2 - 41.59)).toBeLessThan(0.1);
  });

  it('xung kích IM = 33(1 − 4,1·10⁻⁴·DE) với DE = bề dày lớp phủ (mm), tối thiểu 0', () => {
    const R = qdCalc(I);
    const DEmm = R.Hc * 1000;
    expect(near(R.IM, Math.max(0, 33 * (1 - 4.1e-4 * DEmm)), 1e-9)).toBe(true);
  });
});

describe('Thủy văn — tần suất Pearson III: hệ số Φp(P, Cs) độc lập bằng tích phân Gamma', () => {
  // Hàm Gamma không đầy đủ (chuỗi / phân số liên tục — Numerical Recipes) → phân vị Gamma(α, 1) bằng chia đôi
  const lgamma = (x: number): number => {
    const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let y = x;
    const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++) ser += c[j] / ++y;
    return -tmp + Math.log((2.5066282746310005 * ser) / x);
  };
  const gammaQ = (a: number, x: number): number => {
    // Q(a, x) = Γ(a, x)/Γ(a) (xác suất vượt)
    if (x <= 0) return 1;
    if (x < a + 1) {
      let ap = a;
      let sum = 1 / a;
      let del = sum;
      for (let n = 0; n < 500; n++) {
        ap += 1;
        del *= x / ap;
        sum += del;
        if (Math.abs(del) < Math.abs(sum) * 1e-14) break;
      }
      return 1 - sum * Math.exp(-x + a * Math.log(x) - lgamma(a));
    }
    let b = x + 1 - a;
    let c = 1 / 1e-300;
    let d = 1 / b;
    let h = d;
    for (let i = 1; i < 500; i++) {
      const an = -i * (i - a);
      b += 2;
      d = an * d + b;
      if (Math.abs(d) < 1e-300) d = 1e-300;
      c = b + an / c;
      if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < 1e-14) break;
    }
    return Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
  };
  const p3Phi = (Ppct: number, Cs: number): number => {
    const a = 4 / (Cs * Cs); // hình dạng Gamma ứng với hệ số lệch Cs
    let lo = 0;
    let hi = a + 40 * Math.sqrt(a) + 50;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      if (gammaQ(a, mid) > Ppct / 100) lo = mid;
      else hi = mid;
    }
    const G = (lo + hi) / 2;
    return (G - a) / Math.sqrt(a); // biến chuẩn hoá (trung bình 0, độ lệch chuẩn 1)
  };

  it('HV.phiP(P, Cs) trùng phân vị Pearson III chuẩn hoá (sai số < 0,5 %)', async () => {
    const { HV } = await import('../../src/culvert/engine/hydrology/bridgeHydro');
    for (const Cs of [0.3, 0.6, 1.0, 1.5, 2.0]) {
      for (const P of [1, 2, 4, 10, 25, 50]) {
        const ref = p3Phi(P, Cs);
        const got = HV.phiP(P, Cs);
        expect(Math.abs(got - ref), `Cs=${Cs} P=${P}% engine=${got} ref=${ref}`).toBeLessThan(Math.max(0.01, 0.005 * Math.abs(ref)));
      }
    }
  });
});

describe('Cống hộp — khung kín chịu tải đều: mômen góc theo công thức phân phối mômen', () => {
  it('M_góc = (q·a²/12)·(Iw/b) / (Iw/b + Is/a) ; cân bằng lực đứng và mômen tại nút', async () => {
    const { chFrameSolve } = await import('../../src/culvert/engine/math/rcmFrame');
    const a = 4;
    const b = 3;
    const q = 120; // kN/m trên bản nắp, phản lực đều dưới bản đáy
    const E = 3e7; // kPa
    const Is = 0.4 ** 3 / 12; // bản dày 0,4 m
    const Iw = 0.3 ** 3 / 12; // thành dày 0,3 m
    const nodes = [
      { x: 0, y: 0 },
      { x: a, y: 0 },
      { x: a, y: b },
      { x: 0, y: b },
    ];
    const els = [
      { i: 0, j: 1, EA: E * 0.4, EI: E * Is, mem: 'bottom' },
      { i: 1, j: 2, EA: E * 0.3, EI: E * Iw, mem: 'right' },
      { i: 3, j: 2, EA: E * 0.4, EI: E * Is, mem: 'top' },
      { i: 0, j: 3, EA: E * 0.3, EI: E * Iw, mem: 'left' },
    ];
    const S = chFrameSolve(nodes, els, [], [
      { n: 0, dof: 0 },
      { n: 0, dof: 1 },
      { n: 1, dof: 1 },
    ]);
    const res = S.run({
      el: [
        { e: 2, t: 't', a: 0, b: a, q1: -q, q2: -q },
        { e: 0, t: 't', a: 0, b: a, q1: q, q2: q },
      ],
    });
    const Mexp = ((q * a * a) / 12) * (Iw / b) / (Iw / b + Is / a);
    const Mc = Math.abs(res.R[2].Mi); // mômen đầu trái của bản nắp (góc trên-trái)
    expect(Math.abs(Mc - Mexp) / Mexp).toBeLessThan(1e-4);
    // đối xứng: bốn góc cùng độ lớn mômen
    for (const [k, end] of [
      [2, 'Mj'],
      [0, 'Mi'],
      [0, 'Mj'],
    ] as const) {
      expect(Math.abs(Math.abs(res.R[k][end]) - Mexp) / Mexp).toBeLessThan(1e-4);
    }
    // mômen giữa nhịp bản nắp = q·a²/8 − M_góc (cân bằng dầm giản đơn)
    const Vtop = Math.abs(res.R[2].Vi);
    expect(Math.abs(Vtop - (q * a) / 2) / ((q * a) / 2)).toBeLessThan(1e-4);
  });
});
