import { useStore } from '../state/store';
import { useComputed } from '../state/compute';
import { GA_KINDS } from '../engine/types';
import { barKg, PART_LABEL, PART_ORDER } from '../engine/rebar';
import { fmt } from '../engine/summary';
import { qtyTable, steelTable } from '../export/exportXlsx';

function Table({ head, rows, digits = 2 }: { head: string[]; rows: (string | number)[][]; digits?: number }) {
  return (
    <div className="tscroll">
      <table className="grid ro">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={typeof c === 'number' && j > 2 ? 'n' : ''}>
                  {typeof c === 'number' ? (j < 3 ? c : fmt(c, digits)) : c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function QtyView() {
  const project = useStore((s) => s.project);
  const { items, results } = useComputed(project);
  const q = qtyTable(project, results);
  const s = steelTable(results);
  const concrete = items.filter((i) => /^BTCT|^Bê tông|^BT lót/.test(i.name) || /BTCT/.test(i.name)).filter((i) => i.unit === 'm3').reduce((a, i) => a + i.value, 0);
  const steel = items.filter((i) => i.unit === 'kg').reduce((a, i) => a + i.value, 0);
  return (
    <div className="qtyview">
      <div className="cards" id="sum">
        <div className="card">
          <span>BTCT tổng</span>
          <b>{fmt(concrete)} m³</b>
        </div>
        <div className="card">
          <span>Cốt thép + thép hình</span>
          <b>{fmt(steel, 0)} kg</b>
        </div>
        <div className="card">
          <span>Hàm lượng thép</span>
          <b>{concrete > 0 ? fmt(steel / concrete, 1) : '–'} kg/m³</b>
        </div>
        <div className="card">
          <span>Số ga</span>
          <b>{results.reduce((a, r) => a + r.row.count, 0)}</b>
        </div>
      </div>
      <h3>Bảng tổng hợp khối lượng (THKL)</h3>
      <div className="tscroll">
        <table className="grid ro thkl" id="thkl">
          <thead>
            <tr>
              <th>TT</th>
              <th>Hạng mục</th>
              <th>Đơn vị</th>
              <th>Khối lượng</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.tt}>
                <td>{it.tt}</td>
                <td className="l">{it.name}</td>
                <td>{it.unit}</td>
                <td className="n">{fmt(it.value, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>Chiết tính từng ga ({GA_KINDS[project.kind].label})</h3>
      <Table head={q.head} rows={q.rows} />
      <h3>Cốt thép theo kết cấu (kg, đã nhân số lượng)</h3>
      <Table head={s.head} rows={s.rows} />
    </div>
  );
}

export function SteelView() {
  const project = useStore((s) => s.project);
  const sel = useStore((s) => s.sel);
  const { results } = useComputed(project);
  const r = results[Math.min(sel, results.length - 1)];
  const conc = r.qty.bottomConc + r.qty.wallConc + r.qty.roofConc + r.qty.neckConc + (r.qty.lid?.conc ?? 0) + (r.qty.inlet?.conc ?? 0);
  return (
    <div className="steelview">
      <div className="cards">
        <div className="card">
          <span>Ga</span>
          <b>{r.row.name}</b>
        </div>
        <div className="card">
          <span>Thép một ga</span>
          <b>{fmt(r.rebar.totalKg, 1)} kg</b>
        </div>
        <div className="card">
          <span>BTCT một ga</span>
          <b>{fmt(conc)} m³</b>
        </div>
        <div className="card">
          <span>Hàm lượng thép</span>
          <b>{conc > 0 ? fmt(r.rebar.totalKg / conc, 1) : '–'} kg/m³</b>
        </div>
      </div>
      <div className="tscroll">
        <table className="grid ro" id="bars">
          <thead>
            <tr>
              <th>Ký hiệu</th>
              <th>Mô tả</th>
              <th>Ø</th>
              <th>Dài 1 thanh (mm)</th>
              <th>Số thanh</th>
              <th>Tổng dài (m)</th>
              <th>Khối lượng (kg)</th>
            </tr>
          </thead>
          <tbody>
            {PART_ORDER.map((part) => {
              const gs = r.rebar.groups.filter((g) => g.part === part);
              if (!gs.length) return null;
              const sub = gs.reduce((a, g) => a + barKg(g), 0);
              return [
                <tr key={part + 'h'} className="part">
                  <td colSpan={7}>{PART_LABEL[part]}</td>
                </tr>,
                ...gs.map((g) => (
                  <tr key={g.mark}>
                    <td className="c">{g.mark}</td>
                    <td className="l">{g.label}</td>
                    <td className="c">{g.dia}</td>
                    <td className="n">{g.length}</td>
                    <td className="n">{g.count}</td>
                    <td className="n">{fmt((g.length * g.count) / 1000, 1)}</td>
                    <td className="n">{fmt(barKg(g))}</td>
                  </tr>
                )),
                <tr key={part + 's'} className="sub">
                  <td colSpan={6}>Cộng {PART_LABEL[part]}</td>
                  <td className="n">{fmt(sub)}</td>
                </tr>,
              ];
            })}
            {r.rebar.angles.map((a, i) => (
              <tr key={'a' + i}>
                <td className="c">TH</td>
                <td className="l">
                  {a.label} {a.name}
                </td>
                <td />
                <td className="n">{fmt(a.length * 1000, 0)}</td>
                <td className="n">{a.count}</td>
                <td className="n">{fmt(a.length * a.count, 1)}</td>
                <td className="n">{fmt(a.kg)}</td>
              </tr>
            ))}
            <tr className="total">
              <td colSpan={6}>TỔNG CỘNG (một ga)</td>
              <td className="n">{fmt(r.rebar.totalKg)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
