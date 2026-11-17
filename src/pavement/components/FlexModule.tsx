import { Fragment, useMemo } from 'react';
import {
  CAP_DUONG_38_OPTIONS,
  FLEX_FORMULAS,
  F_TYPES,
  LOAI_MAT_38_OPTIONS,
  RELIABILITY_38_OPTIONS,
  fmt,
  fmtExp,
  fmtI,
  type FlexFormState,
  type FlexLayer,
  type FlexMaterialType,
  type FlexReliability,
  type FlexResolvedInput,
  type FlexRoadClass,
  type FlexSurfaceGrade,
  type FlexTC1Result,
  type FlexTC2Row,
  type FlexTC3Row,
  type FlexVehicleRow,
} from '../engine';
import { PavementSectionSvg, type SectionLayerItem } from './PavementSectionSvg';

interface FlexModuleProps {
  visible: boolean;
  state: FlexFormState;
  resolved: FlexResolvedInput;
  tc1: FlexTC1Result;
  tc2: FlexTC2Row[];
  tc3: FlexTC3Row[];
  onChange: (next: FlexFormState) => void;
}

export function FlexModule({ visible, state, resolved, tc1, tc2, tc3, onChange }: FlexModuleProps) {
  const sectionLayers: SectionLayerItem[] = useMemo(
    () =>
      resolved.layers.map((l) => {
        const g = F_TYPES[l.type].group;
        return {
          name: l.name,
          thicknessCm: l.h,
          mat: g === 'mat' ? 'concrete' : g === 'mong' ? 'bound' : 'gran',
          detailText: `h=${fmt(l.h, 0)} cm · E=${fmtI(l.Ev)} MPa`,
        };
      }),
    [resolved.layers],
  );

  const updateLayer = (idx: number, patch: Partial<FlexLayer>) => {
    const nextLayers = state.layers.map((l, i) => (i === idx ? { ...l, ...patch } : l));
    onChange({ ...state, layers: nextLayers });
  };

  const updateVeh = (idx: number, patch: Partial<FlexVehicleRow>) => {
    const nextVeh = state.vehicles.map((v, i) => (i === idx ? { ...v, ...patch } : v));
    onChange({ ...state, vehicles: nextVeh });
  };

  const okAll = tc1.pass && tc2.every((r) => r.pass) && tc3.every((r) => r.pass);

  const vcard = (tt: string, eq: string, lhs: number, op: string, rhs: number, pass: boolean, unit = 'MPa') => (
    <div className={`vcard ${pass ? 'pass' : 'fail'}`} key={tt}>
      <span className="tag">{pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}</span>
      <div className="vt">{tt}</div>
      <div className="veq">{eq}</div>
      <div className="vres">
        <span className="lhs">{fmt(lhs, 3)}</span>
        <span className="op">{op}</span>
        <span className="rhs">{fmt(rhs, 3)}</span>
        <span className="op" style={{ fontSize: '11px' }}>
          {unit}
        </span>
      </div>
    </div>
  );

  return (
    <div className="module" id="mod-flex" hidden={!visible}>
      <div className="wrap">
        <aside className="inputs" id="f_inputs">
          <div className="grp">
            <div className="gh">
              <span className="num">1</span>
              <h3>Cấp hạng &amp; tải trọng tiêu chuẩn</h3>
            </div>
            <div className="gb">
              <div className="fld full">
                <label>
                  Cấp đường <span className="sub">(Bảng 10)</span>
                </label>
                <select
                  id="f_capduong"
                  value={state.capduong}
                  onChange={(e) => onChange({ ...state, capduong: e.target.value as FlexRoadClass })}
                >
                  {CAP_DUONG_38_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fld full">
                <label>
                  Loại tầng mặt <span className="sub">(Bảng 2, 9, 10)</span>
                </label>
                <select
                  id="f_loaimat"
                  value={state.loaimat}
                  onChange={(e) => onChange({ ...state, loaimat: e.target.value as FlexSurfaceGrade })}
                >
                  {LOAI_MAT_38_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fld full">
                <label>
                  Độ tin cậy thiết kế <span className="sub">(Bảng 7, 8)</span>
                </label>
                <select
                  id="f_dotincay"
                  value={state.dotincay}
                  onChange={(e) => onChange({ ...state, dotincay: e.target.value as FlexReliability })}
                >
                  {RELIABILITY_38_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fld full">
                <label>
                  Tải trọng trục tiêu chuẩn <span className="sub">(Bảng 6)</span>
                </label>
                <select
                  id="f_Ptt"
                  value={String(state.Ptt)}
                  onChange={(e) => onChange({ ...state, Ptt: parseInt(e.target.value, 10) === 120 ? 120 : 100 })}
                >
                  <option value="100">100 kN (p=0,6 MPa; D=33 cm)</option>
                  <option value="120">120 kN (p=0,6 MPa; D=36 cm)</option>
                </select>
              </div>
              <div className="hint">
                Với tầng mặt cấp thấp B1/B2, tiêu chuẩn kéo uốn (TC2) và cắt trượt (TC3) không bắt buộc kiểm tra (Điều 9.1.4.3)
                – ứng dụng sẽ tự đánh dấu &quot;Không xét&quot;.
              </div>
            </div>
          </div>

          <div className="grp">
            <div className="gh">
              <span className="num">2</span>
              <h3>Các lớp kết cấu (từ trên xuống)</h3>
            </div>
            <div className="gb">
              <div className="hint">
                Mỗi lớp cần 3 trị số mô đun tính toán riêng cho từng tiêu chuẩn (Điều 9.1.5): tính võng, tính trượt (thường ~30 °C)
                và tính kéo uốn (BTN ở 10–15 °C nên cao hơn). Vật liệu hạt rời không kiểm tra kéo uốn.
              </div>
              <div id="f_layerList">
                {state.layers.map((l, i) => {
                  const isRoi = l.type === 'hatroi';
                  return (
                    <div className="lrow" key={i}>
                      {state.layers.length > 1 && (
                        <button
                          className="lx"
                          data-fdel={i}
                          type="button"
                          title="Xóa lớp"
                          onClick={() =>
                            onChange({
                              ...state,
                              layers: state.layers.filter((_, idx) => idx !== i),
                              shearManual: {},
                            })
                          }
                        >
                          ×
                        </button>
                      )}
                      <div className="fld full">
                        <label>Lớp {i + 1} – Tên</label>
                        <input
                          data-fk="name"
                          data-fi={i}
                          type="text"
                          value={l.name}
                          onChange={(e) => updateLayer(i, { name: e.target.value })}
                        />
                      </div>
                      <div className="fld full">
                        <label>Loại vật liệu</label>
                        <select
                          data-fk="type"
                          data-fi={i}
                          value={l.type}
                          onChange={(e) => updateLayer(i, { type: e.target.value as FlexMaterialType })}
                        >
                          {Object.entries(F_TYPES).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="fld">
                        <label>h – chiều dày</label>
                        <input
                          data-fk="h"
                          data-fi={i}
                          type="number"
                          step="1"
                          value={l.h}
                          onChange={(e) => updateLayer(i, { h: parseFloat(e.target.value) || 0 })}
                        />
                        <span className="u">cm</span>
                      </div>
                      <div className="fld">
                        <label>E – tính võng</label>
                        <input
                          data-fk="Ev"
                          data-fi={i}
                          type="number"
                          step="10"
                          value={l.Ev}
                          onChange={(e) => updateLayer(i, { Ev: parseFloat(e.target.value) || 0 })}
                        />
                        <span className="u">MPa</span>
                      </div>
                      <div className="fld">
                        <label>E – tính trượt</label>
                        <input
                          data-fk="Et"
                          data-fi={i}
                          type="number"
                          step="10"
                          value={l.Et}
                          onChange={(e) => updateLayer(i, { Et: parseFloat(e.target.value) || 0 })}
                        />
                        <span className="u">MPa</span>
                      </div>
                      <div className="fld">
                        <label>
                          E – tính kéo uốn <span className="sub">(hạt rời: lấy = E-võng)</span>
                        </label>
                        <input
                          data-fk="Ek"
                          data-fi={i}
                          type="number"
                          step="10"
                          value={l.Ek}
                          onChange={(e) => updateLayer(i, { Ek: parseFloat(e.target.value) || 0 })}
                        />
                        <span className="u">MPa</span>
                      </div>
                      <div className="fld">
                        <label>
                          R<sub>ku</sub> – kéo uốn GH
                        </label>
                        <input
                          data-fk="Rku"
                          data-fi={i}
                          type="number"
                          step="0.1"
                          value={l.Rku}
                          disabled={isRoi}
                          onChange={(e) => updateLayer(i, { Rku: parseFloat(e.target.value) || 0 })}
                        />
                        <span className="u">MPa</span>
                      </div>
                      <div className="fld">
                        <label>
                          C – lực dính <span className="sub">(nếu hạt rời)</span>
                        </label>
                        <input
                          data-fk="C"
                          data-fi={i}
                          type="number"
                          step="0.001"
                          value={l.C}
                          onChange={(e) => updateLayer(i, { C: parseFloat(e.target.value) || 0 })}
                        />
                        <span className="u">MPa</span>
                      </div>
                      <div className="fld">
                        <label>
                          φ – ma sát <span className="sub">(nếu hạt rời)</span>
                        </label>
                        <input
                          data-fk="phi"
                          data-fi={i}
                          type="number"
                          step="1"
                          value={l.phi}
                          onChange={(e) => updateLayer(i, { phi: parseFloat(e.target.value) || 0 })}
                        />
                        <span className="u">độ</span>
                      </div>
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '12px',
                          color: 'var(--muted)',
                          padding: '4px 0',
                        }}
                      >
                        <input
                          type="checkbox"
                          data-fk="shear"
                          data-fi={i}
                          checked={l.shear}
                          disabled={!isRoi}
                          onChange={(e) => updateLayer(i, { shear: e.target.checked })}
                        />
                        Kiểm tra cắt trượt (TC3) tại đỉnh lớp này{' '}
                        {!isRoi && <span className="sub">(chỉ áp dụng cho vật liệu hạt rời)</span>}
                      </label>
                    </div>
                  );
                })}
              </div>
              <button
                className="addbtn"
                id="f_addLayer"
                type="button"
                onClick={() =>
                  onChange({
                    ...state,
                    layers: [
                      ...state.layers,
                      {
                        name: `Lớp ${state.layers.length + 1}`,
                        type: 'hatroi',
                        h: 15,
                        Ev: 200,
                        Et: 200,
                        Ek: 200,
                        Rku: 0,
                        C: 0.02,
                        phi: 30,
                        shear: false,
                      },
                    ],
                    shearManual: {},
                  })
                }
              >
                + Thêm lớp kết cấu
              </button>
            </div>
          </div>

          <div className="grp">
            <div className="gh">
              <span className="num">3</span>
              <h3>Nền đất (khu vực tác dụng)</h3>
            </div>
            <div className="gb">
              <div className="fld">
                <label>
                  E<sub>0</sub> – tính độ võng
                </label>
                <input
                  id="f_E0v"
                  type="number"
                  step="1"
                  value={state.E0v}
                  onChange={(e) => onChange({ ...state, E0v: parseFloat(e.target.value) || 0 })}
                />
                <span className="u">MPa</span>
              </div>
              <div className="fld">
                <label>
                  E<sub>0</sub> – tính cắt trượt
                </label>
                <input
                  id="f_E0t"
                  type="number"
                  step="1"
                  value={state.E0t}
                  onChange={(e) => onChange({ ...state, E0t: parseFloat(e.target.value) || 0 })}
                />
                <span className="u">MPa</span>
              </div>
              <div className="fld">
                <label>C – lực dính tính toán</label>
                <input
                  id="f_C0"
                  type="number"
                  step="0.001"
                  value={state.C0}
                  onChange={(e) => onChange({ ...state, C0: parseFloat(e.target.value) || 0 })}
                />
                <span className="u">MPa</span>
              </div>
              <div className="fld">
                <label>φ – góc nội ma sát</label>
                <input
                  id="f_phi0"
                  type="number"
                  step="1"
                  value={state.phi0}
                  onChange={(e) => onChange({ ...state, phi0: parseFloat(e.target.value) || 0 })}
                />
                <span className="u">độ</span>
              </div>
              <div className="fld full">
                <label>
                  Loại đất nền <span className="sub">(hệ số k₃, Điều 9.3.4)</span>
                </label>
                <select
                  id="f_k3_0"
                  value={String(state.k3_0)}
                  onChange={(e) => onChange({ ...state, k3_0: parseFloat(e.target.value) || 1.5 })}
                >
                  <option value="1.5">Đất dính (sét, á sét, á cát) – k₃=1,5</option>
                  <option value="3">Cát nhỏ – k₃=3,0</option>
                  <option value="6">Cát trung – k₃=6,0</option>
                  <option value="7">Cát thô – k₃=7,0</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grp">
            <div className="gh">
              <span className="num">4</span>
              <h3>Giao thông – tính N (Phụ lục A)</h3>
            </div>
            <div className="gb">
              <div className="hint">
                Nhập từng loại xe với tải trọng trục trước/sau (kN) và lưu lượng ni (xe/ngày đêm, 2 chiều). Trục &lt; 25 kN tự động
                bỏ qua.
              </div>
              <div id="f_vehtbody">
                <table className="netbl">
                  <thead>
                    <tr>
                      <th>Loại xe</th>
                      <th>
                        P<sub>trước</sub>
                      </th>
                      <th>
                        P<sub>sau</sub>
                      </th>
                      <th>
                        m<sub>sau</sub>
                      </th>
                      <th>Bánh sau</th>
                      <th>K/c cụm (m)</th>
                      <th>
                        n<sub>i</sub>
                      </th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {state.vehicles.map((v, i) => (
                      <tr key={i}>
                        <td>
                          <input
                            data-vi={i}
                            data-vk="name"
                            type="text"
                            style={{ minWidth: '92px', textAlign: 'left' }}
                            value={v.name}
                            onChange={(e) => updateVeh(i, { name: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            data-vi={i}
                            data-vk="Pt"
                            type="number"
                            step="1"
                            value={v.Pt}
                            onChange={(e) => updateVeh(i, { Pt: parseFloat(e.target.value) || 0 })}
                          />
                        </td>
                        <td>
                          <input
                            data-vi={i}
                            data-vk="Ps"
                            type="number"
                            step="1"
                            value={v.Ps}
                            onChange={(e) => updateVeh(i, { Ps: parseFloat(e.target.value) || 0 })}
                          />
                        </td>
                        <td>
                          <input
                            data-vi={i}
                            data-vk="ms"
                            type="number"
                            step="1"
                            value={v.ms}
                            style={{ width: '34px' }}
                            onChange={(e) => updateVeh(i, { ms: parseFloat(e.target.value) || 0 })}
                          />
                        </td>
                        <td>
                          <select
                            data-vi={i}
                            data-vk="banh"
                            style={{ width: '60px', fontSize: '11px' }}
                            value={v.banh}
                            onChange={(e) => updateVeh(i, { banh: e.target.value === '4banh' ? '4banh' : 'doi' })}
                          >
                            <option value="doi">đôi</option>
                            <option value="4banh">4 bánh</option>
                          </select>
                        </td>
                        <td>
                          <input
                            data-vi={i}
                            data-vk="spacing"
                            type="number"
                            step="0.1"
                            value={v.spacing}
                            style={{ width: '44px' }}
                            onChange={(e) => updateVeh(i, { spacing: parseFloat(e.target.value) || 0 })}
                          />
                        </td>
                        <td>
                          <input
                            data-vi={i}
                            data-vk="ni"
                            type="number"
                            step="10"
                            value={v.ni}
                            onChange={(e) => updateVeh(i, { ni: parseFloat(e.target.value) || 0 })}
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {state.vehicles.length > 1 && (
                            <button
                              className="lx"
                              data-vdel={i}
                              type="button"
                              onClick={() =>
                                onChange({
                                  ...state,
                                  vehicles: state.vehicles.filter((_, idx) => idx !== i),
                                })
                              }
                            >
                              ×
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                className="smallbtn"
                id="f_addVeh"
                type="button"
                style={{ margin: '8px 0', width: '100%' }}
                onClick={() =>
                  onChange({
                    ...state,
                    vehicles: [
                      ...state.vehicles,
                      { name: 'Xe mới', Pt: 0, Ps: 0, ms: 1, banh: 'doi', spacing: 0, ni: 0 },
                    ],
                  })
                }
              >
                + Thêm loại xe
              </button>
              <div className="subhead">Quy đổi &amp; lưu lượng thiết kế</div>
              <div className="fld full">
                <label>Số liệu xe nhập là</label>
                <select
                  id="f_ntkloai"
                  value={state.ntkloai}
                  onChange={(e) => onChange({ ...state, ntkloai: e.target.value === 'dau' ? 'dau' : 'cuoi' })}
                >
                  <option value="cuoi">Năm cuối thời hạn thiết kế (A.3)</option>
                  <option value="dau">Năm đầu khai thác (A.2)</option>
                </select>
              </div>
              <div className="fld full">
                <label>
                  f<sub>L</sub> – hệ số phân bố làn <span className="sub">(Điều 7.9)</span>
                </label>
                <select
                  id="f_fL"
                  value={String(state.fL)}
                  onChange={(e) => onChange({ ...state, fL: parseFloat(e.target.value) || 0.55 })}
                >
                  <option value="1">1 làn xe – 1,0</option>
                  <option value="0.55">2–3 làn, không dải PC – 0,55</option>
                  <option value="0.35">4 làn, có dải PC – 0,35</option>
                  <option value="0.3">≥6 làn, có dải PC – 0,30</option>
                </select>
              </div>
              <div className="fld">
                <label>q – tăng trưởng xe hàng năm</label>
                <input
                  id="f_q"
                  type="number"
                  step="0.5"
                  value={state.q}
                  onChange={(e) => onChange({ ...state, q: parseFloat(e.target.value) || 0 })}
                />
                <span className="u">%</span>
              </div>
              <div className="fld">
                <label>t – thời hạn thiết kế chính</label>
                <input
                  id="f_t"
                  type="number"
                  step="1"
                  value={state.t}
                  onChange={(e) => onChange({ ...state, t: parseFloat(e.target.value) || 0 })}
                />
                <span className="u">năm</span>
              </div>
              <div className="neOut" id="f_neOut">
                N<sub>tk</sub> = <b>{fmtI(resolved.traf.Ntk)}</b> trục tiêu chuẩn/ngày đêm (2 chiều) · f<sub>L</sub>=
                {resolved.traf.fL}
                <br />
                <b>
                  N<sub>tt</sub> = {fmtI(resolved.traf.Ntt)}
                </b>{' '}
                trục/ngày đêm/làn (dùng tra Bảng 9) <br />
                <b>
                  N<sub>e</sub> = {fmtExp(resolved.traf.Ne, 3)}
                </b>{' '}
                trục tích lũy trong {fmt(resolved.traf.t, 0)} năm (dùng tính k₁ mỏi TC2)
              </div>
            </div>
          </div>
        </aside>

        <main className="results">
          <section className="rsec">
            <div className="rh">
              <span className="rn">A</span>
              <h2>Cắt ngang kết cấu áo đường mềm</h2>
            </div>
            <div className="sectionwrap">
              <div id="f_section">
                <PavementSectionSvg
                  idPrefix="f_"
                  layers={sectionLayers}
                  subgradeText={`E₀=${fmtI(resolved.E0v)} MPa`}
                  loadMode="ptt"
                  loadValueKn={resolved.traf.Ptt}
                  minH={26}
                  showTotalDim
                />
              </div>
            </div>
            <div className="cap">Hình vẽ tự cập nhật theo chiều dày và mô đun (tính võng) của các lớp.</div>
          </section>

          <section className="rsec">
            <div className="rh">
              <span className="rn">B</span>
              <h2>TC1 · Kiểm toán độ võng đàn hồi (Điều 9.2)</h2>
            </div>
            <div id="f_tc1out">
              <table className="calc" style={{ marginBottom: '12px' }}>
                <tbody>
                  <tr>
                    <td>
                      E<sub>tb</sub> quy đổi (Odemark, ct.5)
                    </td>
                    <td className="v">{fmt(tc1.red.Etb, 1)}</td>
                    <td className="u">MPa</td>
                    <td className="eq">(5)</td>
                  </tr>
                  <tr>
                    <td>H – tổng bề dày kết cấu</td>
                    <td className="v">{fmt(tc1.red.H, 1)}</td>
                    <td className="u">cm</td>
                    <td className="eq" />
                  </tr>
                  <tr>
                    <td>H/D · β</td>
                    <td className="v">
                      {fmt(tc1.red.HD, 3)} · {fmt(tc1.red.beta, 4)}
                    </td>
                    <td className="u">–</td>
                    <td className="eq">(6)/Bảng11</td>
                  </tr>
                  <tr className="hl">
                    <td>
                      E&apos;<sub>tb</sub> = β·E<sub>tb</sub>
                      {tc1.red.capped ? ' (khống chế ≤ max Eᵢ)' : ''}
                    </td>
                    <td className="v">{fmt(tc1.red.Etbc, 1)}</td>
                    <td className="u">MPa</td>
                    <td className="eq">(6)</td>
                  </tr>
                  <tr className="hl">
                    <td>
                      E<sub>ch</sub> (công thức E.1, tham khảo Hình 2)
                    </td>
                    <td className="v">{fmt(tc1.Ech, 1)}</td>
                    <td className="u">MPa</td>
                    <td className="eq">(E.1)</td>
                  </tr>
                  <tr>
                    <td>
                      E<sub>yc</sub> tra Bảng 9 / tối thiểu Bảng 10
                    </td>
                    <td className="v">
                      {fmt(tc1.EycTab, 0)} / {fmt(tc1.EycMin, 0)}
                    </td>
                    <td className="u">MPa</td>
                    <td className="eq">Bảng 9,10</td>
                  </tr>
                  <tr className="hl">
                    <td>
                      E<sub>yc</sub> dùng kiểm toán = max
                    </td>
                    <td className="v">{fmt(tc1.Eyc, 0)}</td>
                    <td className="u">MPa</td>
                    <td className="eq" />
                  </tr>
                  <tr>
                    <td>
                      K<sub>cd</sub>
                      <sup>dv</sup> (Bảng 8)
                    </td>
                    <td className="v">{fmt(tc1.Kdv, 2)}</td>
                    <td className="u">–</td>
                    <td className="eq">Bảng 8</td>
                  </tr>
                </tbody>
              </table>
              <div className="vgrid">
                {vcard('TC1 · Độ võng đàn hồi', 'E_ch ≥ K_cd^dv · E_yc  (4)', tc1.Ech, '≥', tc1.req, tc1.pass)}
              </div>
            </div>
          </section>

          <section className="rsec">
            <div className="rh">
              <span className="rn">C</span>
              <h2>TC2 · Kiểm toán kéo uốn ở đáy các lớp liền khối (Điều 9.4)</h2>
            </div>
            <div id="f_tc2out">
              {!tc2.length ? (
                <div className="hint" style={{ padding: '6px' }}>
                  Tầng mặt cấp thấp B1/B2 hoặc không có lớp liền khối nào – không yêu cầu kiểm tra TC2 (Điều 9.1.4.3).
                </div>
              ) : (
                <>
                  <table className="calc">
                    <thead>
                      <tr>
                        <th>Lớp</th>
                        <th style={{ textAlign: 'right' }}>h₁ (cm)</th>
                        <th style={{ textAlign: 'right' }}>E₁ (MPa)</th>
                        <th style={{ textAlign: 'right' }}>
                          E<sub>ch.m</sub> (MPa)
                        </th>
                        <th style={{ textAlign: 'right' }}>σ̄<sub>ku</sub></th>
                        <th style={{ textAlign: 'right' }}>
                          σ<sub>ku</sub>=σ̄<sub>ku</sub>·p·k<sub>b</sub>
                        </th>
                        <th style={{ textAlign: 'right' }}>
                          R<sub>tt</sub>
                          <sup>ku</sup>/K<sub>cd</sub>
                        </th>
                        <th>Kết luận</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tc2.map((r) => (
                        <tr key={r.idx}>
                          <td>
                            {r.name} <span className="eq">({r.group === 'mat' ? 'Hình 7 / E.2' : 'Hình 8 / E.4'})</span>
                          </td>
                          <td className="v">{fmt(r.h1, 1)}</td>
                          <td className="v">{fmt(r.E1, 0)}</td>
                          <td className="v">{fmt(r.Echm, 1)}</td>
                          <td className="v">{fmt(r.skuBar, 4)}</td>
                          <td className="v">{fmt(r.sku, 4)}</td>
                          <td className="v">{fmt(r.allow, 3)}</td>
                          <td style={{ color: r.pass ? 'var(--pass)' : 'var(--fail)', fontWeight: 700 }}>
                            {r.pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="hint" style={{ marginTop: '6px' }}>
                    σ<sub>ku</sub> = σ̄<sub>ku</sub>·p·k<sub>b</sub> (10), k<sub>b</sub>=0,85 (cụm bánh đôi, tải trọng trục tiêu chuẩn –
                    Điều 9.4.2).
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="rsec">
            <div className="rh">
              <span className="rn">D</span>
              <h2>TC3 · Kiểm toán cắt trượt trong nền/lớp kém dính (Điều 9.3)</h2>
            </div>
            <div id="f_tc3out">
              {!tc3.length ? (
                <div className="hint" style={{ padding: '6px' }}>
                  Tầng mặt cấp thấp B1/B2 – không yêu cầu kiểm tra TC3 (Điều 9.1.4.3).
                </div>
              ) : (
                <>
                  <div className="vgrid" style={{ marginBottom: '12px' }}>
                    {tc3.map((r) => vcard(r.label, 'T_ax+T_av ≤ C_tt/K_cd^tr  (7)', r.lhs, '≤', r.allow, r.pass))}
                  </div>
                  <table className="calc">
                    <thead>
                      <tr>
                        <th>Vị trí</th>
                        <th style={{ textAlign: 'right' }}>H₁/D</th>
                        <th style={{ textAlign: 'right' }}>E₁/E₂</th>
                        <th style={{ textAlign: 'right' }}>
                          T<sub>ax</sub>/p (tra Hình 4/5)
                        </th>
                        <th style={{ textAlign: 'right' }}>
                          T<sub>av</sub> (tự động, Hình 6)
                        </th>
                        <th style={{ textAlign: 'right' }}>
                          C<sub>tt</sub>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tc3.map((r) => (
                        <tr key={r.key}>
                          <td>{r.label}</td>
                          <td className="v">{fmt(r.HD, 3)}</td>
                          <td className="v">{fmt(r.ratio, 2)}</td>
                          <td className="v">
                            <input
                              className="nomo shearTaxp"
                              data-key={r.key}
                              type="number"
                              step="0.001"
                              value={r.Taxp}
                              style={{ width: '80px', textAlign: 'right', font: '600 12px var(--mono)' }}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                onChange({
                                  ...state,
                                  shearManual: { ...state.shearManual, [r.key]: val },
                                });
                              }}
                            />
                          </td>
                          <td className="v" style={{ font: '600 12px var(--mono)' }}>
                            {fmt(r.Tav, 4)}
                          </td>
                          <td className="v">{fmt(r.Ctt, 4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="nomolegend">
                    Ô cam: tra toán đồ Hình 4 hoặc 5 (T<sub>ax</sub>/p, theo H₁/D và E₁/E₂ gợi ý ở cột bên) và nhập trực tiếp trị số
                    đọc được – TCCS 38 không có công thức giải tích thay thế cho toán đồ này. T<sub>av</sub> đã được tự động tính từ
                    hàm số hoá toán đồ Hình 6 (các đường thẳng qua gốc toạ độ theo φ), hiệu chỉnh khớp với Ví dụ I/II của Phụ lục D –
                    sai số ước tính nhỏ, nhưng vẫn nên đối chiếu toán đồ gốc với công trình quan trọng.
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="rsec">
            <div className="rh">
              <span className="rn">E</span>
              <h2>Kết luận chung</h2>
            </div>
            <div id="f_overall">
              <div className={`overall ${okAll ? 'pass' : 'fail'}`}>
                {okAll ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 8v5M12 17h.01" />
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                )}
                <div>
                  <div className="eyebrow" style={{ color: 'inherit', opacity: 0.8 }}>
                    Kết luận chung
                  </div>
                  <div className="big">
                    {okAll
                      ? 'KẾT CẤU ÁO ĐƯỜNG MỀM ĐẠT YÊU CẦU theo TCCS 38:2022'
                      : 'KẾT CẤU CHƯA ĐẠT – cần điều chỉnh chiều dày/mô đun các lớp'}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rsec">
            <div className="rh">
              <span className="rn">F</span>
              <h2>Chi tiết quy đổi tầng (Odemark, công thức 5–6)</h2>
            </div>
            <div id="f_table">
              <table className="calc">
                <thead>
                  <tr>
                    <th>Lớp (từ dưới lên khi quy đổi)</th>
                    <th style={{ textAlign: 'right' }}>h (cm)</th>
                    <th style={{ textAlign: 'right' }}>E dùng độ võng</th>
                  </tr>
                </thead>
                <tbody>
                  {[...resolved.layers].reverse().map((l, idx) => (
                    <Fragment key={`layer-row-${idx}`}>
                      <tr>
                        <td>{l.name}</td>
                        <td className="v">{fmt(l.h, 1)}</td>
                        <td className="u">cm</td>
                        <td className="eq" />
                      </tr>
                      <tr>
                        <td>&nbsp;&nbsp;↳ E<sub>võng</sub></td>
                        <td className="v">{fmt(l.Ev, 0)}</td>
                        <td className="u">MPa</td>
                        <td className="eq" />
                      </tr>
                    </Fragment>
                  ))}
                  <tr className="hl">
                    <td>Nền đất E₀ (võng)</td>
                    <td className="v">{fmt(resolved.E0v, 0)}</td>
                    <td className="u">MPa</td>
                    <td className="eq" />
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="rsec">
            <div className="rh">
              <span className="rn">G</span>
              <h2>Công thức áp dụng theo TCCS 38</h2>
            </div>
            <div className="fgrid" id="f_formulas">
              {FLEX_FORMULAS.map(([name, expr, eq], idx) => (
                <div className="fcard" key={idx}>
                  <div className="fn">
                    <span>{name}</span>
                    <span className="eq">{eq}</span>
                  </div>
                  <div className="fx">{expr}</div>
                </div>
              ))}
            </div>
            <div className="nomolegend" style={{ marginTop: '10px' }}>
              <b>Lưu ý</b>: E<sub>ch</sub>, E<sub>ch.m</sub> (TC1, TC2) được tự tính theo công thức giải tích gần đúng Phụ lục E
              (sai số so với toán đồ Hình 2 khoảng 5–10%, có thể lớn hơn ở một số miền tỷ số H/D). Với công trình quan trọng hoặc khi
              H/D ≤ 2, nên đối chiếu và có thể ghi đè bằng trị số tra thủ công toán đồ Hình 2/7/8. Ô cam T<sub>ax</sub>/p (TC3) chưa
              có công thức giải tích trong TCCS 38 nên vẫn phải tra toán đồ Hình 4/5 thủ công (toán đồ 3 biến H/D, E1/E2, φ – quá
              phức tạp để số hoá tin cậy). Riêng T<sub>av</sub> đã được tự động hoá bằng cách số hoá toán đồ Hình 6 (các đường thẳng
              qua gốc toạ độ theo φ – dễ số hoá chính xác hơn nhiều) và hiệu chỉnh khớp với 2 ví dụ tính mẫu của Phụ lục D; vẫn nên
              đối chiếu toán đồ gốc cho công trình quan trọng.
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
