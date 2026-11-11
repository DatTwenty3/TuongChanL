import type { EngineBarsResult } from '../engine';
import type { BarsResult, QuantitiesResult } from '../types/project';

const unitW = (d: number): number => ((7850 * Math.PI) / 4) * (d / 1e3) * (d / 1e3);

export function buildCsvContent(res: BarsResult | EngineBarsResult, q: QuantitiesResult): string {
  const rows: Array<Array<string | number | undefined>> = [
    [
      'Mac',
      'Ten',
      'D(mm)',
      'Dai 1 thanh min (mm)',
      'Dai 1 thanh max (mm)',
      'So luong',
      'Tong dai (m)',
      'kg/m',
      'Khoi luong (kg)',
    ],
  ];
  res.bars.forEach((b) =>
    rows.push([
      b.mark,
      b.name,
      b.d,
      b.minL ?? 0,
      b.maxL ?? 0,
      b.count ?? b.items.length,
      (b.totLen ?? 0).toFixed(2),
      unitW(b.d).toFixed(3),
      (b.kg ?? 0).toFixed(2),
    ]),
  );
  rows.push(
    [],
    ['Tong', '', '', '', '', '', '', '', q.totKg.toFixed(2)],
    ['Ham luong (kg/m3)', q.ratio.toFixed(1)],
    [],
    ['Be tong (m3)', 'Mong/ban day', q.conc.foot.toFixed(2)],
    ['', 'Than', q.conc.stem.toFixed(2)],
    ['', 'Chan khoa/khay', q.conc.key.toFixed(2)],
    ['', 'Suon', q.conc.rib.toFixed(2)],
    ['', 'Cong', q.vol.toFixed(2)],
    ['Be tong lot (m3)', '', q.blind.toFixed(2)],
    ['Van khuon (m2)', 'Mong/ban day', q.form.foot.toFixed(2)],
    ['', 'Than', q.form.stem.toFixed(2)],
    ['', 'Suon', q.form.rib.toFixed(2)],
    ['', 'Cong', q.form.tot.toFixed(2)],
  );
  return (
    '\ufeff' +
    rows
      .map((r) =>
        r.map((v) => `"${String(v === undefined ? '' : v).replace(/"/g, '""')}"`).join(','),
      )
      .join('\r\n')
  );
}

export const exportCSV = buildCsvContent;
