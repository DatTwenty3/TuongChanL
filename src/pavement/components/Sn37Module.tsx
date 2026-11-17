import { useMemo } from 'react';
import {
  CAP_DUONG_37_OPTIONS,
  CAP_DUONG_37_PRESETS,
  G_KINDS,
  fmt,
  fmtI,
  log10,
  snEquationLHS,
  type Sn37LayerKind,
  type Sn37LowInput,
  type Sn37LowResult,
  type Sn37NewInput,
  type Sn37NewResult,
  type Sn37OverlayInput,
  type Sn37OverlayResult,
  type Sn37SubTab,
} from '../engine';
import { PavementSectionSvg, type SectionLayerItem } from './PavementSectionSvg';

interface Sn37ModuleProps {
  visible: boolean;
  subTab: Sn37SubTab;
  onChangeSubTab: (sub: Sn37SubTab) => void;
  newInput: Sn37NewInput;
  newResult: Sn37NewResult;
  onChangeNew: (next: Sn37NewInput) => void;
  olInput: Sn37OverlayInput;
  olResult: Sn37OverlayResult;
  onChangeOl: (next: Sn37OverlayInput) => void;
  lowInput: Sn37LowInput;
  lowResult: Sn37LowResult;
  onChangeLow: (next: Sn37LowInput) => void;
}

export function Sn37Module({
  visible,
  subTab,
  onChangeSubTab,
  newInput,
  newResult,
  onChangeNew,
  olInput,
  olResult,
  onChangeOl,
  lowInput,
  lowResult,
  onChangeLow,
}: Sn37ModuleProps) {
  const sectionLayers: SectionLayerItem[] = useMemo(
    () =>
      newResult.rows.map((r) => ({
        name: r.name,
        thicknessCm: Math.max(0, r.D || 0),
        mat: G_KINDS[r.kind].mat,
        detailText: `D=${fmt(r.D, 1)} cm · a=${fmt(r.a, 3)}`,
      })),
    [newResult.rows],
  );

  const passNew = newResult.lastD >= 0;
  const passOl = olResult.SNol >= 0 && !Number.isNaN(olResult.Dol);

  const foLow = (o: [number, number, number] | 'KD' | 'CT') => {
    if (o === 'KD') return <span style={{ color: 'var(--fail)' }}>KD – không nên dùng</span>;
    if (o === 'CT') return <span style={{ color: 'var(--fail)' }}>CT – cần cải thiện nền trước</span>;
    return `M.T=${o[0]} / M.đá dăm thấm=${o[1]} / M.thiên nhiên=${o[2]} cm`;
  };

  return (
    <div className="module" id="mod-sn37" hidden={!visible}>
      <div className="wrap">
        <aside className="inputs" id="g_inputs">
          <div className="grp">
            <div className="gb" style={{ display: 'flex', gap: '6px', padding: '10px 10px' }}>
              <button
                className={`smallbtn g-sub${subTab === 'new' ? ' active' : ''}`}
                data-sub="new"
                type="button"
                style={{ flex: 1 }}
                onClick={() => onChangeSubTab('new')}
              >
                ① Thiết kế mới
              </button>
              <button
                className={`smallbtn g-sub${subTab === 'ol' ? ' active' : ''}`}
                data-sub="ol"
                type="button"
                style={{ flex: 1 }}
                onClick={() => onChangeSubTab('ol')}
              >
                ② Tăng cường
              </button>
              <button
                className={`smallbtn g-sub${subTab === 'low' ? ' active' : ''}`}
                data-sub="low"
                type="button"
                style={{ flex: 1 }}
                onClick={() => onChangeSubTab('low')}
              >
                ③ Lưu lượng thấp
              </button>
            </div>
          </div>

          {/* PANEL: THIẾT KẾ MỚI */}
          <div id="g_panel_new" hidden={subTab !== 'new'}>
            <div className="grp">
              <div className="gh">
                <span className="num">1</span>
                <h3>Giao thông &amp; độ tin cậy</h3>
              </div>
              <div className="gb">
                <div className="fld full">
                  <label>
                    W<sub>80</sub> – ESAL&apos;s thiết kế cho 1 làn xe{' '}
                    <span className="sub">(tự tính riêng theo Điều 6.4.4, nhập kết quả tại đây)</span>
                  </label>
                  <input
                    id="g_w80"
                    type="number"
                    step="1000"
                    value={newInput.w80}
                    onChange={(e) => onChangeNew({ ...newInput, w80: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="fld full">
                  <label>
                    Cấp đường <span className="sub">(Bảng 11 → p₀, p₁, ΔPSI)</span>
                  </label>
                  <select
                    id="g_capduong"
                    value={newInput.capduong}
                    onChange={(e) => {
                      const val = e.target.value as Sn37NewInput['capduong'];
                      const pr = CAP_DUONG_37_PRESETS[val];
                      onChangeNew({
                        ...newInput,
                        capduong: val,
                        ...(pr ? { p0: pr.p0, pt: pr.pt } : {}),
                      });
                    }}
                  >
                    {CAP_DUONG_37_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="fld">
                  <label>
                    p<sub>0</sub> – Ph.vụ ban đầu
                  </label>
                  <input
                    id="g_p0"
                    type="number"
                    step="0.1"
                    value={newInput.p0}
                    onChange={(e) => onChangeNew({ ...newInput, p0: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="u">–</span>
                </div>
                <div className="fld">
                  <label>
                    p<sub>t</sub> – Ph.vụ cuối kỳ
                  </label>
                  <input
                    id="g_pt"
                    type="number"
                    step="0.1"
                    value={newInput.pt}
                    onChange={(e) => onChangeNew({ ...newInput, pt: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="u">–</span>
                </div>
                <div className="fld">
                  <label>
                    R – Độ tin cậy <span className="sub">(Bảng 9, tham khảo)</span>
                  </label>
                  <input
                    id="g_R"
                    type="number"
                    step="1"
                    value={newInput.R}
                    onChange={(e) => onChangeNew({ ...newInput, R: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="u">%</span>
                </div>
                <div className="fld">
                  <label>
                    S<sub>0</sub> – Độ lệch chuẩn
                  </label>
                  <input
                    id="g_S0"
                    type="number"
                    step="0.01"
                    value={newInput.S0}
                    onChange={(e) => onChangeNew({ ...newInput, S0: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="u">–</span>
                </div>
                <div className="hint">
                  Bảng 9 (tham khảo): cao tốc 85–99%; QL chính 85–95%; đường chính/QL thứ yếu 75–85%; đường gom/tỉnh lộ 75–80%;
                  đường huyện/xã 50–80%.
                </div>
              </div>
            </div>

            <div className="grp">
              <div className="gh">
                <span className="num">2</span>
                <h3>
                  Nền đất – M<sub>R</sub> hữu hiệu
                </h3>
              </div>
              <div className="gb">
                <div className="fld full">
                  <label>
                    Cách xác định M<sub>R</sub>
                  </label>
                  <select
                    id="g_mrmode"
                    value={newInput.mrmode}
                    onChange={(e) => onChangeNew({ ...newInput, mrmode: e.target.value as Sn37NewInput['mrmode'] })}
                  >
                    <option value="direct">Nhập trực tiếp M_R (MPa)</option>
                    <option value="cbr">Từ CBR (%) – Ph.lục G / Hình 7</option>
                    <option value="gi">Từ chỉ số nhóm GI – Ph.lục G / Hình 7</option>
                  </select>
                </div>
                <div className="fld">
                  <label id="g_mrvallbl">
                    {newInput.mrmode === 'direct' ? (
                      <>
                        M<sub>R</sub>
                      </>
                    ) : newInput.mrmode === 'cbr' ? (
                      'CBR'
                    ) : (
                      'GI – chỉ số nhóm'
                    )}
                  </label>
                  <input
                    id="g_mrval"
                    type="number"
                    step="1"
                    value={newInput.mrval}
                    onChange={(e) => onChangeNew({ ...newInput, mrval: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="u" id="g_mrvalunit">
                    {newInput.mrmode === 'direct' ? 'MPa' : newInput.mrmode === 'cbr' ? '%' : '–'}
                  </span>
                </div>
                <div className="hint" id="g_mrcalc">
                  {newInput.mrmode === 'direct'
                    ? `M_R hữu hiệu = ${fmt(newResult.MR, 1)} MPa (nhập trực tiếp)`
                    : newInput.mrmode === 'cbr'
                      ? `M_R = 13,22·CBR^0,685 = ${fmt(newResult.MR, 1)} MPa (CBR=${newInput.mrval}%, Phụ lục G.2)`
                      : `M_R = 69,34−4,263·GI+0,0856·GI² = ${fmt(newResult.MR, 1)} MPa (GI=${newInput.mrval}, Phụ lục G.2)`}
                </div>
              </div>
            </div>

            <div className="grp">
              <div className="gh">
                <span className="num">3</span>
                <h3>Kết cấu các lớp (từ trên xuống)</h3>
              </div>
              <div className="gb">
                <div className="hint">
                  Lớp cuối cùng trong danh sách luôn là lớp <b>được giải chiều dày</b> từ phương trình (11); các lớp phía trên nhập
                  chiều dày đã chọn. Với vật liệu không có trong danh mục, chọn &quot;Tự nhập hệ số lớp a&quot; (tham khảo Phụ lục O cho
                  BTN Việt Nam).
                </div>
                <div id="g_layerList">
                  {newInput.layers.map((l, i) => {
                    const isLast = i === newInput.layers.length - 1;
                    const meta = G_KINDS[l.kind];
                    return (
                      <div className="lrow" key={i}>
                        {newInput.layers.length > 1 && (
                          <button
                            className="lx"
                            data-gdel={i}
                            type="button"
                            title="Xóa lớp"
                            onClick={() =>
                              onChangeNew({
                                ...newInput,
                                layers: newInput.layers.filter((_, idx) => idx !== i),
                              })
                            }
                          >
                            ×
                          </button>
                        )}
                        <div className="fld full">
                          <label>Lớp {i + 1} – Tên</label>
                          <input
                            data-gk="name"
                            data-gi={i}
                            type="text"
                            value={l.name}
                            onChange={(e) => {
                              const next = newInput.layers.map((item, idx) =>
                                idx === i ? { ...item, name: e.target.value } : item,
                              );
                              onChangeNew({ ...newInput, layers: next });
                            }}
                          />
                        </div>
                        <div className="fld full">
                          <label>Loại lớp</label>
                          <select
                            data-gk="kind"
                            data-gi={i}
                            value={l.kind}
                            onChange={(e) => {
                              const next = newInput.layers.map((item, idx) =>
                                idx === i ? { ...item, kind: e.target.value as Sn37LayerKind } : item,
                              );
                              onChangeNew({ ...newInput, layers: next });
                            }}
                          >
                            {Object.entries(G_KINDS).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="fld">
                          <label dangerouslySetInnerHTML={{ __html: meta.valLabelHtml }} />
                          <input
                            data-gk="val"
                            data-gi={i}
                            type="number"
                            step="1"
                            value={l.val}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value) || 0;
                              const next = newInput.layers.map((item, idx) => (idx === i ? { ...item, val: v } : item));
                              onChangeNew({ ...newInput, layers: next });
                            }}
                          />
                          <span className="u">{meta.unit}</span>
                        </div>
                        {isLast ? (
                          <div className="fld">
                            <label>
                              D – chiều dày <span className="sub">(lớp giải)</span>
                            </label>
                            <input
                              type="text"
                              value="→ tính ở kết quả"
                              disabled
                              style={{
                                textAlign: 'center',
                                color: 'var(--muted)',
                                background: 'var(--panel-2)',
                                fontSize: '11px',
                              }}
                            />
                            <span className="u">cm</span>
                          </div>
                        ) : (
                          <div className="fld">
                            <label>D – chiều dày đã chọn</label>
                            <input
                              data-gk="D"
                              data-gi={i}
                              type="number"
                              step="1"
                              value={l.D}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value) || 0;
                                const next = newInput.layers.map((item, idx) => (idx === i ? { ...item, D: v } : item));
                                onChangeNew({ ...newInput, layers: next });
                              }}
                            />
                            <span className="u">cm</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button
                  className="addbtn"
                  id="g_addLayer"
                  type="button"
                  onClick={() =>
                    onChangeNew({
                      ...newInput,
                      layers: [...newInput.layers, { name: 'Lớp mới', kind: 'mongduoi_hat_CBR', val: 30, D: 0 }],
                    })
                  }
                >
                  + Thêm lớp
                </button>
              </div>
            </div>

            <div className="grp">
              <div className="gh">
                <span className="num">4</span>
                <h3>Kiểm tra chiều dày tối thiểu</h3>
              </div>
              <div className="gb">
                <div className="hint">
                  Tự tra Bảng 5 theo W<sub>80</sub> đã nhập ở Nhóm 1 – xem kết quả ở mục E bên phải.
                </div>
              </div>
            </div>
          </div>

          {/* PANEL: TĂNG CƯỜNG */}
          <div id="g_panel_ol" hidden={subTab !== 'ol'}>
            <div className="grp">
              <div className="gh">
                <span className="num">1</span>
                <h3>Giao thông tương lai &amp; độ tin cậy</h3>
              </div>
              <div className="gb">
                <div className="fld full">
                  <label>
                    N<sub>f</sub> – ESAL&apos;s tương lai cho 1 làn (từ khi rải lớp phủ)
                  </label>
                  <input
                    id="g_nf"
                    type="number"
                    step="1000"
                    value={olInput.Nf}
                    onChange={(e) => onChangeOl({ ...olInput, Nf: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="fld">
                  <label>R – Độ tin cậy</label>
                  <input
                    id="g_olR"
                    type="number"
                    step="1"
                    value={olInput.R}
                    onChange={(e) => onChangeOl({ ...olInput, R: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="u">%</span>
                </div>
                <div className="fld">
                  <label>
                    S<sub>0</sub>
                  </label>
                  <input
                    id="g_olS0"
                    type="number"
                    step="0.01"
                    value={olInput.S0}
                    onChange={(e) => onChangeOl({ ...olInput, S0: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="u">–</span>
                </div>
                <div className="fld">
                  <label>
                    p<sub>1</sub> – Ph.vụ ngay sau khi phủ
                  </label>
                  <input
                    id="g_olp1"
                    type="number"
                    step="0.1"
                    value={olInput.p1}
                    onChange={(e) => onChangeOl({ ...olInput, p1: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="u">–</span>
                </div>
                <div className="fld">
                  <label>
                    p<sub>2</sub> – Ph.vụ cuối kỳ tiếp theo
                  </label>
                  <input
                    id="g_olp2"
                    type="number"
                    step="0.1"
                    value={olInput.p2}
                    onChange={(e) => onChangeOl({ ...olInput, p2: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="u">–</span>
                </div>
                <div className="fld">
                  <label>
                    M<sub>R thiết kế</sub> – nền đường hiện hữu
                  </label>
                  <input
                    id="g_olMr"
                    type="number"
                    step="1"
                    value={olInput.MR}
                    onChange={(e) => onChangeOl({ ...olInput, MR: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="u">MPa</span>
                </div>
              </div>
            </div>

            <div className="grp">
              <div className="gh">
                <span className="num">2</span>
                <h3>
                  Xác định SN<sub>eff</sub> hiện hữu (Điều 7.3)
                </h3>
              </div>
              <div className="gb">
                <div className="fld full">
                  <label>Phương pháp</label>
                  <select
                    id="g_olmethod"
                    value={olInput.method}
                    onChange={(e) => onChangeOl({ ...olInput, method: e.target.value as Sn37OverlayInput['method'] })}
                  >
                    <option value="fwd">a) Đo võng động FWD (7.3.1)</option>
                    <option value="survey">b) Khảo sát hiện trạng từng lớp (7.3.2, Bảng 14)</option>
                    <option value="rl">c) Tuổi thọ còn lại (7.3.3)</option>
                  </select>
                </div>

                <div id="g_ol_fwd" hidden={olInput.method !== 'fwd'}>
                  <div className="subhead">Số liệu đo FWD</div>
                  <div className="fld">
                    <label>P – tải trọng tấm ép</label>
                    <input
                      id="g_fwdP"
                      type="number"
                      step="1"
                      value={olInput.fwdP}
                      onChange={(e) => onChangeOl({ ...olInput, fwdP: parseFloat(e.target.value) || 0 })}
                    />
                    <span className="u">kN</span>
                  </div>
                  <div className="fld">
                    <label>a – bán kính tấm ép</label>
                    <input
                      id="g_fwda"
                      type="number"
                      step="0.1"
                      value={olInput.fwda}
                      onChange={(e) => onChangeOl({ ...olInput, fwda: parseFloat(e.target.value) || 0 })}
                    />
                    <span className="u">cm</span>
                  </div>
                  <div className="fld">
                    <label>D – tổng bề dày KC hiện hữu</label>
                    <input
                      id="g_fwdD"
                      type="number"
                      step="1"
                      value={olInput.fwdD}
                      onChange={(e) => onChangeOl({ ...olInput, fwdD: parseFloat(e.target.value) || 0 })}
                    />
                    <span className="u">cm</span>
                  </div>
                  <div className="fld">
                    <label>
                      r – khoảng cách đo d<sub>r</sub>
                    </label>
                    <input
                      id="g_fwdr"
                      type="number"
                      step="1"
                      value={olInput.fwdr}
                      onChange={(e) => onChangeOl({ ...olInput, fwdr: parseFloat(e.target.value) || 0 })}
                    />
                    <span className="u">cm</span>
                  </div>
                  <div className="fld">
                    <label>
                      d<sub>r</sub> – độ võng đo tại r
                    </label>
                    <input
                      id="g_fwddr"
                      type="number"
                      step="0.0001"
                      value={olInput.fwddr}
                      onChange={(e) => onChangeOl({ ...olInput, fwddr: parseFloat(e.target.value) || 0 })}
                    />
                    <span className="u">cm</span>
                  </div>
                  <div className="fld">
                    <label>
                      d<sub>0</sub> – độ võng tại tâm (đã h.chỉnh nhiệt độ)
                    </label>
                    <input
                      id="g_fwdd0"
                      type="number"
                      step="0.0001"
                      value={olInput.fwdd0}
                      onChange={(e) => onChangeOl({ ...olInput, fwdd0: parseFloat(e.target.value) || 0 })}
                    />
                    <span className="u">cm</span>
                  </div>
                  <div className="fld">
                    <label>
                      C – hệ số hiệu chỉnh M<sub>R</sub>
                    </label>
                    <input
                      id="g_fwdC"
                      type="number"
                      step="0.01"
                      value={olInput.fwdC}
                      onChange={(e) => onChangeOl({ ...olInput, fwdC: parseFloat(e.target.value) || 0 })}
                    />
                    <span className="u">≤0,33</span>
                  </div>
                  <div className="hint">
                    M<sub>R</sub> = 2,4P/(d<sub>r</sub>·r) (24); M<sub>R thiết kế</sub>=C·M<sub>R</sub> (26); giải E
                    <sub>p</sub> từ (22) bằng phương pháp lặp; SN<sub>eff</sub>=0,0093·D·E<sub>p</sub>
                    <sup>1/3</sup> (21).
                  </div>
                </div>

                <div id="g_ol_survey" hidden={olInput.method !== 'survey'}>
                  <div className="hint">
                    Nhập a<sub>i</sub>, D<sub>i</sub> hiện hữu của tối đa 3 lớp (mặt/móng trên/móng dưới), đã trừ hao theo mức hư hỏng
                    quan sát (Bảng 14).
                  </div>
                  <div id="g_surveyList">
                    {olInput.survey.map((s, i) => (
                      <div className="fld" key={i}>
                        <label>
                          {s.name}: a<sub>i</sub>
                        </label>
                        <input
                          data-si={i}
                          data-sk="a"
                          type="number"
                          step="0.01"
                          value={s.a}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value) || 0;
                            const next = olInput.survey.map((item, idx) => (idx === i ? { ...item, a: v } : item));
                            onChangeOl({ ...olInput, survey: next });
                          }}
                        />
                        <span className="u">
                          D=
                          <input
                            data-si={i}
                            data-sk="D"
                            type="number"
                            step="1"
                            value={s.D}
                            style={{
                              width: '44px',
                              border: 'none',
                              background: 'transparent',
                              color: 'inherit',
                              font: 'inherit',
                              textAlign: 'right',
                            }}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value) || 0;
                              const next = olInput.survey.map((item, idx) => (idx === i ? { ...item, D: v } : item));
                              onChangeOl({ ...olInput, survey: next });
                            }}
                          />{' '}
                          cm
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div id="g_ol_rl" hidden={olInput.method !== 'rl'}>
                  <div className="fld">
                    <label>
                      SN<sub>0</sub> – chỉ số kết cấu ban đầu
                    </label>
                    <input
                      id="g_rlSN0"
                      type="number"
                      step="0.01"
                      value={olInput.rlSN0}
                      onChange={(e) => onChangeOl({ ...olInput, rlSN0: parseFloat(e.target.value) || 0 })}
                    />
                    <span className="u">–</span>
                  </div>
                  <div className="fld">
                    <label>
                      N<sub>p</sub> – tổng trục đã khai thác (ESAL&apos;s)
                    </label>
                    <input
                      id="g_rlNp"
                      type="number"
                      step="1000"
                      value={olInput.rlNp}
                      onChange={(e) => onChangeOl({ ...olInput, rlNp: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="fld">
                    <label>
                      N<sub>1,5</sub> – tổng trục đến khi hỏng (p<sub>t</sub>=1,5, R=50%)
                    </label>
                    <input
                      id="g_rlN15"
                      type="number"
                      step="1000"
                      value={olInput.rlN15}
                      onChange={(e) => onChangeOl({ ...olInput, rlN15: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="hint">
                    RL=100(1−N<sub>p</sub>/N<sub>1,5</sub>) (29); CF tra theo đường cong Hình 15 (đã số hoá gần đúng); SN
                    <sub>eff</sub>=CF·SN<sub>0</sub> (28).
                  </div>
                </div>
              </div>
            </div>

            <div className="grp">
              <div className="gh">
                <span className="num">3</span>
                <h3>Lớp phủ tăng cường</h3>
              </div>
              <div className="gb">
                <div className="fld">
                  <label>
                    E<sub>AC</sub> – mô đun BTN lớp phủ
                  </label>
                  <input
                    id="g_olEac"
                    type="number"
                    step="10"
                    value={olInput.olEac}
                    onChange={(e) => onChangeOl({ ...olInput, olEac: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="u">MPa</span>
                </div>
                <div className="hint" id="g_olA1out">
                  a<sub>ol</sub> tự tính từ E<sub>AC</sub> theo công thức (16)
                </div>
              </div>
            </div>
          </div>

          {/* PANEL: LƯU LƯỢNG THẤP */}
          <div id="g_panel_low" hidden={subTab !== 'low'}>
            <div className="grp">
              <div className="gh">
                <span className="num">1</span>
                <h3>Phân loại (Điều 8.4)</h3>
              </div>
              <div className="gb">
                <div className="fld full">
                  <label>Loại tầng mặt</label>
                  <select
                    id="g_lowLoai"
                    value={lowInput.loai}
                    onChange={(e) => onChangeLow({ ...lowInput, loai: e.target.value === 'cpd' ? 'cpd' : 'nhua' })}
                  >
                    <option value="nhua">Mặt trộn nhựa / láng nhựa (ESAL 50.000–1.000.000)</option>
                    <option value="cpd">Mặt cấp phối đá (ESAL 10.000–100.000)</option>
                  </select>
                </div>
                <div className="fld full">
                  <label>ESAL&apos;s thiết kế (80 kN)</label>
                  <input
                    id="g_lowEsal"
                    type="number"
                    step="1000"
                    value={lowInput.esal}
                    onChange={(e) => onChangeLow({ ...lowInput, esal: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="fld full">
                  <label>Cách xác định chất lượng nền</label>
                  <select
                    id="g_lowMrmode"
                    value={lowInput.mrmode}
                    onChange={(e) => onChangeLow({ ...lowInput, mrmode: e.target.value === 'cbr' ? 'cbr' : 'direct' })}
                  >
                    <option value="direct">Nhập M_R (MPa)</option>
                    <option value="cbr">Nhập CBR (%)</option>
                  </select>
                </div>
                <div className="fld">
                  <label id="g_lowmrlbl">{lowInput.mrmode === 'direct' ? <>M<sub>R</sub></> : 'CBR'}</label>
                  <input
                    id="g_lowMr"
                    type="number"
                    step="1"
                    value={lowInput.mrval}
                    onChange={(e) => onChangeLow({ ...lowInput, mrval: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="u" id="g_lowmrunit">
                    {lowInput.mrmode === 'direct' ? 'MPa' : '%'}
                  </span>
                </div>
                <div className="fld full">
                  <label>Độ tin cậy R</label>
                  <select
                    id="g_lowR"
                    value={lowInput.Rrel}
                    onChange={(e) => onChangeLow({ ...lowInput, Rrel: e.target.value === '75' ? '75' : '50' })}
                  >
                    <option value="50">50%</option>
                    <option value="75">75%</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="results">
          {/* OUTPUT: THIẾT KẾ MỚI */}
          <div id="g_out_new" hidden={subTab !== 'new'}>
            <section className="rsec">
              <div className="rh">
                <span className="rn">A</span>
                <h2>Cắt ngang kết cấu áo đường</h2>
              </div>
              <div className="sectionwrap">
                <div id="g_section">
                  <PavementSectionSvg
                    idPrefix="g_"
                    layers={sectionLayers}
                    loadMode="none"
                    showTotalDim={false}
                    padT={30}
                    availH={280}
                    minH={24}
                    soilH={60}
                  />
                </div>
              </div>
              <div className="cap">
                Hình vẽ tự cập nhật theo chiều dày và hệ số lớp a<sub>i</sub> của các lớp.
              </div>
            </section>

            <section className="rsec">
              <div className="rh">
                <span className="rn">B</span>
                <h2>Giao thông, độ tin cậy &amp; mô đun nền đất</h2>
              </div>
              <div id="g_step1">
                <table className="calc">
                  <tbody>
                    <tr>
                      <td>
                        W<sub>80</sub> – ESAL&apos;s thiết kế
                      </td>
                      <td className="v">{fmtI(newResult.t.w80)}</td>
                      <td className="u">lần</td>
                    </tr>
                    <tr>
                      <td>
                        log<sub>10</sub>W<sub>80</sub> – vế phải mục tiêu
                      </td>
                      <td className="v">{fmt(log10(newResult.t.w80), 4)}</td>
                      <td className="u">–</td>
                    </tr>
                    <tr>
                      <td>R – độ tin cậy</td>
                      <td className="v">{fmt(newResult.t.R, 0)}</td>
                      <td className="u">%</td>
                    </tr>
                    <tr>
                      <td>
                        Z<sub>R</sub> – độ lệch chuẩn (Bảng 10 / NORM.S.INV)
                      </td>
                      <td className="v">{fmt(newResult.ZR, 3)}</td>
                      <td className="u">–</td>
                    </tr>
                    <tr>
                      <td>
                        S<sub>0</sub> – độ lệch tiêu chuẩn toàn bộ
                      </td>
                      <td className="v">{fmt(newResult.t.S0, 2)}</td>
                      <td className="u">–</td>
                    </tr>
                    <tr>
                      <td>
                        p<sub>0</sub> / p<sub>t</sub>
                      </td>
                      <td className="v">
                        {fmt(newResult.t.p0, 1)} / {fmt(newResult.t.pt, 1)}
                      </td>
                      <td className="u">–</td>
                    </tr>
                    <tr className="hl">
                      <td>
                        ΔPSI = p<sub>0</sub> − p<sub>t</sub>
                      </td>
                      <td className="v">{fmt(newResult.dPSI, 2)}</td>
                      <td className="u">–</td>
                    </tr>
                    <tr className="hl">
                      <td>
                        M<sub>R</sub> hữu hiệu đất nền
                      </td>
                      <td className="v">{fmt(newResult.MR, 1)}</td>
                      <td className="u">MPa</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rsec">
              <div className="rh">
                <span className="rn">C</span>
                <h2>Giải chỉ số kết cấu yêu cầu SN – ptr (8)/(9)</h2>
              </div>
              <div id="g_snout">
                <div className="fcard" style={{ marginBottom: '10px' }}>
                  <div className="fn">
                    <span>Phương trình (9) – giải theo phương pháp lặp (tương đương Goal Seek, Phụ lục G.1)</span>
                  </div>
                  <div className="fx">
                    log₁₀W₈₀ = Z<sub>R</sub>·S₀ + 9,36·log₁₀(SN+1) − 0,2 + log₁₀[ΔPSI/2,7] / [0,40+1094/(SN+1)<sup>5,19</sup>]
                    + 2,32·log₁₀M<sub>R</sub> − 3,06
                  </div>
                </div>
                <table className="calc">
                  <tbody>
                    <tr>
                      <td>Vế phải mục tiêu (log₁₀W₈₀)</td>
                      <td className="v">{fmt(log10(newResult.t.w80), 4)}</td>
                      <td className="u">–</td>
                    </tr>
                    <tr>
                      <td>Vế trái tại SN nghiệm (kiểm tra)</td>
                      <td className="v">
                        {fmt(snEquationLHS(newResult.SN, newResult.ZR, newResult.t.S0, newResult.dPSI, newResult.MR), 4)}
                      </td>
                      <td className="u">–</td>
                    </tr>
                    <tr className="hl">
                      <td>SN – chỉ số kết cấu yêu cầu</td>
                      <td className="v">{fmt(newResult.SN, 3)}</td>
                      <td className="u">–</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rsec">
              <div className="rh">
                <span className="rn">D</span>
                <h2>Chiều dày các lớp – ptr (11)</h2>
              </div>
              <div id="g_laytbl">
                <div className="fcard" style={{ marginBottom: '10px' }}>
                  <div className="fx">
                    2,54·SN = a₁D₁ + a₂D₂ + … + a<sub>n</sub>D<sub>n</sub> (11)
                  </div>
                </div>
                <table className="calc">
                  <thead>
                    <tr>
                      <th>Lớp</th>
                      <th>Loại</th>
                      <th>Giá trị nhập</th>
                      <th>
                        a<sub>i</sub>
                      </th>
                      <th>
                        D<sub>i</sub> (cm)
                      </th>
                      <th>
                        a<sub>i</sub>·D<sub>i</sub>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {newResult.rows.map((r, i) => (
                      <tr className={r.isLast ? 'hl' : ''} key={i}>
                        <td>
                          {i + 1}. {r.name}
                        </td>
                        <td style={{ fontSize: '11px', color: 'var(--muted)' }}>{G_KINDS[r.kind].label}</td>
                        <td className="v">
                          {fmt(r.val, r.kind === 'custom' ? 3 : 1)} <span className="u">{G_KINDS[r.kind].unit}</span>
                        </td>
                        <td className="v">{fmt(r.a, 3)}</td>
                        <td className="v">
                          {r.isLast ? (
                            <>
                              <b>{fmt(r.D, 1)}</b>{' '}
                              <span className="sub" style={{ color: 'var(--steel)' }}>
                                (giải)
                              </span>
                            </>
                          ) : (
                            fmt(r.D, 1)
                          )}
                        </td>
                        <td className="v">{fmt(r.a * r.D, 3)}</td>
                      </tr>
                    ))}
                    <tr className="sub">
                      <td colSpan={5}>
                        Σ(a<sub>i</sub>·D<sub>i</sub>) tính lại
                      </td>
                      <td className="v">{fmt(newResult.checkSum, 3)}</td>
                    </tr>
                    <tr className="sub">
                      <td colSpan={5}>2,54 × SN yêu cầu</td>
                      <td className="v">{fmt(2.54 * newResult.SN, 3)}</td>
                    </tr>
                  </tbody>
                </table>
                {newResult.lastD < 0 && (
                  <div className="nomolegend" style={{ borderColor: '#e0a1a1', background: '#fdecec', color: '#a33' }}>
                    Chiều dày lớp cuối giải ra ÂM ({fmt(newResult.lastD, 1)} cm) — các lớp phía trên đã dùng vượt quá SN yêu cầu.
                    Hãy giảm chiều dày/số lớp phía trên hoặc tăng SN yêu cầu.
                  </div>
                )}
              </div>
            </section>

            <section className="rsec">
              <div className="rh">
                <span className="rn">E</span>
                <h2>Kiểm tra chiều dày tối thiểu (Bảng 5)</h2>
              </div>
              <div id="g_minout">
                <table className="calc">
                  <thead>
                    <tr>
                      <th>ESAL&apos;s (W₈₀)</th>
                      <th>BTN tầng mặt tối thiểu (cm)</th>
                      <th>Móng trên bằng vật liệu hạt (cm)</th>
                      <th>Móng trên bằng vật liệu hạt trộn nhựa (cm)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="hl">
                      <td>
                        {fmtI(newResult.t.w80)} → áp dụng dòng ≤{' '}
                        {newResult.b5.max === Infinity ? '>20.000.000' : fmtI(newResult.b5.max)}
                      </td>
                      <td className="v">{newResult.b5.btn}</td>
                      <td className="v">{newResult.b5.hat}</td>
                      <td className="v">{newResult.b5.hatnhua}</td>
                    </tr>
                  </tbody>
                </table>
                <div className="hint" style={{ marginTop: '8px' }}>
                  Tổng bề dày các lớp BTN tầng mặt đã thiết kế: <b>{fmt(newResult.totalBTN, 1)} cm</b>. Đối chiếu bằng mắt với cột
                  &quot;BTN tầng mặt tối thiểu&quot; ở trên (Bảng 5, Điều 6.3.6) — giá trị trong ngoặc áp dụng khi lớp móng trên là
                  vật liệu hạt trộn nhựa đã đạt chiều dày tối thiểu ghi ở cột kế bên.
                </div>
              </div>
            </section>

            <section className="rsec">
              <div className="rh">
                <span className="rn">F</span>
                <h2>Kết luận chung</h2>
              </div>
              <div id="g_overall_new">
                <div className={`overall ${passNew ? 'pass' : 'fail'}`}>
                  <span className="big">{passNew ? 'ĐẠT' : 'CHƯA ĐẠT'}</span> — SN yêu cầu = {fmt(newResult.SN, 3)}; kết cấu đề
                  xuất cho Σ(a·D)={fmt(newResult.checkSum, 3)} ≈ 2,54×SN={fmt(2.54 * newResult.SN, 3)} (lớp cuối giải D=
                  {fmt(newResult.lastD, 1)} cm).
                </div>
                <div className="nomolegend" style={{ marginTop: '10px' }}>
                  <b>Lưu ý</b>: hệ số lớp a<sub>i</sub> tính bằng các phương trình hồi quy ở Phụ lục G (thay cho tra toán đồ Hình
                  8–12), sai số hồi quy dưới 2% (R²&gt;98%) so với toán đồ gốc — nhưng do bước &quot;giải chiều dày lớp cuối&quot; là
                  phép trừ, sai số có thể khuếch đại. Nên đối chiếu chiều dày lớp cuối với toán đồ gốc hoặc làm tròn lên cho công
                  trình quan trọng. Phương pháp phân tích theo từng lớp (Ví dụ 6, khi tỉ số mô đun hai lớp kề nhau &lt; 1/10) chưa
                  được tự động hoá trong bảng trên — cần tính tay theo trình tự SN<sub>i</sub> giảm dần như minh hoạ ở Phụ lục F.
                </div>
              </div>
            </section>

            <section className="rsec">
              <div className="rh">
                <span className="rn">G</span>
                <h2>Công thức áp dụng</h2>
              </div>
              <div className="fgrid" id="g_formulas_new">
                <div className="fcard">
                  <div className="fn">
                    <span>Ptr thiết kế SN</span>
                    <span className="eq">(8)/(9)</span>
                  </div>
                  <div className="fx">
                    log₁₀W = Z<sub>R</sub>S₀+9,36log₁₀(SN+1)−0,2+[…]+2,32log₁₀M<sub>R</sub>−3,06
                  </div>
                </div>
                <div className="fcard">
                  <div className="fn">
                    <span>Ptr chiều dày</span>
                    <span className="eq">(11)</span>
                  </div>
                  <div className="fx">2,54SN = a₁D₁+a₂D₂+a₃D₃+…</div>
                </div>
                <div className="fcard">
                  <div className="fn">
                    <span>a₁ – BTN chặt</span>
                    <span className="eq">(16)</span>
                  </div>
                  <div className="fx">
                    a₁ = 0,40·log[E<sub>AC</sub>(ksi)/450]+0,44 (≤0,44)
                  </div>
                </div>
                <div className="fcard">
                  <div className="fn">
                    <span>a₂ – móng trên hạt</span>
                    <span className="eq">PL.G.3</span>
                  </div>
                  <div className="fx">
                    a₂=0,2986+0,2336·log(M<sub>R</sub>,GPa) hoặc −0,05646+0,1004·log(CBR)
                  </div>
                </div>
                <div className="fcard">
                  <div className="fn">
                    <span>a₂ – gia cố xi măng</span>
                    <span className="eq">PL.G.4</span>
                  </div>
                  <div className="fx">
                    a₂=0,0935+0,02284·R<sub>n</sub>(MPa) hoặc −0,1329+0,08604E<sub>bs</sub>−0,004132E<sub>bs</sub>²(GPa)
                  </div>
                </div>
                <div className="fcard">
                  <div className="fn">
                    <span>a₂ – gia cố/xử lý nhựa</span>
                    <span className="eq">PL.G.5</span>
                  </div>
                  <div className="fx">a₂=0,1123+0,02573·S(kN, Marshall)</div>
                </div>
                <div className="fcard">
                  <div className="fn">
                    <span>a₃ – móng dưới hạt</span>
                    <span className="eq">PL.G.6</span>
                  </div>
                  <div className="fx">
                    a₃=0,3051+0,1981·log(M<sub>R</sub>,GPa) hoặc 0,007574+0,06792·log(CBR)
                  </div>
                </div>
                <div className="fcard">
                  <div className="fn">
                    <span>
                      M<sub>R</sub> từ CBR
                    </span>
                    <span className="eq">PL.G.2</span>
                  </div>
                  <div className="fx">
                    M<sub>R</sub>(MPa)=13,22·CBR<sup>0,685</sup>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* OUTPUT: TĂNG CƯỜNG */}
          <div id="g_out_ol" hidden={subTab !== 'ol'}>
            <section className="rsec">
              <div className="rh">
                <span className="rn">A</span>
                <h2>
                  Chỉ số kết cấu yêu cầu cho giao thông tương lai – SN<sub>f</sub>
                </h2>
              </div>
              <div id="g_ol_snf">
                <table className="calc">
                  <tbody>
                    <tr>
                      <td>
                        N<sub>f</sub> – ESAL&apos;s tương lai
                      </td>
                      <td className="v">{fmtI(olResult.Nf)}</td>
                      <td className="u">–</td>
                    </tr>
                    <tr>
                      <td>
                        R / Z<sub>R</sub>
                      </td>
                      <td className="v">
                        {fmt(olResult.R, 0)}% / {fmt(olResult.ZR, 3)}
                      </td>
                      <td className="u">–</td>
                    </tr>
                    <tr>
                      <td>S₀ / ΔPSI</td>
                      <td className="v">
                        {fmt(olResult.S0, 2)} / {fmt(olResult.dPSI, 2)}
                      </td>
                      <td className="u">–</td>
                    </tr>
                    <tr>
                      <td>
                        M<sub>R thiết kế</sub> nền hiện hữu
                      </td>
                      <td className="v">{fmt(olResult.MR, 1)}</td>
                      <td className="u">MPa</td>
                    </tr>
                    <tr className="hl">
                      <td>
                        SN<sub>f</sub> – ptr (8)/(9)
                      </td>
                      <td className="v">{fmt(olResult.SNf, 3)}</td>
                      <td className="u">–</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rsec">
              <div className="rh">
                <span className="rn">B</span>
                <h2>
                  Chỉ số kết cấu hữu hiệu hiện hữu – SN<sub>eff</sub>
                </h2>
              </div>
              <div id="g_ol_sneff">
                {olResult.detail.method === 'fwd' && (
                  <>
                    <table className="calc">
                      <tbody>
                        <tr>
                          <td>p – áp lực tấm ép (10P/πa²)</td>
                          <td className="v">{fmt(olResult.detail.p, 3)}</td>
                          <td className="u">MPa</td>
                        </tr>
                        <tr>
                          <td>
                            M<sub>R</sub> = 2,4P/(d<sub>r</sub>·r) (24)
                          </td>
                          <td className="v">{fmt(olResult.detail.MRfwd, 1)}</td>
                          <td className="u">MPa</td>
                        </tr>
                        <tr>
                          <td>
                            M<sub>R thiết kế</sub> = C·M<sub>R</sub> (26)
                          </td>
                          <td className="v">{fmt(olResult.detail.MRtk, 1)}</td>
                          <td className="u">MPa</td>
                        </tr>
                        <tr>
                          <td>
                            E<sub>p</sub> – giải từ ptr (22) (lặp/Goal Seek)
                          </td>
                          <td className="v">{fmt(olResult.detail.Ep, 1)}</td>
                          <td className="u">MPa</td>
                        </tr>
                        <tr className="hl">
                          <td>
                            SN<sub>eff</sub> = 0,0093·D·E<sub>p</sub>
                            <sup>1/3</sup> (21)
                          </td>
                          <td className="v">{fmt(olResult.detail.SNeff, 3)}</td>
                          <td className="u">–</td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="hint">
                      Giải E<sub>p</sub> trực tiếp từ phương trình (22) bằng phương pháp lặp (chính là cách dùng Goal Seek mà Điều
                      7.3.1.2 khuyến nghị) thay vì tra toán đồ Hình D.2 — kết quả có thể lệch vài % so với đọc toán đồ bằng tay.
                    </div>
                  </>
                )}

                {olResult.detail.method === 'survey' && (
                  <table className="calc">
                    <thead>
                      <tr>
                        <th>Lớp</th>
                        <th>
                          a<sub>i</sub>
                        </th>
                        <th>
                          D<sub>i</sub> (cm)
                        </th>
                        <th>
                          a<sub>i</sub>D<sub>i</sub>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {olResult.detail.layers.map((l, idx) => (
                        <tr key={idx}>
                          <td>{l.name}</td>
                          <td className="v">{fmt(l.a, 3)}</td>
                          <td className="v">{fmt(l.D, 1)}</td>
                          <td className="v">{fmt(l.a * l.D, 3)}</td>
                        </tr>
                      ))}
                      <tr className="sub">
                        <td colSpan={3}>
                          Σa<sub>i</sub>D<sub>i</sub>
                        </td>
                        <td className="v">{fmt(olResult.detail.sum, 3)}</td>
                      </tr>
                      <tr className="hl">
                        <td colSpan={3}>
                          SN<sub>eff</sub> = Σa<sub>i</sub>D<sub>i</sub>/2,54 (27)
                        </td>
                        <td className="v">{fmt(olResult.detail.SNeff, 3)}</td>
                      </tr>
                    </tbody>
                  </table>
                )}

                {olResult.detail.method === 'rl' && (
                  <>
                    <table className="calc">
                      <tbody>
                        <tr>
                          <td>SN₀ – ban đầu</td>
                          <td className="v">{fmt(olResult.detail.SN0, 3)}</td>
                          <td className="u">–</td>
                        </tr>
                        <tr>
                          <td>
                            N<sub>p</sub> / N<sub>1,5</sub>
                          </td>
                          <td className="v">
                            {fmtI(olResult.detail.Np)} / {fmtI(olResult.detail.N15)}
                          </td>
                          <td className="u">–</td>
                        </tr>
                        <tr>
                          <td>
                            RL = 100(1−N<sub>p</sub>/N<sub>1,5</sub>) (29)
                          </td>
                          <td className="v">{fmt(olResult.detail.RL, 1)}</td>
                          <td className="u">%</td>
                        </tr>
                        <tr>
                          <td>CF – tra Hình 15 (số hoá gần đúng)</td>
                          <td className="v">{fmt(olResult.detail.CF, 3)}</td>
                          <td className="u">–</td>
                        </tr>
                        <tr className="hl">
                          <td>
                            SN<sub>eff</sub> = CF·SN₀ (28)
                          </td>
                          <td className="v">{fmt(olResult.detail.SNeff, 3)}</td>
                          <td className="u">–</td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="hint">
                      Đường cong Hình 15 được số hoá gần đúng (không có ví dụ mẫu để hiệu chỉnh chính xác) — chỉ nên dùng để ước lượng
                      sơ bộ, đối chiếu toán đồ gốc trước khi quyết định.
                    </div>
                  </>
                )}
              </div>
            </section>

            <section className="rsec">
              <div className="rh">
                <span className="rn">C</span>
                <h2>
                  Chiều dày lớp phủ tăng cường – D<sub>ol</sub>
                </h2>
              </div>
              <div id="g_ol_result">
                <table className="calc">
                  <tbody>
                    <tr>
                      <td>
                        SN<sub>ol</sub> = SN<sub>f</sub> − SN<sub>eff</sub> (19)
                      </td>
                      <td className="v">{fmt(olResult.SNol, 3)}</td>
                      <td className="u">–</td>
                    </tr>
                    <tr>
                      <td>
                        E<sub>AC</sub> lớp phủ → a<sub>ol</sub> (16)
                      </td>
                      <td className="v">
                        {fmt(olResult.Eac, 0)} MPa → {fmt(olResult.aol, 3)}
                      </td>
                      <td className="u">–</td>
                    </tr>
                    <tr className="hl">
                      <td>
                        D<sub>ol</sub> = 2,54·SN<sub>ol</sub>/a<sub>ol</sub> (18)
                      </td>
                      <td className="v">{fmt(olResult.Dol, 1)}</td>
                      <td className="u">cm</td>
                    </tr>
                  </tbody>
                </table>
                <div className={`overall ${passOl ? 'pass' : 'fail'}`} style={{ marginTop: '10px' }}>
                  <span className="big">
                    {passOl
                      ? `CẦN LỚP PHỦ ${fmt(olResult.Dol, 1)} cm`
                      : 'SNeff ĐÃ ĐỦ, KHÔNG CẦN TĂNG CƯỜNG BỀ DÀY'}
                  </span>
                </div>
              </div>
            </section>

            <section className="rsec">
              <div className="rh">
                <span className="rn">D</span>
                <h2>Công thức áp dụng</h2>
              </div>
              <div className="fgrid" id="g_formulas_ol">
                <div className="fcard">
                  <div className="fn">
                    <span>Chiều dày lớp phủ</span>
                    <span className="eq">(18)</span>
                  </div>
                  <div className="fx">
                    2,54·SN<sub>ol</sub> = a<sub>ol</sub>·D<sub>ol</sub>
                  </div>
                </div>
                <div className="fcard">
                  <div className="fn">
                    <span>SN yêu cầu lớp phủ</span>
                    <span className="eq">(19)</span>
                  </div>
                  <div className="fx">
                    SN<sub>ol</sub> = SN<sub>f</sub> − SN<sub>eff</sub>
                  </div>
                </div>
                <div className="fcard">
                  <div className="fn">
                    <span>SNeff – FWD</span>
                    <span className="eq">(20)/(21)</span>
                  </div>
                  <div className="fx">
                    SN<sub>eff</sub>=0,0045D∛Ep (in,psi) hoặc 0,0093D∛Ep (cm,MPa)
                  </div>
                </div>
                <div className="fcard">
                  <div className="fn">
                    <span>Độ võng 2 lớp</span>
                    <span className="eq">(22)</span>
                  </div>
                  <div className="fx">
                    d₀=1,5pa{'{'}1/[M<sub>R</sub>√(1+(D/a·∛(Ep/M<sub>R</sub>))²)]+[1−1/√(1+(D/a)²)]/Ep{'}'}
                  </div>
                </div>
                <div className="fcard">
                  <div className="fn">
                    <span>
                      M<sub>R</sub> từ FWD
                    </span>
                    <span className="eq">(24)/(26)</span>
                  </div>
                  <div className="fx">
                    M<sub>R</sub>=2,4P/(d<sub>r</sub>r); M<sub>R thiết kế</sub>=C·M<sub>R</sub> (C≤0,33)
                  </div>
                </div>
                <div className="fcard">
                  <div className="fn">
                    <span>SNeff – khảo sát</span>
                    <span className="eq">(27)</span>
                  </div>
                  <div className="fx">
                    2,54SN<sub>eff</sub>=a₁D₁+a₂D₂+a₃D₃
                  </div>
                </div>
                <div className="fcard">
                  <div className="fn">
                    <span>SNeff – tuổi thọ còn lại</span>
                    <span className="eq">(28)/(29)</span>
                  </div>
                  <div className="fx">
                    SN<sub>eff</sub>=CF·SN₀ ; RL=100(1−N<sub>p</sub>/N<sub>1,5</sub>)
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* OUTPUT: LƯU LƯỢNG THẤP */}
          <div id="g_out_low" hidden={subTab !== 'low'}>
            <section className="rsec">
              <div className="rh">
                <span className="rn">A</span>
                <h2>Phân loại lưu lượng &amp; chất lượng nền</h2>
              </div>
              <div id="g_low_class">
                <table className="calc">
                  <tbody>
                    <tr>
                      <td>Loại tầng mặt</td>
                      <td className="v">{lowResult.loai === 'nhua' ? 'Trộn nhựa / láng nhựa' : 'Cấp phối đá'}</td>
                    </tr>
                    <tr>
                      <td>ESAL&apos;s thiết kế</td>
                      <td className="v">{fmtI(lowResult.esal)}</td>
                    </tr>
                    <tr className="hl">
                      <td>Cấp lưu lượng xe (Điều 8.4.1/8.4.2)</td>
                      <td className="v">{lowResult.level}</td>
                    </tr>
                    <tr>
                      <td>
                        M<sub>R</sub> nền đường
                      </td>
                      <td className="v">{fmt(lowResult.MR, 1)} MPa</td>
                    </tr>
                    <tr className="hl">
                      <td>Chất lượng nền (Điều 8.4.3)</td>
                      <td className="v">{lowResult.quality}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rsec">
              <div className="rh">
                <span className="rn">B</span>
                <h2>Chỉ số kết cấu SN tra Bảng 15/16</h2>
              </div>
              <div id="g_low_sn">
                {lowResult.loai === 'nhua' ? (
                  <table className="calc">
                    <thead>
                      <tr>
                        <th>Chất lượng nền</th>
                        <th>Cấp lưu lượng</th>
                        <th>
                          SN (Bảng {lowResult.tableNo}, R={lowResult.Rrel}%)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="hl">
                        <td>{lowResult.quality}</td>
                        <td>{lowResult.level}</td>
                        <td className="v">{lowResult.snr}</td>
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  <div className="hint">Mặt cấp phối đá dùng trực tiếp Bảng 19 (không qua SN).</div>
                )}
              </div>
            </section>

            <section className="rsec">
              <div className="rh">
                <span className="rn">C</span>
                <h2>Kết cấu đề xuất – Bảng 17/18/19</h2>
              </div>
              <div id="g_low_struct">
                {lowResult.loai === 'nhua' && lowResult.row ? (
                  <>
                    <table className="calc">
                      <tbody>
                        <tr>
                          <td>SN trung bình</td>
                          <td className="v">{lowResult.row.sn}</td>
                        </tr>
                        <tr>
                          <td>
                            Phương án Láng nhựa 2 lớp <span className="sub">(L.N/MT/MD)</span>
                          </td>
                          <td className="v">
                            {lowResult.row.ln === 'KD' ? (
                              <span style={{ color: 'var(--fail)' }}>KD – không nên dùng</span>
                            ) : (
                              `LN=${lowResult.row.ln[0]}cm / MT=${lowResult.row.ln[1]}cm / MĐ=${lowResult.row.ln[2]}cm`
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td>
                            Phương án Đá dăm thấm nhập nhựa <span className="sub">(M/MT/MD)</span>
                          </td>
                          <td className="v">{foLow(lowResult.row.dd)}</td>
                        </tr>
                        <tr>
                          <td>
                            Phương án Bê tông nhựa <span className="sub">(M/MT/MD)</span>
                          </td>
                          <td className="v">{foLow(lowResult.row.bt)}</td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="hint">
                      M = chiều dày lớp mặt; MT = móng trên (CPĐD xay nghiền/đá dăm nước); MĐ = móng dưới (cấp phối thiên nhiên),
                      đơn vị cm. KD = không nên dùng (móng quá dày); CT = cần cải thiện nền thượng đạt CBR≥6% trước khi áp dụng bảng.
                    </div>
                  </>
                ) : (
                  <table className="calc">
                    <tbody>
                      <tr className="hl">
                        <td>Chiều dày lớp cấp phối đá (E≥200 MPa, Bảng 19)</td>
                        <td className="v">
                          {lowResult.th === '**'
                            ? '** cần thiết kế loại khác / cải thiện nền thượng'
                            : `${fmt(Number(lowResult.th), 0)} cm`}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
