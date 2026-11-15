import { actions, useStore } from '../state/store';
import { GA_KINDS } from '../engine/types';
import { defaultConfig } from '../engine/defaults';
import { LID_BLOCKS } from '../engine/catalog-data';
import { CONFIG_GROUPS, getPath, setPath, type Field } from './configSchema';

function FieldInput({ f, value, onChange }: { f: Field; value: unknown; onChange: (v: unknown) => void }) {
  const id = 'cf_' + f.path.replace(/\./g, '_');
  let input;
  if (f.type === 'bool') input = <input id={id} type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />;
  else if (f.type === 'select')
    input = (
      <select id={id} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
        {f.options!.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    );
  else if (f.type === 'num')
    input = (
      <input
        id={id}
        className="cell num wide"
        inputMode="decimal"
        value={String(value ?? '')}
        onChange={(e) => {
          const n = Number(e.target.value.replace(',', '.'));
          onChange(Number.isFinite(n) && e.target.value.trim() !== '' ? n : 0);
        }}
        onFocus={(e) => e.target.select()}
      />
    );
  else
    input = (
      <input id={id} className="cell wide" list={f.path === 'lid.block' ? 'blockList' : undefined} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} onFocus={(e) => e.target.select()} />
    );
  return (
    <label className={'field' + (f.type === 'bool' ? ' chk' : '')} title={f.hint}>
      <span>
        {f.label}
        {f.unit ? <em> ({f.unit})</em> : null}
      </span>
      {input}
    </label>
  );
}

export function ConfigView() {
  const project = useStore((s) => s.project);
  const info = GA_KINDS[project.kind];
  return (
    <div className="configview">
      <div className="note">
        Các thông số tương ứng sheet <b>CF.Ga</b> của VHGpro 4. Thay đổi có hiệu lực ngay cho mọi ga trong danh sách.
        <button
          id="bCfgReset"
          className="btn sm"
          onClick={() => {
            if (confirm('Đặt lại toàn bộ cấu hình về mặc định của loại ga này?')) actions.updateProject((p) => ({ ...p, config: defaultConfig(p.kind) }), false);
          }}
        >
          Đặt lại mặc định
        </button>
      </div>
      <datalist id="blockList">
        {LID_BLOCKS.map((b) => (
          <option key={b} value={b.replace(/\.(MB|AA|BB)$/, '')} />
        ))}
      </datalist>
      <div className="cfgrid">
        {CONFIG_GROUPS.filter((g) => !g.show || g.show(info)).map((g) => (
          <details key={g.id} open={['liner', 'bottom', 'neck', 'cover', 'lid', 'topChamfer', 'inlet'].includes(g.id)} className="cfgroup" data-group={g.id}>
            <summary>{g.title}</summary>
            <div className="fgrid">
              {g.fields.map((f) => (
                <FieldInput key={f.path} f={f} value={getPath(project.config, f.path)} onChange={(v) => actions.updateProject((p) => ({ ...p, config: setPath(p.config, f.path, v) }))} />
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

function NumCell({ v, onChange, w = 66 }: { v: number; onChange: (n: number) => void; w?: number }) {
  return (
    <input
      className="cell num"
      style={{ width: w }}
      inputMode="decimal"
      value={v}
      onChange={(e) => {
        const n = Number(e.target.value.replace(',', '.'));
        onChange(Number.isFinite(n) ? n : 0);
      }}
      onFocus={(e) => e.target.select()}
    />
  );
}

export function CatalogView() {
  const project = useStore((s) => s.project);
  const cat = project.catalog;
  const upd = (f: (c: typeof cat) => void) => actions.updateProject((p) => (f(p.catalog), p));
  return (
    <div className="catalogview">
      <div className="note">Danh mục cống tròn, cống hộp, rãnh chữ U (sheet CF.Cong) và thép hình (CF.Data). Chọn cống ở bảng ga bằng chuỗi <code>D400</code>, <code>600x800</code> hoặc <code>R300x400</code>.</div>
      <div className="catgrid">
        <section className="panel">
          <div className="panel-h">
            <h2>Cống tròn</h2>
            <button className="btn sm" onClick={() => upd((c) => c.round.push({ d: 1000, t: 100 }))}>
              + Thêm
            </button>
          </div>
          <table className="grid">
            <thead>
              <tr>
                <th>D trong</th>
                <th>Dày</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cat.round.map((r, i) => (
                <tr key={i}>
                  <td>
                    <NumCell v={r.d} onChange={(n) => upd((c) => (c.round[i].d = n))} />
                  </td>
                  <td>
                    <NumCell v={r.t} onChange={(n) => upd((c) => (c.round[i].t = n))} />
                  </td>
                  <td>
                    <button className="ibtn sm" aria-label="Xoá" onClick={() => upd((c) => c.round.splice(i, 1))}>
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="panel">
          <div className="panel-h">
            <h2>Cống hộp</h2>
            <button className="btn sm" onClick={() => upd((c) => c.box.push({ b: 1000, h: 1000, t: 120, chamfer: 120, twin: false }))}>
              + Thêm
            </button>
          </div>
          <table className="grid">
            <thead>
              <tr>
                <th>B</th>
                <th>H</th>
                <th>Dày</th>
                <th>Vát</th>
                <th>Đôi</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cat.box.map((r, i) => (
                <tr key={i}>
                  <td>
                    <NumCell v={r.b} w={58} onChange={(n) => upd((c) => (c.box[i].b = n))} />
                  </td>
                  <td>
                    <NumCell v={r.h} w={58} onChange={(n) => upd((c) => (c.box[i].h = n))} />
                  </td>
                  <td>
                    <NumCell v={r.t} w={52} onChange={(n) => upd((c) => (c.box[i].t = n))} />
                  </td>
                  <td>
                    <NumCell v={r.chamfer} w={52} onChange={(n) => upd((c) => (c.box[i].chamfer = n))} />
                  </td>
                  <td>
                    <input type="checkbox" checked={r.twin} onChange={(e) => upd((c) => (c.box[i].twin = e.target.checked))} />
                  </td>
                  <td>
                    <button className="ibtn sm" aria-label="Xoá" onClick={() => upd((c) => c.box.splice(i, 1))}>
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="panel">
          <div className="panel-h">
            <h2>Rãnh chữ U</h2>
            <button className="btn sm" onClick={() => upd((c) => c.ditch.push({ b: 400, h: 400, t: 100, chamfer: 50 }))}>
              + Thêm
            </button>
          </div>
          <table className="grid">
            <thead>
              <tr>
                <th>B</th>
                <th>H</th>
                <th>Dày</th>
                <th>Vát</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cat.ditch.map((r, i) => (
                <tr key={i}>
                  <td>
                    <NumCell v={r.b} w={58} onChange={(n) => upd((c) => (c.ditch[i].b = n))} />
                  </td>
                  <td>
                    <NumCell v={r.h} w={58} onChange={(n) => upd((c) => (c.ditch[i].h = n))} />
                  </td>
                  <td>
                    <NumCell v={r.t} w={52} onChange={(n) => upd((c) => (c.ditch[i].t = n))} />
                  </td>
                  <td>
                    <NumCell v={r.chamfer} w={52} onChange={(n) => upd((c) => (c.ditch[i].chamfer = n))} />
                  </td>
                  <td>
                    <button className="ibtn sm" aria-label="Xoá" onClick={() => upd((c) => c.ditch.splice(i, 1))}>
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="panel">
          <div className="panel-h">
            <h2>Thép hình (kg/m)</h2>
          </div>
          <table className="grid">
            <thead>
              <tr>
                <th>Loại</th>
                <th>KL riêng</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(project.angles).map(([k, v]) => (
                <tr key={k}>
                  <td className="l">{k}</td>
                  <td>
                    <NumCell v={v} onChange={(n) => actions.updateProject((p) => ((p.angles[k] = n), p))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
