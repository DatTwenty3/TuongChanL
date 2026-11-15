import { actions, useStore } from '../state/store';
import { useComputed } from '../state/compute';
import { GA_KINDS, type GaRow } from '../engine/types';
import { parsePipe, parseRebar } from '../engine/parse';
import { Icon } from './Icon';

const numVal = (s: string): number => {
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

function Num({ value, onChange, w = 62, label }: { value: number | null; onChange: (v: number) => void; w?: number; label?: string }) {
  return <input className="cell num" aria-label={label} style={{ width: w }} inputMode="decimal" value={value ?? ''} onChange={(e) => onChange(numVal(e.target.value))} onFocus={(e) => e.target.select()} />;
}
function Txt({ value, onChange, w = 84, label, bad }: { value: string; onChange: (v: string) => void; w?: number; label?: string; bad?: boolean }) {
  return <input className={'cell' + (bad ? ' bad' : '')} aria-label={label} style={{ width: w }} value={value} onChange={(e) => onChange(e.target.value)} onFocus={(e) => e.target.select()} />;
}

export function GaTable() {
  const project = useStore((s) => s.project);
  const sel = useStore((s) => s.sel);
  const { warnings } = useComputed(project);
  const info = GA_KINDS[project.kind];
  const up = (i: number, f: (r: GaRow) => void) => actions.updateRow(i, (r) => (f(r), r));
  return (
    <section className="panel gatable" aria-label="Danh sách hố ga">
      <div className="panel-h">
        <h2>Danh sách ga ({project.rows.length})</h2>
        <div className="btns">
          <button id="bAdd" className="ibtn" title="Thêm ga trống" onClick={actions.addBlank}>
            <Icon name="plus" />
          </button>
          <button id="bDup" className="ibtn" title="Nhân bản ga đang chọn" onClick={actions.addRow}>
            <Icon name="copy" />
          </button>
          <button id="bDel" className="ibtn" title="Xoá ga đang chọn" disabled={project.rows.length <= 1} onClick={() => actions.deleteRow(sel)}>
            <Icon name="trash" />
          </button>
        </div>
      </div>
      <div className="tscroll">
        <table className="grid">
          <thead>
            <tr>
              <th>#</th>
              <th>Tên ga</th>
              <th>SL</th>
              <th>Dài</th>
              <th>Rộng</th>
              <th>Cao</th>
              <th>Dày đáy</th>
              <th>Dày tường</th>
              <th>{info.hasNeck ? 'Dày trần' : 'Dày nắp'}</th>
              {[1, 2, 3, 4].map((k) => (
                <th key={k} colSpan={2}>{`Cống T${k}`}</th>
              ))}
              {info.hasNeck && (
                <>
                  <th>Cao cổ</th>
                  <th>Dày cổ</th>
                </>
              )}
              <th>Cao độ đáy</th>
            </tr>
          </thead>
          <tbody>
            {project.rows.map((r, i) => {
              const w = warnings[i] ?? [];
              const err = w.some((x) => x.level === 'err');
              return (
                <tr key={i} className={i === sel ? 'sel' : ''} data-row={i} onClick={() => actions.select(i)}>
                  <td className="idx" title={w.map((x) => x.text).join('\n')}>
                    {w.length ? <span className={'dot ' + (err ? 'err' : 'warn')} /> : null}
                    {i + 1}
                  </td>
                  <td>
                    <Txt value={r.name} w={92} label="Tên ga" onChange={(v) => up(i, (x) => (x.name = v))} />
                  </td>
                  <td>
                    <Num value={r.count} w={44} label="Số lượng" onChange={(v) => up(i, (x) => (x.count = Math.max(0, Math.round(v))))} />
                  </td>
                  <td>
                    <Num value={r.L} label="Dài" onChange={(v) => up(i, (x) => (x.L = v))} />
                  </td>
                  <td>
                    <Num value={r.B} label="Rộng" onChange={(v) => up(i, (x) => (x.B = v))} />
                  </td>
                  <td>
                    <Num value={r.H} label="Cao" onChange={(v) => up(i, (x) => (x.H = v))} />
                  </td>
                  <td>
                    <Num value={r.bottom.t} w={52} label="Dày đáy" onChange={(v) => up(i, (x) => (x.bottom.t = v))} />
                  </td>
                  <td>
                    <Num value={r.wall.t} w={52} label="Dày tường" onChange={(v) => up(i, (x) => (x.wall.t = v))} />
                  </td>
                  <td>
                    <Num value={r.roof.t} w={52} label="Dày trần" onChange={(v) => up(i, (x) => (x.roof.t = v))} />
                  </td>
                  {r.pipes.map((_, k) => (
                    <PipeCells key={k} row={r} k={k} onSpec={(v) => up(i, (x) => (x.pipes[k].spec = v))} onDepth={(v) => up(i, (x) => (x.pipes[k].depth = v))} />
                  ))}
                  {info.hasNeck && (
                    <>
                      <td>
                        <Num value={r.neck.h} w={52} label="Cao cổ" onChange={(v) => up(i, (x) => (x.neck.h = v))} />
                      </td>
                      <td>
                        <Num value={r.neck.t} w={52} label="Dày cổ" onChange={(v) => up(i, (x) => (x.neck.t = v))} />
                      </td>
                    </>
                  )}
                  <td>
                    <input
                      className="cell num"
                      aria-label="Cao độ đáy"
                      style={{ width: 62 }}
                      inputMode="decimal"
                      value={r.level ?? ''}
                      placeholder="–"
                      onChange={(e) => up(i, (x) => (x.level = e.target.value.trim() === '' ? null : numVal(e.target.value)))}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PipeCells({ row, k, onSpec, onDepth }: { row: GaRow; k: number; onSpec: (v: string) => void; onDepth: (v: number) => void }) {
  const p = row.pipes[k];
  const project = useStore((s) => s.project);
  const bad = !!p.spec.trim() && !parsePipe(p.spec, project.catalog);
  const isDitch = /^R/i.test(p.spec.trim());
  return (
    <>
      <td>
        <input className={'cell' + (bad ? ' bad' : '')} aria-label={`Cống T${k + 1}`} list="pipeList" style={{ width: 78 }} value={p.spec} onChange={(e) => onSpec(e.target.value)} onFocus={(e) => e.target.select()} />
      </td>
      <td>
        <input className="cell num" aria-label={`Sâu T${k + 1}`} style={{ width: 46 }} inputMode="decimal" disabled={isDitch || !p.spec.trim()} value={p.spec.trim() && !isDitch ? p.depth : ''} onChange={(e) => onDepth(numVal(e.target.value))} onFocus={(e) => e.target.select()} />
      </td>
    </>
  );
}

export function PipeDatalist() {
  const cat = useStore((s) => s.project.catalog);
  return (
    <datalist id="pipeList">
      {cat.round.map((r) => (
        <option key={'d' + r.d} value={`D${r.d}`} />
      ))}
      {cat.box.map((r) => (
        <option key={`b${r.b}x${r.h}`} value={`${r.b}x${r.h}`} />
      ))}
      {cat.ditch.map((r) => (
        <option key={`r${r.b}x${r.h}`} value={`R${r.b}x${r.h}`} />
      ))}
    </datalist>
  );
}

export function RowDetail() {
  const project = useStore((s) => s.project);
  const sel = useStore((s) => s.sel);
  const row = project.rows[sel];
  const { warnings } = useComputed(project);
  const info = GA_KINDS[project.kind];
  if (!row) return null;
  const up = (f: (r: GaRow) => void) => actions.updateRow(sel, (r) => (f(r), r));
  const R = (label: string, value: string, set: (v: string) => void, req = true) => (
    <label className="field" key={label}>
      <span>{label}</span>
      <input className={'cell wide' + ((value.trim() && !parseRebar(value)) || (req && !value.trim()) ? ' bad' : '')} value={value} placeholder="D10A150" onChange={(e) => set(e.target.value)} />
    </label>
  );
  const w = warnings[sel] ?? [];
  return (
    <section className="panel detail" aria-label="Thép và cảnh báo của ga đang chọn">
      <div className="panel-h">
        <h2>
          Thép ga <b>{row.name}</b>
        </h2>
      </div>
      <div className="fgrid">
        {R('Đáy – lớp dưới', row.bottom.low, (v) => up((r) => (r.bottom.low = v)))}
        {R('Đáy – lớp trên', row.bottom.up, (v) => up((r) => (r.bottom.up = v)))}
        {R('Tường – ngoài', row.wall.out, (v) => up((r) => (r.wall.out = v)))}
        {R('Tường – trong', row.wall.in, (v) => up((r) => (r.wall.in = v)))}
        {R(info.hasNeck ? 'Trần – lớp trên' : 'Nắp – lớp trên', row.roof.up, (v) => up((r) => (r.roof.up = v)), info.hasNeck)}
        {R(info.hasNeck ? 'Trần – lớp dưới' : 'Nắp – lớp dưới', row.roof.low, (v) => up((r) => (r.roof.low = v)), info.hasNeck)}
        {info.hasNeck && R('Cổ – ngoài', row.neck.out, (v) => up((r) => (r.neck.out = v)), row.neck.h > 0)}
        {info.hasNeck && R('Cổ – trong', row.neck.in, (v) => up((r) => (r.neck.in = v)), row.neck.h > 0)}
      </div>
      {w.length > 0 && (
        <ul id="warn" className="warns">
          {w.map((x, i) => (
            <li key={i} className={x.level}>
              <Icon name="warn" size={13} /> {x.text}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
