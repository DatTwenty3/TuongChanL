import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { createRigidSampleProject } from '../../../src/toando/data/sampleRigid';
import { createDefaultRigidProjectData, runRigidVerification } from '../../../src/toando/engine';
import { exportRigidToXlsxBuffer } from '../../../src/toando/export';
import type { ProjectState } from '../../../src/toando/types/project';

type Cells = Map<string, ExcelJS.CellValue>;

function sheetCells(ws: ExcelJS.Worksheet): Cells {
  const m: Cells = new Map();
  ws.eachRow((row) => {
    row.eachCell((cell) => {
      m.set(cell.address, cell.value);
    });
  });
  return m;
}

/** Bộ tính công thức Excel tối thiểu (đủ cho các hàm dùng trong bảng tính mặt đường cứng). */
function makeEvaluator(cells: Cells) {
  const cache = new Map<string, number | string>();
  const stack = new Set<string>();

  const getCell = (addr: string): number | string => {
    const key = addr.replace(/\$/g, '');
    if (cache.has(key)) return cache.get(key)!;
    if (stack.has(key)) throw new Error(`Vòng tham chiếu tại ${key}`);
    const raw = cells.get(key);
    let val: number | string;
    if (raw && typeof raw === 'object' && 'formula' in raw && raw.formula) {
      stack.add(key);
      val = evalFormula(String(raw.formula));
      stack.delete(key);
    } else if (typeof raw === 'number' || typeof raw === 'string') {
      val = raw;
    } else {
      val = 0;
    }
    cache.set(key, val);
    return val;
  };

  const colNum = (c: string): number => c.split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0);
  const colName = (n: number): string => {
    let s = '';
    while (n > 0) {
      s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  };
  const range = (a: string, b: string): number[] => {
    const ma = /^([A-Z]+)(\d+)$/.exec(a.replace(/\$/g, ''))!;
    const mb = /^([A-Z]+)(\d+)$/.exec(b.replace(/\$/g, ''))!;
    const out: number[] = [];
    for (let c = colNum(ma[1]); c <= colNum(mb[1]); c += 1) {
      for (let r = Number(ma[2]); r <= Number(mb[2]); r += 1) {
        out.push(Number(getCell(`${colName(c)}${r}`)));
      }
    }
    return out;
  };

  const fns: Record<string, (...a: unknown[]) => unknown> = {
    SUM: (...a) => (a.flat() as number[]).reduce((x, y) => x + y, 0),
    MAX: (...a) => Math.max(...(a.flat() as number[])),
    IF: (c, t, f) => (c ? t : f),
    EXP: (x) => Math.exp(x as number),
    LN: (x) => Math.log(x as number),
    SINH: (x) => Math.sinh(x as number),
    COSH: (x) => Math.cosh(x as number),
    SIN: (x) => Math.sin(x as number),
    COS: (x) => Math.cos(x as number),
  };

  function evalFormula(f: string): number | string {
    let js = f;
    // phạm vi A1:B2 -> RNG("A1","B2")
    js = js.replace(/\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)/g, (_m, c1, r1, c2, r2) => `RNG("${c1}${r1}","${c2}${r2}")`);
    // ô đơn
    js = js.replace(/(?<![A-Za-z"])\$?([A-Z]{1,2})\$?(\d+)(?![\d(])/g, (_m, c, r) => `CELL("${c}${r}")`);
    js = js.replace(/\^/g, '**').replace(/<>/g, '!==');
    js = js.replace(/(?<![<>!=])=(?!=)/g, '===');
    js = js.replace(/\b(SUM|MAX|IF|EXP|LN|SINH|COSH|SIN|COS)\(/g, 'FN.$1(');
    // toán tử ** có độ ưu tiên cao hơn một ngôi trong JS => cần ngoặc cho "-x**y"; công thức đã dùng ngoặc rõ ràng.
    const fn = new Function('CELL', 'RNG', 'FN', `return (${js});`);
    return fn(getCell, (a: string, b: string) => range(a, b), fns) as number | string;
  }

  return { getCell, evalFormula };
}

async function loadSheet(project: ProjectState): Promise<ExcelJS.Worksheet> {
  const bytes = await exportRigidToXlsxBuffer(project);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes.buffer as ArrayBuffer);
  return wb.worksheets[0]!;
}

function textOf(ws: ExcelJS.Worksheet): string {
  const out: string[] = [];
  ws.eachRow((row) => {
    row.eachCell((cell) => {
      const v = cell.value;
      if (typeof v === 'string') out.push(v);
      else if (v && typeof v === 'object' && 'richText' in v) {
        out.push((v.richText as Array<{ text: string }>).map((t) => t.text).join(''));
      } else if (v && typeof v === 'object' && 'result' in v && typeof v.result === 'string') {
        out.push(v.result);
      }
    });
  });
  return out.join('\n');
}

describe('Excel kiểm toán mặt đường cứng (TCCS 39:2022)', () => {
  it('có số hiệu công thức, điều khoản và các mục I–V', async () => {
    const ws = await loadSheet(createRigidSampleProject());
    const text = textOf(ws);
    expect(text).toContain('BẢNG TÍNH KIỂM TOÁN MẶT ĐƯỜNG BÊ TÔNG XI MĂNG');
    expect(text).toContain('Theo tiêu chuẩn TCCS 39:2022/TCĐBVN');
    for (const note of [
      'Công thức (10) — Điều 8.3.1',
      'Công thức (11) — Điều 8.3.2',
      'Công thức (12) — Điều 8.3.2',
      'Công thức (13) — Điều 8.3.2',
      'Công thức (14) — Điều 8.3.2',
      'Công thức (16) — Điều 8.3.3',
      'Công thức (20) — Điều 8.3.5',
      'Công thức (21) — Điều 8.3.6',
      'Công thức (22) — Điều 8.3.6',
      'Công thức (23) — Điều 8.3.6',
      'Công thức (24) — Điều 8.3.7',
      'Công thức (6) — Điều 8.2.2',
      'Công thức (7) — Điều 8.2.2',
    ]) {
      expect(text).toContain(note);
    }
    expect(text).toContain('Kết luận: Tấm BTXM đảm bảo điều kiện mỏi do tải trọng và gradien nhiệt độ.');
    expect(text).not.toMatch(/[Mm]odule/);
  });

  it('mọi ô công thức tính lại đúng bằng kết quả lưu sẵn (MH1 — ví dụ B.1)', async () => {
    const ws = await loadSheet(createRigidSampleProject());
    const cells = sheetCells(ws);
    const ev = makeEvaluator(cells);
    let n = 0;
    for (const [addr, raw] of cells) {
      if (raw && typeof raw === 'object' && 'formula' in raw && raw.formula) {
        const got = ev.evalFormula(String(raw.formula));
        const want = raw.result as number | string;
        if (typeof want === 'number') {
          expect(Number(got), `${addr}: =${raw.formula}`).toBeCloseTo(want, 6);
        } else {
          expect(got, `${addr}: =${raw.formula}`).toBe(want);
        }
        n += 1;
      }
    }
    expect(n).toBeGreaterThan(25);
  });

  it('MH2 (móng bó), Ne tự tính từ phổ tải: công thức khớp kết quả engine', async () => {
    const p = createRigidSampleProject();
    const d = createDefaultRigidProjectData();
    p.rigid = {
      ...d,
      roadClass: 'CAP_III',
      neAuto: true,
      input: {
        ...d.input,
        model: 2,
        hc: 0.26,
        L: 4.8,
        fr: 5.0,
        Ec: 31000,
        Pmax: 180,
        gr: 1.13,
        kr: 0.87,
        kc: 1.05,
        E0: 45,
        Eb: 1300,
        hb: 0.2,
        mub: 0.2,
        fbr: 1.0,
        caly: 0,
        layers: [{ name: 'CPĐD loại I (móng dưới)', E: 300, h: 0.18 }],
      },
    };
    const ws = await loadSheet(p);
    const cells = sheetCells(ws);
    const ev = makeEvaluator(cells);
    const v = runRigidVerification(p);
    let checked = 0;
    for (const [addr, raw] of cells) {
      if (raw && typeof raw === 'object' && 'formula' in raw && raw.formula) {
        const got = ev.evalFormula(String(raw.formula));
        const want = raw.result as number | string;
        if (typeof want === 'number') {
          expect(Number(got) / (want || 1), `${addr}: =${raw.formula}`).toBeCloseTo(want ? 1 : 0, 6);
        } else {
          expect(got, `${addr}: =${raw.formula}`).toBe(want);
        }
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(40);
    const text = textOf(ws);
    expect(text).toContain('Công thức (A.3) — Điều A.8');
    expect(text).toContain('Công thức (28) — Điều 8.4.5');
    expect(text).toContain('Công thức (26) — Điều 8.4.2');
    expect(text).toContain('Kết luận: Lớp móng trên');
    expect(v.res.c1).toBeGreaterThan(0);
  });

  it('kết luận KHÔNG đạt có định dạng có điều kiện màu đỏ', async () => {
    const p = createRigidSampleProject();
    p.rigid!.input.hc = 0.15;
    const ws = await loadSheet(p);
    const text = textOf(ws);
    expect(text).toContain('KHÔNG đảm bảo');
    const cfs = (ws as unknown as {
      conditionalFormattings: Array<{ rules: Array<{ style?: { font?: { color?: { argb?: string } } } }> }>;
    }).conditionalFormattings;
    expect(cfs.length).toBeGreaterThanOrEqual(2);
    expect(cfs[0].rules[0].style?.font?.color?.argb).toBe('FFFF0000');
  });
});
