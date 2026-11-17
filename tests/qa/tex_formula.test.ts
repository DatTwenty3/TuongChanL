/**
 * Bộ chuyển công thức TeX (hiển thị trong bảng tính cầu cống) → công thức Excel nối ô.
 * Kiểm tra: cú pháp TeX hiểu đúng, chuỗi Excel đúng quy ước Excel (ưu tiên toán tử), giá trị tính lại khớp,
 * và gặp thứ chưa hỗ trợ thì từ chối (không đoán).
 */
import { describe, expect, it } from 'vitest';
import { evalExcelString, evaluate, normSym, parseEquation, symbolsOf, toExcel } from '../../src/culvert/export/texFormula';

const run = (tex: string, vals: Record<string, number>, deg = false) => {
  const eq = parseEquation(tex);
  const keys = [...symbolsOf(eq.ast)];
  const addr = (k: string) => 'J' + (keys.indexOf(k) + 1);
  const byAddr = new Map(keys.map((k) => [addr(k), vals[k]] as const));
  const calc = evaluate(eq.ast, (k) => vals[k], { deg });
  const f = toExcel(eq.ast, addr, { deg });
  const viaExcel = evalExcelString(f, (a) => byAddr.get(a) as number);
  return { eq, calc, f, viaExcel, keys };
};

describe('texFormula', () => {
  it("chuẩn hóa ký hiệu: f'c ≡ f_c' ≡ f'_c ; \\beta_1 ≡ β1", () => {
    expect(normSym("f'c")).toBe('fc');
    expect(parseEquation("f_c' = 2 x").lhs).toBe('fc');
    expect(parseEquation("f'_c = 2 x").lhs).toBe('fc');
    expect(parseEquation('\\beta_1 = 1 + x').lhs).toBe('β1');
    expect(normSym('εcl')).toBe('εcl');
  });

  it("Ec = 0.0017 K1 wc² f'c^0,33 (TCVN 11823-5, 4.2.4)", () => {
    const { calc, f, viaExcel, keys } = run("E_c = 0.0017\\,K_1\\,w_c^2\\,f_c'^{\\,0.33}\\quad (\\text{4.2.4})", {
      K1: 1,
      wc: 2400,
      fc: 30,
    });
    expect([...keys].sort()).toEqual(['K1', 'fc', 'wc']);
    expect(calc).toBeCloseTo(0.0017 * 1 * 2400 ** 2 * 30 ** 0.33, 6);
    expect(viaExcel).toBeCloseTo(calc, 9);
    expect(f).toMatch(/\^0\.33$/);
  });

  it("β1 = 0,85 − 0,05(f'c − 28)/7 ; 0,65 ≤ β1 ≤ 0,85 → kẹp bằng MAX/MIN", () => {
    const { eq, calc, viaExcel } = run(
      "\\beta_1 = 0.85 - 0.05\\,\\dfrac{f'_c - 28}{7}\\ ;\\ 0.65 \\le \\beta_1 \\le 0.85\\quad (\\text{7.2.2})",
      { fc: 70 },
    );
    expect(eq.clamp).toEqual([0.65, 0.85]);
    expect(Math.max(0.65, Math.min(0.85, calc))).toBeCloseTo(0.65, 12);
    expect(viaExcel).toBeCloseTo(calc, 9);
  });

  it('ưu tiên toán tử đúng quy ước Excel: a/(b·c), a − (b + c), −(x^2), (a^b)^c', () => {
    expect(run('r = \\dfrac{a}{b\\,c}', { a: 12, b: 2, c: 3 }).viaExcel).toBeCloseTo(2, 12);
    expect(run('r = a - (b + c)', { a: 10, b: 2, c: 3 }).viaExcel).toBeCloseTo(5, 12);
    expect(run('r = -x^2', { x: 3 }).viaExcel).toBeCloseTo(-9, 12); // Excel: -3^2 = 9 nên phải sinh -(x^2)
    expect(run('r = (a^b)^c', { a: 2, b: 3, c: 2 }).viaExcel).toBeCloseTo(64, 12);
    expect(run('r = a^{b^c}', { a: 2, b: 3, c: 2 }).viaExcel).toBeCloseTo(512, 12);
    expect(run('r = a / b / c', { a: 24, b: 4, c: 3 }).viaExcel).toBeCloseTo(2, 12);
    expect(run('r = a - b - c', { a: 10, b: 2, c: 3 }).viaExcel).toBeCloseTo(5, 12);
  });

  it('căn bậc hai và phân số lồng', () => {
    const r = run("f_r = 0.63\\sqrt{f'_c}", { fc: 30 });
    expect(r.calc).toBeCloseTo(0.63 * Math.sqrt(30), 12);
    expect(r.viaExcel).toBeCloseTo(r.calc, 12);
    const n = run('s = \\dfrac{a + \\dfrac{b}{c}}{d}', { a: 1, b: 6, c: 3, d: 2 });
    expect(n.viaExcel).toBeCloseTo(1.5, 12);
  });

  it('Ka Rankine với φ tính bằng độ → RADIANS', () => {
    const r = run('K_a = \\tan\\left(45 - \\dfrac{\\varphi}{2}\\right)^2', { φ: 30 }, true);
    expect(r.viaExcel).toBeCloseTo(Math.tan(((45 - 15) * Math.PI) / 180) ** 2, 12);
    expect(r.f).toContain('RADIANS');
  });

  it('từ chối thứ chưa hỗ trợ thay vì đoán', () => {
    expect(() => parseEquation('A = \\begin{cases} 1 & x < 2 \\\\ 3 & x \\ge 2 \\end{cases}')).toThrow();
    expect(() => parseEquation('S = \\sum P_i')).toThrow();
    expect(() => parseEquation('x + 1')).toThrow();
    expect(() => parseEquation('a b = 1')).toThrow();
  });
});
