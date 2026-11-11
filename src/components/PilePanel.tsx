import React from 'react';
import {
  pileDefaults,
  pileNewLayer,
  BORED_METHOD_LABEL,
  type EngineProject,
} from '../engine';
import { useAppStore } from '../state/appStore';
import type { PileClayType, PileConfig, PileSandGrain, PileSoilKind } from '../types/project';
import { CellNum, NumField, OptNumField, SelField, TxtField } from './FieldControls';
import { Icon } from './Icon';

const KIND_LABEL: Array<[PileSoilKind, string]> = [
  ['clay', 'Đất dính'],
  ['sand', 'Đất rời'],
  ['rock', 'Đá'],
];

const GRAIN_LABEL: Array<[PileSandGrain, string]> = [
  ['gravelly', 'Cát lẫn sỏi sạn'],
  ['coarse', 'Cát thô'],
  ['medium', 'Cát vừa'],
  ['fine', 'Cát mịn'],
  ['silt', 'Cát bụi'],
];

const CLAY_LABEL: Array<[PileClayType, string]> = [
  ['sandy', 'Cát pha'],
  ['loam', 'Sét pha'],
  ['clay', 'Sét'],
];

const BORED_OPTIONS = Object.entries(BORED_METHOD_LABEL) as Array<[string, string]>;

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
          Mô đun mở rộng: khai báo cọc, địa tầng nhiều lớp; tính sức chịu tải dọc trục và phản lực đầu
          cọc theo TCVN 10304:2025. Khi tắt, mọi kết quả của tường giữ nguyên.
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
            ['rc', 'Tròn đặc đúc sẵn'],
            ['phc', 'Ly tâm ứng lực trước (PHC/PC)'],
            ['bored', 'Khoan nhồi'],
          ]}
        />
        <NumField
          path="pile.size"
          label={q.type === 'sq' ? 'Cạnh tiết diện' : q.type === 'phc' ? 'Đường kính ngoài' : 'Đường kính'}
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
            {q.method !== 'test' && l.kind === 'sand' ? (
              <div className="pgrid pgrid2">
                <label className="pcell">
                  <span>Loại hạt cát</span>
                  <select
                    value={l.grain}
                    aria-label={`Loại hạt – lớp ${i + 1}`}
                    onChange={(e) =>
                      mutLayer(l.id, (x) => {
                        x.grain = e.target.value as PileSandGrain;
                      })
                    }
                  >
                    {GRAIN_LABEL.map(([k, t]) => (
                      <option key={k} value={k}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
            {q.method !== 'test' && l.kind === 'clay' ? (
              <div className="pgrid pgrid2">
                <label className="pcell">
                  <span>Loại đất dính</span>
                  <select
                    value={l.clayType}
                    aria-label={`Loại đất dính – lớp ${i + 1}`}
                    onChange={(e) =>
                      mutLayer(l.id, (x) => {
                        x.clayType = e.target.value as PileClayType;
                      })
                    }
                  >
                    {CLAY_LABEL.map(([k, t]) => (
                      <option key={k} value={k}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
            {q.method === 'tcvn' ? (
              <div className="pgrid pgrid2">
                <label className="pcell">
                  <span>Hệ số hiệu chỉnh fi</span>
                  <CellNum
                    value={l.kf}
                    step={0.05}
                    ariaLabel={`Hệ số fi – lớp ${i + 1}`}
                    onCommit={(v) =>
                      mutLayer(l.id, (x) => {
                        if (v != null && v > 0) x.kf = v;
                      })
                    }
                  />
                </label>
                <label className="pcell">
                  <span>Hệ số hiệu chỉnh qb</span>
                  <CellNum
                    value={l.kb}
                    step={0.05}
                    ariaLabel={`Hệ số qb – lớp ${i + 1}`}
                    onCommit={(v) =>
                      mutLayer(l.id, (x) => {
                        if (v != null && v > 0) x.kb = v;
                      })
                    }
                  />
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

      <div className="pgrp" data-grp="design">
        <div className="pgrp-h">Sức chịu tải – TCVN 10304:2025</div>
        <SelField
          path="pile.method"
          label="Phương pháp"
          stack
          options={[
            ['tcvn', 'Theo chỉ tiêu cơ lý (Điều 7.2 – bảng tra tự động)'],
            ['spt', 'Theo SPT (Phụ lục D)'],
            ['test', 'Nhập sức chịu tải từ thí nghiệm'],
          ]}
        />
        <SelField
          path="pile.design.cls"
          label="Cấp công trình (γn)"
          stack
          options={[
            ['C1', 'Cấp 1 – γn = 1,00'],
            ['C2', 'Cấp 2 – γn = 1,15'],
            ['C3', 'Cấp 3 – γn = 1,20'],
          ]}
        />
        <NumField path="pile.design.z0" label="Đáy đài cách mặt đất tự nhiên" unit="m" min={0} max={30} step={0.1} />
        {q.method === 'test' ? (
          <>
            <OptNumField path="pile.Qtest" label="Sức chịu tải giới hạn của một cọc" unit="kN" step={10} min={0} />
            <SelField
              path="pile.design.testKind"
              label="Loại thí nghiệm (γk)"
              stack
              options={[
                ['static', 'Nén tĩnh'],
                ['dynElastic', 'Động, có xét biến dạng đàn hồi'],
                ['dynNoElastic', 'Động, không xét biến dạng đàn hồi'],
              ]}
            />
          </>
        ) : null}
        {q.method === 'tcvn' && q.type !== 'bored' ? (
          <SelField
            path="pile.design.install"
            label="Phương pháp hạ cọc (γR)"
            stack
            options={[
              ['hammer', 'Đóng bằng búa'],
              ['press', 'Ép'],
              ['custom', 'Nhập hệ số'],
            ]}
          />
        ) : null}
        {q.method === 'tcvn' && q.type !== 'bored' && q.design.install === 'custom' ? (
          <>
            <NumField path="pile.design.gRR" label="γR,R dưới mũi" min={0.1} max={2} step={0.05} />
            <NumField path="pile.design.gRf" label="γR,f thân cọc" min={0.1} max={2} step={0.05} />
          </>
        ) : null}
        {q.method === 'tcvn' && q.type === 'bored' ? (
          <SelField path="pile.design.bored" label="Phương pháp thi công (Bảng 6)" stack options={BORED_OPTIONS} />
        ) : null}
        {q.method === 'tcvn' && q.type === 'bored' ? (
          <label className="chk">
            <input
              type="checkbox"
              checked={q.design.srLow}
              data-path="pile.design.srLow"
              onChange={(e) =>
                updateProject((d) => {
                  if (d.pile) d.pile.design.srLow = e.target.checked;
                })
              }
            />
            {' Mũi cọc tựa đất sét có Sr < 0,85 (γc = 0,8)'}
          </label>
        ) : null}
        {q.type === 'phc' ? (
          <label className="chk">
            <input
              type="checkbox"
              checked={q.design.tipClosed}
              data-path="pile.design.tipClosed"
              onChange={(e) =>
                updateProject((d) => {
                  if (d.pile) d.pile.design.tipClosed = e.target.checked;
                })
              }
            />
            {' Cọc có mũi thép kín'}
          </label>
        ) : null}
        <label className="chk">
          <input
            type="checkbox"
            checked={q.design.selfWeight}
            data-path="pile.design.selfWeight"
            onChange={(e) =>
              updateProject((d) => {
                if (d.pile) d.pile.design.selfWeight = e.target.checked;
              })
            }
          />
          {' Kể trọng lượng bản thân cọc vào tải tác dụng'}
        </label>
        <div className="hint">
          Các bảng tra qb, fi (Bảng 2, 3, 6, 7, 8 và Phụ lục D) được nhúng sẵn và tự tra theo từng lớp
          đất: độ sâu tính từ mặt đất tự nhiên, nội suy tuyến tính theo độ sâu và độ sệt IL. Tải trọng lấy
          từ các tổ hợp của tường theo TCVN 11823 (đã nhân hệ số), sức kháng của cọc theo TCVN 10304.
        </div>
      </div>

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
