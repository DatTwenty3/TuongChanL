// @vitest-environment node
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  calcRigid,
  calcTC1,
  calcTC2,
  calcTC3,
  computeSN37Low,
  computeSN37New,
  computeSN37Overlay,
  createDefaultFlexState,
  createDefaultRigidInput,
  createDefaultRigidTraffic,
  createDefaultSn37LowInput,
  createDefaultSn37NewInput,
  createDefaultSn37OverlayInput,
  resolveFlexInput,
} from '../../src/pavement/engine';
import {
  buildFlexWordDoc,
  buildFlexWorkbook,
  buildRigidWordDoc,
  buildRigidWorkbook,
  buildSN37WordDoc,
  buildSN37Workbook,
  parseRigidJson,
  serializeRigidJson,
} from '../../src/pavement/export';

describe('Pavement Exporters (XLSX with formulas, Word .doc, JSON)', () => {
  it('builds valid TCCS 39 workbook with live formulas', () => {
    const inp = createDefaultRigidInput();
    const res = calcRigid(inp);
    const tr = createDefaultRigidTraffic();
    const wb = buildRigidWorkbook(inp, res, tr, [{ name: 'PA 1', state: { input: inp, traffic: tr }, result: res }]);
    expect(wb.SheetNames).toEqual(['Thuyết minh', 'Tính toán', 'Ne (Phụ lục A)', 'Dò chiều dày', 'So sánh PA']);
    expect(wb.Sheets['Tính toán']['C39'].f).toContain('C24');
    expect(wb.Sheets['Tính toán']['E78'].f).toContain('IF(AND');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const parsed = XLSX.read(buf, { type: 'buffer' });
    expect(parsed.SheetNames).toEqual(wb.SheetNames);

    const stManual = { ...createDefaultFlexState(), echManual: 225 };
    const resManual = resolveFlexInput(stManual);
    const tc1Manual = calcTC1(resManual);
    const wbManual = buildFlexWorkbook(stManual, resManual, tc1Manual, calcTC2(resManual), calcTC3(resManual));
    const calcRows = XLSX.utils.sheet_to_json<unknown[]>(wbManual.Sheets['Tính toán'], { header: 1 });
    const echRow = calcRows.find((r) => String(r[1] ?? '').includes('nhập tay'));
    expect(echRow?.[2]).toBe(225);
    const wordManual = buildFlexWordDoc(resManual, tc1Manual, calcTC2(resManual), calcTC3(resManual));
    expect(wordManual).toContain('tra toán đồ Hình 2 do người dùng nhập');
    expect(wordManual).toContain('225,00');
  });

  it('builds valid TCCS 38 workbook with Odemark chains and traffic links', () => {
    const st = createDefaultFlexState();
    const resolved = resolveFlexInput(st);
    const tc1 = calcTC1(resolved);
    const tc2 = calcTC2(resolved);
    const tc3 = calcTC3(resolved);
    const wb = buildFlexWorkbook(st, resolved, tc1, tc2, tc3);
    expect(wb.SheetNames).toEqual(['Thuyết minh', 'Giao thông', 'Tính toán']);
    expect(wb.Sheets['Tính toán']['C9'].f).toBe('VLOOKUP(C5,$E$5:$G$9,2,0)');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const parsed = XLSX.read(buf, { type: 'buffer' });
    expect(parsed.SheetNames).toEqual(wb.SheetNames);

    const stManual = { ...createDefaultFlexState(), echManual: 225 };
    const resManual = resolveFlexInput(stManual);
    const tc1Manual = calcTC1(resManual);
    const wbManual = buildFlexWorkbook(stManual, resManual, tc1Manual, calcTC2(resManual), calcTC3(resManual));
    const calcRows = XLSX.utils.sheet_to_json<unknown[]>(wbManual.Sheets['Tính toán'], { header: 1 });
    const echRow = calcRows.find((r) => String(r[1] ?? '').includes('nhập tay'));
    expect(echRow?.[2]).toBe(225);
    const wordManual = buildFlexWordDoc(resManual, tc1Manual, calcTC2(resManual), calcTC3(resManual));
    expect(wordManual).toContain('tra toán đồ Hình 2 do người dùng nhập');
    expect(wordManual).toContain('225,00');
  });

  it('builds valid TCCS 37 workbook with NORM.S.INV and Goal Seek check formulas', () => {
    const n = computeSN37New(createDefaultSn37NewInput());
    const o = computeSN37Overlay(createDefaultSn37OverlayInput());
    const l = computeSN37Low(createDefaultSn37LowInput());
    const wb = buildSN37Workbook(n, o, l);
    expect(wb.SheetNames).toEqual(['TK moi', 'Tang cuong', 'Luu luong thap']);
    expect(wb.Sheets['TK moi']['C9'].f).toBe('NORM.S.INV(1-C7/100)');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const parsed = XLSX.read(buf, { type: 'buffer' });
    expect(parsed.SheetNames).toEqual(wb.SheetNames);

    const stManual = { ...createDefaultFlexState(), echManual: 225 };
    const resManual = resolveFlexInput(stManual);
    const tc1Manual = calcTC1(resManual);
    const wbManual = buildFlexWorkbook(stManual, resManual, tc1Manual, calcTC2(resManual), calcTC3(resManual));
    const calcRows = XLSX.utils.sheet_to_json<unknown[]>(wbManual.Sheets['Tính toán'], { header: 1 });
    const echRow = calcRows.find((r) => String(r[1] ?? '').includes('nhập tay'));
    expect(echRow?.[2]).toBe(225);
    const wordManual = buildFlexWordDoc(resManual, tc1Manual, calcTC2(resManual), calcTC3(resManual));
    expect(wordManual).toContain('tra toán đồ Hình 2 do người dùng nhập');
    expect(wordManual).toContain('225,00');
  });

  it('generates Word .doc HTML strings for all 3 standards', () => {
    const rIn = createDefaultRigidInput();
    const rRes = calcRigid(rIn);
    const rDoc = buildRigidWordDoc(rIn, rRes, createDefaultRigidTraffic());
    expect(rDoc).toContain('TCCS 39:2022/TCĐBVN');
    expect(rDoc).toContain('KẾT CẤU MẶT ĐƯỜNG BTXM ĐẠT YÊU CẦU');

    const fSt = createDefaultFlexState();
    const fRes = resolveFlexInput(fSt);
    const fDoc = buildFlexWordDoc(fRes, calcTC1(fRes), calcTC2(fRes), calcTC3(fRes));
    expect(fDoc).toContain('TCCS 38:2022/TCĐBVN');

    const sDoc = buildSN37WordDoc(
      computeSN37New(createDefaultSn37NewInput()),
      computeSN37Overlay(createDefaultSn37OverlayInput()),
      computeSN37Low(createDefaultSn37LowInput()),
    );
    expect(sDoc).toContain('TCCS 37:2022/TCĐBVN');
  });

  it('round-trips TCCS 39 JSON bundle', () => {
    const inp = createDefaultRigidInput();
    const tr = createDefaultRigidTraffic();
    const res = calcRigid(inp);
    const json = serializeRigidJson({ input: inp, traffic: tr }, [{ name: 'PA A', state: { input: inp, traffic: tr }, result: res }]);
    const back = parseRigidJson(json);
    expect(back.current?.input.hc).toBe(inp.hc);
    expect(back.options?.length).toBe(1);
    expect(back.options?.[0].name).toBe('PA A');
  });
});
