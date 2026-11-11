import React from 'react';
import {
  pileDefaults,
  pileNewLayer,
  pileNewRow,
  type EngineProject,
} from '../engine';
import { useAppStore } from '../state/appStore';
import type { PileConfig, PileSoilKind } from '../types/project';
import { CellNum, NumField, OptNumField, SelField, TxtField } from './FieldControls';
import { Icon } from './Icon';

const KIND_LABEL: Array<[PileSoilKind, string]> = [
  ['clay', 'Đất dính'],
  ['sand', 'Đất rời'],
  ['rock', 'Đá'],
];

type LayerNumKey = 'thk' | 'gamma' | 'c' | 'phi' | 'Su' | 'IL' | 'N' | 'E';

const LAYER_FIELDS: Array<[LayerNumKey, string, number]> = [
  ['thk', 'Dày (m)', 0.5],
  ['gamma', 'γ (kN/m³)', 0.5],
  ['c', 'c (kPa)', 1],
  ['phi', 'φ (độ)', 1],
  ['Su', 'Su (kPa)', 1],
  ['IL', 'IL', 0.05],
  ['N', 'SPT N', 1],
  ['E', 'E (MPa)', 1],
];

/** Bảng tra nhập tay (hàng = độ sâu z, cột = nhóm đất). */
const LookupEditor: React.FC<{
  which: 'fi' | 'qb';
  title: string;
  hint: string;
}> = ({ which, title, hint }) => {
  const { project, updateProject } = useAppStore();
  const q = project.pile as PileConfig;
  const t = q[which];

  const mut = (f: (tb: PileConfig['fi']) => void) =>
    updateProject((d) => {
      if (d.pile) f(d.pile[which]);
    });

  return (
    <div className="pgrp" data-table={which}>
      <div className="pgrp-h">{title}</div>
      <div className="hint">{hint}</div>
      <div className="ptab">
        <table className="rb">
          <thead>
            <tr>
              <th>z (m)</th>
              {t.cols.map((c, ci) => (
                <th key={ci}>
                  <input
                    type="text"
                    value={c}
                    aria-label={`Tên cột ${ci + 1}`}
                    onChange={(e) =>
                      mut((tb) => {
                        tb.cols[ci] = e.target.value;
                      })
                    }
                  />
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {t.rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <CellNum
                    value={r.z}
                    step={0.5}
                    ariaLabel="Độ sâu z"
                    onCommit={(v) =>
                      mut((tb) => {
                        const row = tb.rows.find((x) => x.id === r.id);
                        if (row && v != null) row.z = v;
                      })
                    }
                  />
                </td>
                {t.cols.map((_, ci) => (
                  <td key={ci}>
                    <CellNum
                      value={r.v[ci]}
                      nullable
                      step={1}
                      ariaLabel={`Giá trị cột ${ci + 1}`}
                      onCommit={(v) =>
                        mut((tb) => {
                          const row = tb.rows.find((x) => x.id === r.id);
                          if (row) row.v[ci] = v;
                        })
                      }
                    />
                  </td>
                ))}
                <td>
                  <button
                    type="button"
                    className="pbtn"
                    aria-label="Xóa hàng"
                    title="Xóa hàng"
                    onClick={() =>
                      mut((tb) => {
                        tb.rows = tb.rows.filter((x) => x.id !== r.id);
                      })
                    }
                  >
                    <Icon name="close" size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="prow2">
        <button
          type="button"
          onClick={() =>
            mut((tb) => {
              const last = tb.rows[tb.rows.length - 1];
              tb.rows.push(pileNewRow(tb.cols.length, last ? last.z + 2 : 1));
            })
          }
        >
          <Icon name="plus" size={13} /> Hàng
        </button>
        <button
          type="button"
          onClick={() =>
            mut((tb) => {
              tb.cols.push(`Cột ${tb.cols.length + 1}`);
              tb.rows.forEach((r) => r.v.push(null));
            })
          }
        >
          <Icon name="plus" size={13} /> Cột
        </button>
        <button
          type="button"
          disabled={t.cols.length <= 1}
          onClick={() =>
            mut((tb) => {
              tb.cols.pop();
              tb.rows.forEach((r) => r.v.pop());
            })
          }
        >
          <Icon name="minus" size={13} /> Cột
        </button>
      </div>
    </div>
  );
};

export const PilePanel: React.FC = () => {
  const { project, updateProject } = useAppStore();
  const q = (project as EngineProject).pile;
  const on = Boolean(q && q.on);

  const toggle = (checked: boolean) =>
    updateProject((d) => {
      if (checked) {
        if (!d.pile) d.pile = pileDefaults();
        d.pile.on = true;
      } else if (d.pile) {
        d.pile.on = false;
      }
    });

  const toggleBox = (
    <label className="chk">
      <input type="checkbox" checked={on} data-path="pile.on" onChange={(e) => toggle(e.target.checked)} />
      {' Dùng móng cọc BTCT dưới bản đáy tường'}
    </label>
  );

  if (!q || !on) {
    return (
      <>
        {toggleBox}
        <div className="hint">
          Mô đun mở rộng: khai báo cọc, địa tầng nhiều lớp và bảng tra; mô phỏng và kiểm toán cọc
          thêm vào ở các bước sau. Khi tắt, mọi kết quả của tường giữ nguyên.
        </div>
      </>
    );
  }

  const layers = q.layers;
  const sumThk = layers.reduce((s, l) => s + (l.thk || 0), 0);
  const colOpts = (cols: string[]): Array<[number, string]> => [
    [-1, '— chưa chọn —'],
    ...cols.map((c, i) => [i, c || `Cột ${i + 1}`] as [number, string]),
  ];

  const mutLayer = (id: string, f: (l: PileConfig['layers'][number]) => void) =>
    updateProject((d) => {
      const l = d.pile?.layers.find((x) => x.id === id);
      if (l) f(l);
    });

  return (
    <>
      {toggleBox}

      <div className="pgrp">
        <div className="pgrp-h">Cọc</div>
        <SelField
          path="pile.type"
          label="Loại cọc"
          stack
          options={[
            ['sq', 'Vuông đúc sẵn'],
            ['phc', 'Ly tâm ứng lực trước (PHC/PC)'],
            ['bored', 'Khoan nhồi'],
          ]}
        />
        <NumField
          path="pile.size"
          label={q.type === 'sq' ? 'Cạnh tiết diện' : 'Đường kính ngoài'}
          unit="m"
          min={0.2}
          max={3}
          step={0.05}
        />
        {q.type === 'phc' ? (
          <NumField path="pile.wall" label="Bề dày thành ống" unit="m" min={0.05} max={0.3} step={0.01} />
        ) : null}
        <NumField path="pile.L" label="Chiều dài cọc dưới đáy đài" unit="m" min={1} max={80} step={0.5} />
        <NumField path="pile.embed" label="Đoạn cọc ngàm vào đài" unit="m" min={0} max={1} step={0.05} />
        <TxtField path="pile.concrete" label="Mác bê tông" />
        <TxtField path="pile.steel" label="Cấp thép" />
        <NumField path="pile.cover" label="Lớp bê tông bảo vệ" unit="mm" min={20} max={100} step={5} />
      </div>

      {q.type !== 'phc' ? (
        <div className="pgrp" data-grp="cage">
          <div className="pgrp-h">Lồng thép cọc</div>
          <NumField path="pile.cage.nMain" label="Số thanh thép dọc" unit="thanh" min={4} max={40} step={1} />
          <NumField path="pile.cage.dMain" label="Đường kính thép dọc" unit="mm" min={10} max={40} step={2} />
          <NumField path="pile.cage.dHoop" label="Đường kính đai / xoắn" unit="mm" min={6} max={20} step={1} />
          <NumField path="pile.cage.Lend" label="Chiều dài vùng đai dày mỗi đầu" unit="m" min={0} max={10} step={0.1} />
          <NumField path="pile.cage.sEnd" label="Bước đai vùng đầu cọc" unit="m" min={0.03} max={0.5} step={0.01} />
          <NumField path="pile.cage.sMid" label="Bước đai đoạn giữa" unit="m" min={0.05} max={0.5} step={0.01} />
          <NumField path="pile.cage.hook" label="Móc neo mỗi đai (cộng vào chiều dài)" unit="mm" min={0} max={400} step={10} />
          <div className="hint">
            Số liệu lồng thép là dữ liệu nhập để dựng bản vẽ, mô hình 3D và thống kê khối lượng; việc kiểm
            tra khả năng chịu lực của cọc làm ở giai đoạn sau.
          </div>
        </div>
      ) : (
        <div className="hint">Cọc ly tâm là sản phẩm chế tạo sẵn: không vẽ lồng thép rời và không thống kê thép.</div>
      )}

      <div className="pgrp">
        <div className="pgrp-h">Bố trí cọc dưới bản đáy</div>
        <NumField path="pile.nx" label="Số hàng theo phương ngang (mũi → gót)" unit="hàng" min={1} max={12} step={1} />
        {q.nx > 1 ? (
          <NumField path="pile.sx" label="Khoảng cách giữa các hàng" unit="m" min={0.3} max={10} step={0.05} />
        ) : null}
        <label className="chk">
          <input
            type="checkbox"
            checked={q.centered}
            data-path="pile.centered"
            onChange={(e) =>
              updateProject((d) => {
                if (d.pile) d.pile.centered = e.target.checked;
              })
            }
          />
          {' Căn các hàng cọc vào giữa bề rộng bản đáy'}
        </label>
        {!q.centered ? (
          <NumField path="pile.x0" label="Hàng đầu cách mép mũi bản đáy" unit="m" min={0} max={20} step={0.05} />
        ) : null}
        <NumField path="pile.sy" label="Bước cọc dọc theo chiều dài tường" unit="m" min={0.3} max={10} step={0.05} />
        <label className="chk">
          <input
            type="checkbox"
            checked={q.stagger}
            data-path="pile.stagger"
            onChange={(e) =>
              updateProject((d) => {
                if (d.pile) d.pile.stagger = e.target.checked;
              })
            }
          />
          {' Bố trí so le giữa các hàng'}
        </label>
      </div>

      <div className="pgrp">
        <div className="pgrp-h">Địa tầng (độ sâu tính từ đáy bản đáy)</div>
        {layers.map((l, i) => (
          <div className="player" key={l.id} data-layer={l.id}>
            <div className="player-h">
              <span className="sn">{i + 1}</span>
              <input
                type="text"
                value={l.name}
                aria-label="Tên lớp đất"
                onChange={(e) =>
                  mutLayer(l.id, (x) => {
                    x.name = e.target.value;
                  })
                }
              />
              <select
                value={l.kind}
                aria-label="Loại đất"
                onChange={(e) =>
                  mutLayer(l.id, (x) => {
                    x.kind = e.target.value as PileSoilKind;
                  })
                }
              >
                {KIND_LABEL.map(([k, t]) => (
                  <option key={k} value={k}>
                    {t}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="pbtn"
                aria-label="Xóa lớp đất"
                title="Xóa lớp đất"
                disabled={layers.length <= 1}
                onClick={() =>
                  updateProject((d) => {
                    if (d.pile) d.pile.layers = d.pile.layers.filter((x) => x.id !== l.id);
                  })
                }
              >
                <Icon name="close" size={13} />
              </button>
            </div>
            <div className="pgrid">
              {LAYER_FIELDS.map(([key, label, step]) => (
                <label className="pcell" key={key}>
                  <span>{label}</span>
                  <CellNum
                    value={l[key]}
                    step={step}
                    ariaLabel={`${label} – lớp ${i + 1}`}
                    onCommit={(v) =>
                      mutLayer(l.id, (x) => {
                        if (v != null) x[key] = v;
                      })
                    }
                  />
                </label>
              ))}
            </div>
            {q.method === 'tcvn' ? (
              <div className="pgrid pgrid2">
                <label className="pcell">
                  <span>Cột bảng fi</span>
                  <select
                    value={l.fiCol}
                    onChange={(e) =>
                      mutLayer(l.id, (x) => {
                        x.fiCol = parseInt(e.target.value, 10);
                      })
                    }
                  >
                    {colOpts(q.fi.cols).map(([v, t]) => (
                      <option key={v} value={v}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="pcell">
                  <span>Cột bảng qb</span>
                  <select
                    value={l.qbCol}
                    onChange={(e) =>
                      mutLayer(l.id, (x) => {
                        x.qbCol = parseInt(e.target.value, 10);
                      })
                    }
                  >
                    {colOpts(q.qb.cols).map(([v, t]) => (
                      <option key={v} value={v}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
          </div>
        ))}
        <button
          type="button"
          className="wide"
          onClick={() =>
            updateProject((d) => {
              if (d.pile) d.pile.layers.push(pileNewLayer({ name: `Lớp ${d.pile.layers.length + 1}` }));
            })
          }
        >
          <Icon name="plus" size={13} /> Thêm lớp đất
        </button>
        <div className={'calc' + (sumThk < q.L ? ' pwarn' : '')} id="pileSum">
          {`Tổng chiều dày các lớp = ${sumThk.toFixed(1).replace('.', ',')} m · chiều dài cọc = ${q.L
            .toFixed(1)
            .replace('.', ',')} m`}
          {sumThk < q.L ? ' – địa tầng chưa phủ hết chiều dài cọc' : ''}
        </div>
      </div>

      <div className="pgrp">
        <div className="pgrp-h">Phương pháp xác định sức chịu tải</div>
        <SelField
          path="pile.method"
          label="Phương pháp"
          stack
          options={[
            ['tcvn', 'TCVN 10304:2014 – theo chỉ tiêu cơ lý (bảng tra nhập tay)'],
            ['spt', 'Theo SPT (hệ số nhập tay)'],
            ['test', 'Nhập sức chịu tải từ thí nghiệm'],
          ]}
        />
        {q.method === 'test' ? (
          <OptNumField path="pile.Qtest" label="Sức chịu tải giới hạn của một cọc" unit="kN" step={10} min={0} />
        ) : null}
        {q.method === 'tcvn' ? (
          <>
            <OptNumField path="pile.coef.gc" label="Hệ số điều kiện làm việc của cọc γc" step={0.05} min={0} />
            <OptNumField path="pile.coef.gcq" label="Hệ số điều kiện làm việc dưới mũi γcq" step={0.05} min={0} />
            <OptNumField path="pile.coef.gcf" label="Hệ số điều kiện làm việc thân cọc γcf" step={0.05} min={0} />
          </>
        ) : null}
        {q.method === 'spt' ? (
          <>
            <OptNumField path="pile.spt.ksSand" label="Ma sát hông đất rời = ks × N" unit="kPa/búa" step={0.5} min={0} />
            <OptNumField path="pile.spt.ksClay" label="Ma sát hông đất dính = ks × N" unit="kPa/búa" step={0.5} min={0} />
            <OptNumField path="pile.spt.kbSand" label="Sức kháng mũi đất rời = kb × N" unit="kPa/búa" step={10} min={0} />
            <OptNumField path="pile.spt.kbClay" label="Sức kháng mũi đất dính = kb × N" unit="kPa/búa" step={10} min={0} />
            <OptNumField path="pile.spt.fsMax" label="Giới hạn ma sát hông" unit="kPa" step={5} min={0} />
            <OptNumField path="pile.spt.qbMax" label="Giới hạn sức kháng mũi" unit="kPa" step={100} min={0} />
          </>
        ) : null}
        <OptNumField path="pile.coef.gk" label="Hệ số an toàn theo đất γk" step={0.05} min={0} />
        <div className="hint">
          Ứng dụng không tự điền số liệu tra bảng của tiêu chuẩn: ô để trống nghĩa là chưa nhập và
          phần tính sức chịu tải sẽ báo thiếu số liệu thay vì cho kết quả.
        </div>
      </div>

      {q.method === 'tcvn' ? (
        <>
          <LookupEditor
            which="fi"
            title="Bảng ma sát hông fi (kPa)"
            hint="Mỗi hàng là một độ sâu trung bình z của lớp đất (m, tính từ mặt đất theo bảng tiêu chuẩn); mỗi cột là một nhóm đất / độ sệt. Giá trị được nội suy theo z."
          />
          <LookupEditor
            which="qb"
            title="Bảng sức kháng mũi qb (kPa)"
            hint="Mỗi hàng là độ sâu mũi cọc z (m); mỗi cột là một nhóm đất dưới mũi. Giá trị được nội suy theo z."
          />
        </>
      ) : null}

      <label className="chk">
        <input
          type="checkbox"
          checked={q.ignoreShallow}
          data-path="pile.ignoreShallow"
          onChange={(e) =>
            updateProject((d) => {
              if (d.pile) d.pile.ignoreShallow = e.target.checked;
            })
          }
        />
        {' Coi kiểm tra sức kháng nền nông và trượt đáy móng chỉ là tham khảo khi dùng cọc'}
      </label>
    </>
  );
};
