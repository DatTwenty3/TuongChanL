import type {
  DrainInput,
  DrainResult,
  JointInput,
  JointResult,
  RigidInput,
  RigidResult,
  RigidTrafficInputs,
} from './types';
import { fmt } from './format';

/**
 * Kiểm toán kết cấu mặt đường cứng BTXM theo TCCS 39:2022/TCĐBVN (Phụ lục B).
 */
export function calcRigid(I: RigidInput): RigidResult {
  const { model, caly, hc, L, fr, Ec, muc, ac, Tg, Ps, Pmax, Ne, kr, kc, gr, E0, Eb, hb, mub, fbr } = I;
  const activeLayers = I.layers.filter((l) => l.h > 0);
  const s2 = activeLayers.reduce((s, l) => s + l.h * l.h, 0);
  const s2E = activeLayers.reduce((s, l) => s + l.h * l.h * l.E, 0);
  const Ex = s2 > 0 ? s2E / s2 : 0;
  const hx = activeLayers.reduce((s, l) => s + l.h, 0);
  const alpha = hx > 0 ? 0.86 + 0.26 * Math.log(hx) : 0;
  const Et = hx > 0 ? Math.pow(Ex / E0, alpha) * E0 : E0;
  const Dc = (Ec * Math.pow(hc, 3)) / (12 * (1 - muc * muc));
  const Db = Eb > 0 ? (Eb * Math.pow(hb, 3)) / (12 * (1 - mub * mub)) : 0;
  const r = 1.21 * Math.pow(Dc / Et, 1 / 3);
  const rg = 1.21 * Math.pow((Dc + Db) / Et, 1 / 3);
  const R = model === 1 ? r : rg;
  const kf = Math.pow(Ne, 0.057);
  const f1 = (P: number) => 1.47e-3 * Math.pow(r, 0.7) * Math.pow(hc, -2) * Math.pow(P, 0.94);
  const f2 = (P: number) => (1.45e-3 / (1 + Db / Dc)) * Math.pow(rg, 0.65) * Math.pow(hc, -2) * Math.pow(P, 0.94);
  const sps1 = f1(Ps);
  const spm1 = f1(Pmax);
  const sps2 = f2(Ps);
  const spm2 = f2(Pmax);
  const sps = model === 1 ? sps1 : sps2;
  const spm = model === 1 ? spm1 : spm2;
  const spr = kr * kf * kc * sps;
  const spmax = kr * kc * spm;
  const t = L / (3 * R);
  const sh = Math.sinh(t);
  const ch = Math.cosh(t);
  const co = Math.cos(t);
  const si = Math.sin(t);
  const CL1 = 1 - (sh * co + ch * si) / (co * si + sh * ch);
  const kn = Eb <= 0 ? 3000 : caly === 1 ? 3000 : 0.5 * Math.pow(hc / Ec + hb / Eb, -1);
  const rb = Db > 0 ? Math.pow((Dc * Db) / ((Dc + Db) * kn), 0.25) : 0;
  const zeta =
    Db > 0
      ? -((kn * Math.pow(rg, 4) - Dc) * Math.pow(rb, 3)) / ((kn * Math.pow(rb, 4) - Dc) * Math.pow(rg, 3))
      : 0;
  const CL2 = 1 - (1 / (1 + zeta)) * ((sh * co + ch * si) / (co * si + sh * ch));
  const CL = model === 1 ? CL1 : CL2;
  const BL = 1.77 * Math.exp(-4.48 * hc) * CL - 0.131 * (1 - CL);
  const stmax = ((ac * hc * Ec * Tg) / 2) * BL;
  const kt1 = (fr / stmax) * (0.841 * Math.pow(stmax / fr, 1.323) - 0.058);
  const kt2 = (fr / stmax) * (0.871 * Math.pow(stmax / fr, 1.287) - 0.071);
  const kt = Math.max(kt1, kt2);
  const str = kt * stmax;
  const sbps = Db > 0 ? (1.41e-3 / (1 + Dc / Db)) * Math.pow(rg, 0.68) * Math.pow(hb, -2) * Math.pow(Ps, 0.94) : 0;
  const sbpr = Db > 0 ? Math.pow(Ne, 0.065) * kc * sbps : 0;
  const c1 = gr * (spr + str);
  const c2 = gr * (spmax + stmax);
  const c3 = gr * sbpr;
  const app3 = !(model === 1 || Db === 0 || fbr === 0);
  return {
    Ex,
    hx,
    alpha,
    Et,
    Dc,
    Db,
    r,
    rg,
    R,
    kf,
    sps1,
    spm1,
    sps2,
    spm2,
    sps,
    spm,
    spr,
    spmax,
    t,
    CL1,
    CL2,
    kn,
    rb,
    zeta,
    CL,
    BL,
    stmax,
    kt1,
    kt2,
    kt,
    str,
    sbps,
    sbpr,
    c1,
    c2,
    c3,
    app3,
    p1: c1 <= fr,
    p2: c2 <= fr,
    p3: app3 ? c3 <= fbr : true,
  };
}

export interface NeSummary {
  adttlan: number;
  sum: number;
  Ns1: number;
  Ne: number;
  ptot: number;
}

export function computeNe(tr: RigidTrafficInputs, PsInput: number): NeSummary {
  const Ps = PsInput || 100;
  const adttlan = tr.adtt * tr.fhuong * tr.flan;
  const grw = tr.grow / 100;
  let sum = 0;
  let ptot = 0;
  for (const s of tr.spec) {
    sum += Math.pow(s.P / Ps, 16) * (s.p / 100);
    ptot += s.p;
  }
  const Ns1 = adttlan * (tr.naxle / 3000) * sum;
  const Ne = grw > 0 ? Ns1 * 365 * ((Math.pow(1 + grw, tr.tyear) - 1) / grw) * tr.eta : Ns1 * 365 * tr.tyear * tr.eta;
  return { adttlan, sum, Ns1, Ne, ptot };
}

export function findMinHc(I: RigidInput): { hc: number; result: RigidResult } | null {
  for (let h = 0.15; h <= 0.421; h += 0.005) {
    const hc = Math.round(h * 1000) / 1000;
    const result = calcRigid({ ...I, hc });
    if (result.p1 && result.p2 && result.p3) {
      return { hc, result };
    }
  }
  return null;
}

export function calcDrain(d: DrainInput): DrainResult {
  const id = d.id / 100;
  const ii = d.in_ / 100;
  const nz = d.N + 1;
  const Qi = d.Ic * (nz + (d.nh * d.B) / d.L);
  const Ls = d.B * Math.sqrt(1 + (ii > 0 ? (id * id) / (ii * ii) : 0));
  const vs = d.ne > 0 ? (1 / d.ne) * (d.kb / 86400) * Math.sqrt(id * id + ii * ii) : 0;
  const t = vs > 0 ? Ls / (3600 * vs) : Infinity;
  const cap = d.hbt * 1.0 * (vs * 86400);
  return { nz, Qi, Ls, vs, t, cap };
}

export function calcJoint(j: JointInput): JointResult {
  const tie200: Record<JointInput['kc'], string> = {
    '3.00': '14×700×900',
    '3.50': '14×700×800',
    '3.75': '14×700×700',
    '4.50': '14×700×600',
  };
  const tie260: Record<JointInput['kc'], string> = {
    '3.00': '16×800×800',
    '3.50': '16×800×700',
    '3.75': '16×800×600',
    '4.50': '16×800×500',
  };
  const tie = j.h >= 26 ? tie260[j.kc] : tie200[j.kc];
  const dw: Array<[number, string, string, string]> = [
    [20, '25', '400', '300'],
    [22, '28', '400', '300'],
    [24, '30', '400', '300'],
    [26, '32', '450', '300'],
    [28, '32–34', '450', '300'],
    [30, '34–36', '500', '300'],
  ];
  let d = dw[0];
  for (const row of dw) {
    if (j.h >= row[0]) d = row;
  }
  return {
    h: j.h,
    tie,
    d,
    doc_gia: j.mong === 'gc' ? `2/5·h = ${fmt((j.h * 2) / 5, 1)} cm` : `1/3·h = ${fmt(j.h / 3, 1)} cm`,
    co_thanh: `1/4–1/3·h = ${fmt(j.h / 4, 1)}–${fmt(j.h / 3, 1)} cm`,
    co_khong: `1/5–1/4·h = ${fmt(j.h / 5, 1)}–${fmt(j.h / 4, 1)} cm`,
    catlan: j.cap === 'cao' ? '2 lần (giật cấp, khe trên rộng 7–10 mm)' : '1 lần',
    dan_kc: `≥ (12–15)·L = ${fmt(12 * j.L, 1)}–${fmt(15 * j.L, 1)} m`,
  };
}

export const RIGID_FORMULAS: ReadonlyArray<readonly [string, string, string]> = [
  ['Mô đun lớp hạt tương đương', 'E<sub>x</sub> = Σ(h<sub>i</sub>²·E<sub>i</sub>) / Σ(h<sub>i</sub>²)', '(13)'],
  ['Hệ số hồi quy', 'α = 0,86 + 0,26·ln(h<sub>x</sub>)', '(14)'],
  ['Mô đun nền tương đương', 'E<sub>t</sub> = (E<sub>x</sub>/E<sub>0</sub>)<sup>α</sup>·E<sub>0</sub>', '(12)'],
  ['Độ cứng chịu uốn tấm', 'D<sub>c</sub> = E<sub>c</sub>·h<sub>c</sub>³ / [12(1−μ<sub>c</sub>²)]', '(11)'],
  ['Độ cứng chịu uốn móng bó', 'D<sub>b</sub> = E<sub>b</sub>·h<sub>b</sub>³ / [12(1−μ<sub>b</sub>²)]', '(25)'],
  ['Bán kính độ cứng – MH1', 'r = 1,21·(D<sub>c</sub>/E<sub>t</sub>)<sup>1/3</sup>', '(11)'],
  ['Bán kính độ cứng – MH2', 'r<sub>g</sub> = 1,21·[(D<sub>c</sub>+D<sub>b</sub>)/E<sub>t</sub>]<sup>1/3</sup>', '(25)'],
  ['Hệ số mỏi', 'k<sub>f</sub> = N<sub>e</sub><sup>0,057</sup> (móng bó: <sup>0,065</sup>)', '(16)'],
  ['US tải trọng – MH1', 'σ<sub>ps</sub> = 1,47·10⁻³·r<sup>0,70</sup>·h<sub>c</sub>⁻²·P<sup>0,94</sup>', '(11)'],
  ['US tải trọng – MH2', 'σ<sub>ps</sub> = [1,45·10⁻³/(1+D<sub>b</sub>/D<sub>c</sub>)]·r<sub>g</sub><sup>0,65</sup>·h<sub>c</sub>⁻²·P<sup>0,94</sup>', '(25)'],
  ['US kéo uốn mỏi do tải', 'σ<sub>pr</sub> = k<sub>r</sub>·k<sub>f</sub>·k<sub>c</sub>·σ<sub>ps</sub>', '(10)'],
  ['US do trục nặng nhất', 'σ<sub>pmax</sub> = k<sub>r</sub>·k<sub>c</sub>·σ<sub>pm</sub>', '(20)'],
  ['Độ cứng tiếp xúc (MH2)', 'k<sub>n</sub> = ½·(h<sub>c</sub>/E<sub>c</sub>+h<sub>b</sub>/E<sub>b</sub>)⁻¹ ; =3000 nếu có cách ly', '(28)'],
  ['Hệ số kết cấu 2 lớp ζ', 'ζ = −[(k<sub>n</sub>r<sub>g</sub>⁴−D<sub>c</sub>)r<sub>β</sub>³]/[(k<sub>n</sub>r<sub>β</sub>⁴−D<sub>c</sub>)r<sub>g</sub>³]', '(28)'],
  ['Hệ số uốn vồng C<sub>L</sub>', 'C<sub>L</sub> = 1 − [1/(1+ζ)]·(Sh·cost+Ch·sint)/(cost·sint+Sh·Ch)', '(23/28)'],
  ['Hệ số US nhiệt tổng hợp', 'B<sub>L</sub> = 1,77·e<sup>−4,48h<sub>c</sub></sup>·C<sub>L</sub> − 0,131(1−C<sub>L</sub>)', '(23)'],
  ['US nhiệt lớn nhất', 'σ<sub>tmax</sub> = α<sub>c</sub>·h<sub>c</sub>·E<sub>c</sub>·T<sub>g</sub>/2·B<sub>L</sub>', '(22)'],
  ['Hệ số mỏi nhiệt', 'k<sub>t</sub> = (f<sub>r</sub>/σ<sub>tmax</sub>)[a<sub>t</sub>(σ<sub>tmax</sub>/f<sub>r</sub>)<sup>b<sub>t</sub></sup>−c<sub>t</sub>]', '(24)'],
  ['US nhiệt gây mỏi', 'σ<sub>tr</sub> = k<sub>t</sub>·σ<sub>tmax</sub>', '(21)'],
  ['US đáy móng bó (MH2)', 'σ<sub>bps</sub> = [1,41·10⁻³/(1+D<sub>c</sub>/D<sub>b</sub>)]·r<sub>g</sub><sup>0,68</sup>·h<sub>b</sub>⁻²·P<sub>s</sub><sup>0,94</sup>', '(27)'],
];

export const DRAIN_FORMULAS: ReadonlyArray<readonly [string, string, string]> = [
  ['Lượng nước thấm', 'Q<sub>i</sub> = I<sub>c</sub>·(n<sub>z</sub> + n<sub>h</sub>·B/L)', '(1)'],
  ['Chiều dài đường thấm', 'L<sub>s</sub> = B·√(1 + i<sub>d</sub>²/i<sub>n</sub>²)', '(3)'],
  ['Tốc độ thấm', 'v<sub>s</sub> = (1/n<sub>e</sub>)·k<sub>b</sub>·√(i<sub>d</sub>²+i<sub>n</sub>²)', '(4)'],
  ['Thời gian thấm', 't = L<sub>s</sub>/(3600·v<sub>s</sub>)', '(2)'],
  ['Kiểm toán chiều dày', 'h<sub>bt</sub>·1,0·v<sub>s</sub> ≥ Q<sub>i</sub>', '(5)'],
];
