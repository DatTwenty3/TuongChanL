import { useMemo, useState, type ChangeEvent } from 'react';
import {
  RIGID_FORMULAS,
  computeNe,
  findMinHc,
  fmt,
  fmtI,
  type RigidInput,
  type RigidResult,
  type RigidStateSnapshot,
  type RigidTrafficInputs,
  type SavedRigidOption,
} from '../engine';
import { downloadRigidJson, parseRigidJson } from '../export';
import { PavementSectionSvg, type SectionLayerItem } from './PavementSectionSvg';

interface RigidModuleProps {
  visible: boolean;
  input: RigidInput;
  traffic: RigidTrafficInputs;
  result: RigidResult;
  options: SavedRigidOption[];
  onChangeInput: (next: RigidInput) => void;
  onChangeTraffic: (next: RigidTrafficInputs) => void;
  onSaveOption: () => void;
  onRenameOption: (idx: number, name: string) => void;
  onLoadOption: (idx: number) => void;
  onDeleteOption: (idx: number) => void;
  onImportBundle: (current?: RigidStateSnapshot, options?: SavedRigidOption[]) => void;
}

const MAT_BOUND_OPTIONS = [
  'CPĐD gia cố xi măng',
  'Bê tông đầm lăn',
  'Bê tông nghèo',
  'Đất gia cố xi măng',
];

export function RigidModule({
  visible,
  input,
  traffic,
  result,
  options,
  onChangeInput,
  onChangeTraffic,
  onSaveOption,
  onRenameOption,
  onLoadOption,
  onDeleteOption,
  onImportBundle,
}: RigidModuleProps) {
  const [minHcProbe, setMinHcProbe] = useState<{ tested: boolean; found: number | null; res?: RigidResult }>({
    tested: false,
    found: null,
  });

  const neSummary = useMemo(() => computeNe(traffic, input.Ps), [traffic, input.Ps]);

  const setField = <K extends keyof RigidInput>(key: K, val: RigidInput[K]) => {
    setMinHcProbe({ tested: false, found: null });
    onChangeInput({ ...input, [key]: val });
  };

  const setNum = (key: keyof RigidInput) => (e: ChangeEvent<HTMLInputElement>) => {
    setField(key, (parseFloat(e.target.value) || 0) as RigidInput[typeof key]);
  };

  const setTrafficNum = (key: keyof RigidTrafficInputs) => (e: ChangeEvent<HTMLInputElement>) => {
    onChangeTraffic({ ...traffic, [key]: parseFloat(e.target.value) || 0 });
  };

  const sectionLayers: SectionLayerItem[] = useMemo(() => {
    const out: SectionLayerItem[] = [
      {
        name: 'Tấm BTXM (tạo nhám phía trên)',
        thicknessCm: input.hc * 100,
        mat: 'concrete',
        detailText: `h=${fmt(input.hc * 100, 0)} cm · E=${fmtI(input.Ec)} MPa`,
      },
    ];
    if (input.Eb > 0 && input.hb > 0) {
      out.push({
        name: input.matBound,
        thicknessCm: input.hb * 100,
        mat: 'bound',
        detailText: `h=${fmt(input.hb * 100, 0)} cm · E=${fmtI(input.Eb)} MPa`,
      });
    }
    input.layers.forEach((l) => {
      if (l.h > 0) {
        out.push({
          name: l.name,
          thicknessCm: l.h * 100,
          mat: 'gran',
          detailText: `h=${fmt(l.h * 100, 0)} cm · E=${fmtI(l.E)} MPa`,
        });
      }
    });
    return out;
  }, [input]);

  const okAll = result.p1 && result.p2 && result.p3;
  const m1 = input.model === 1;

  const handleFindMinHc = () => {
    const found = findMinHc(input);
    if (found) {
      setMinHcProbe({ tested: true, found: found.hc, res: found.result });
    } else {
      setMinHcProbe({ tested: true, found: null });
    }
  };

  const handleImportFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseRigidJson(String(reader.result || ''));
        onImportBundle(parsed.current, parsed.options);
      } catch {
        window.alert('File .json không hợp lệ.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="module" id="mod-rigid" hidden={!visible}>
      <div className="wrap">
        <aside className="inputs" id="inputs">
          <div className="grp">
            <div className="gh">
              <span className="num">1</span>
              <h3>Cấp hạng &amp; mô hình tính</h3>
            </div>
            <div className="gb">
              <div className="fld full">
                <label>Cấp hạng đường</label>
                <input id="cap" type="text" value={input.cap} onChange={(e) => setField('cap', e.target.value)} />
              </div>
              <div className="fld full">
                <label>
                  Mô hình tính <span className="sub">(Điều 8.2.1)</span>
                </label>
                <select
                  id="model"
                  value={String(input.model)}
                  onChange={(e) => setField('model', parseInt(e.target.value, 10) === 1 ? 1 : 2)}
                >
                  <option value="1">MH1 – tấm 1 lớp / móng hạt (Đ8.3)</option>
                  <option value="2">MH2 – tấm 2 lớp / móng bó (Đ8.4)</option>
                </select>
              </div>
              <div className="fld full">
                <label>
                  Lớp cách ly BTN giữa tấm &amp; móng <span className="sub">(Đ8.4.5)</span>
                </label>
                <select
                  id="caly"
                  value={String(input.caly)}
                  onChange={(e) => setField('caly', parseInt(e.target.value, 10) === 1 ? 1 : 0)}
                >
                  <option value="0">Không có (tính kn từ tiếp xúc)</option>
                  <option value="1">Có (kn = 3000 MPa/m)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grp">
            <div className="gh">
              <span className="num">2</span>
              <h3>Tấm BTXM mặt đường</h3>
            </div>
            <div className="gb">
              <div className="fld">
                <label>
                  h<sub>c</sub> – Chiều dày tấm
                </label>
                <input id="hc" type="number" step="0.01" value={input.hc} onChange={setNum('hc')} />
                <span className="u">m</span>
              </div>
              <div className="fld">
                <label>L – Chiều dài tấm</label>
                <input id="L" type="number" step="0.1" value={input.L} onChange={setNum('L')} />
                <span className="u">m</span>
              </div>
              <div className="fld">
                <label>B – Chiều rộng tấm</label>
                <input id="B" type="number" step="0.1" value={input.B} onChange={setNum('B')} />
                <span className="u">m</span>
              </div>
              <div className="fld">
                <label>
                  f<sub>r</sub> – Cường độ kéo uốn TK
                </label>
                <input id="fr" type="number" step="0.1" value={input.fr} onChange={setNum('fr')} />
                <span className="u">MPa</span>
              </div>
              <div className="fld">
                <label>
                  E<sub>c</sub> – Mô đun đàn hồi
                </label>
                <input id="Ec" type="number" step="500" value={input.Ec} onChange={setNum('Ec')} />
                <span className="u">MPa</span>
              </div>
              <div className="fld">
                <label>
                  μ<sub>c</sub> – Hệ số Poisson
                </label>
                <input id="muc" type="number" step="0.01" value={input.muc} onChange={setNum('muc')} />
                <span className="u">–</span>
              </div>
              <div className="fld">
                <label>
                  α<sub>c</sub> – Hệ số dãn nở nhiệt
                </label>
                <input id="ac" type="number" step="0.000001" value={input.ac} onChange={setNum('ac')} />
                <span className="u">1/°C</span>
              </div>
              <div className="fld">
                <label>
                  T<sub>g</sub> – Gradien nhiệt lớn nhất
                </label>
                <input id="Tg" type="number" step="1" value={input.Tg} onChange={setNum('Tg')} />
                <span className="u">°C/m</span>
              </div>
            </div>
          </div>

          <div className="grp">
            <div className="gh">
              <span className="num">3</span>
              <h3>Tải trọng &amp; giao thông</h3>
            </div>
            <div className="gb">
              <div className="fld">
                <label>
                  P<sub>s</sub> – Trục tính mỏi
                </label>
                <input id="Ps" type="number" step="5" value={input.Ps} onChange={setNum('Ps')} />
                <span className="u">kN</span>
              </div>
              <div className="fld">
                <label>
                  P<sub>max</sub> – Trục nặng nhất
                </label>
                <input id="Pmax" type="number" step="5" value={input.Pmax} onChange={setNum('Pmax')} />
                <span className="u">kN</span>
              </div>
              <div className="fld">
                <label>
                  N<sub>e</sub> – Số trục tích lũy
                </label>
                <input id="Ne" type="number" step="1000" value={input.Ne} onChange={setNum('Ne')} />
                <span className="u">lần</span>
              </div>
            </div>
          </div>

          <div className="grp">
            <div className="gh">
              <span className="num">4</span>
              <h3>Hệ số &amp; nền đất</h3>
            </div>
            <div className="gb">
              <div className="fld">
                <label>
                  k<sub>r</sub> – Triết giảm US
                </label>
                <input id="kr" type="number" step="0.01" value={input.kr} onChange={setNum('kr')} />
                <span className="u">–</span>
              </div>
              <div className="fld">
                <label>
                  k<sub>c</sub> – Tổng hợp động
                </label>
                <input id="kc" type="number" step="0.01" value={input.kc} onChange={setNum('kc')} />
                <span className="u">–</span>
              </div>
              <div className="fld">
                <label>
                  γ<sub>r</sub> – Độ tin cậy
                </label>
                <input id="gr" type="number" step="0.01" value={input.gr} onChange={setNum('gr')} />
                <span className="u">–</span>
              </div>
              <div className="fld">
                <label>
                  E<sub>0</sub> – Mô đun nền đất
                </label>
                <input id="E0" type="number" step="1" value={input.E0} onChange={setNum('E0')} />
                <span className="u">MPa</span>
              </div>
            </div>
          </div>

          <div className="grp">
            <div className="gh">
              <span className="num">5</span>
              <h3>Móng trên bó (Mô hình 2)</h3>
            </div>
            <div className="gb">
              <div className="fld full">
                <label>Vật liệu móng bó</label>
                <select id="matBound" value={input.matBound} onChange={(e) => setField('matBound', e.target.value)}>
                  {MAT_BOUND_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fld">
                <label>
                  E<sub>b</sub> – Mô đun <span className="sub">(0 nếu MH1)</span>
                </label>
                <input id="Eb" type="number" step="50" value={input.Eb} onChange={setNum('Eb')} />
                <span className="u">MPa</span>
              </div>
              <div className="fld">
                <label>
                  h<sub>b</sub> – Chiều dày
                </label>
                <input id="hb" type="number" step="0.01" value={input.hb} onChange={setNum('hb')} />
                <span className="u">m</span>
              </div>
              <div className="fld">
                <label>
                  μ<sub>b</sub> – Poisson
                </label>
                <input id="mub" type="number" step="0.01" value={input.mub} onChange={setNum('mub')} />
                <span className="u">–</span>
              </div>
              <div className="fld">
                <label>
                  f<sub>br</sub> – CĐ kéo uốn móng <span className="sub">(0: bỏ 8-3)</span>
                </label>
                <input id="fbr" type="number" step="0.1" value={input.fbr} onChange={setNum('fbr')} />
                <span className="u">MPa</span>
              </div>
            </div>
          </div>

          <div className="grp">
            <div className="gh">
              <span className="num">6</span>
              <h3>
                Lớp móng dạng hạt (tính E<sub>t</sub>)
              </h3>
            </div>
            <div className="gb">
              <div className="hint">MH1: nhập cả móng trên hạt; MH2: chỉ các lớp DƯỚI móng bó. Có thể thêm/bớt lớp tùy ý.</div>
              <div id="layerList">
                {input.layers.map((l, i) => (
                  <div className="lrow" key={i}>
                    {input.layers.length > 1 && (
                      <button
                        className="lx"
                        data-del={i}
                        type="button"
                        title="Xóa lớp"
                        onClick={() =>
                          setField(
                            'layers',
                            input.layers.filter((_, idx) => idx !== i),
                          )
                        }
                      >
                        ×
                      </button>
                    )}
                    <div className="fld full">
                      <label>Lớp hạt {i + 1} – Tên</label>
                      <input
                        data-k="name"
                        data-i={i}
                        type="text"
                        value={l.name}
                        onChange={(e) => {
                          const next = input.layers.map((item, idx) => (idx === i ? { ...item, name: e.target.value } : item));
                          setField('layers', next);
                        }}
                      />
                    </div>
                    <div className="fld">
                      <label>E</label>
                      <input
                        data-k="E"
                        data-i={i}
                        type="number"
                        step="10"
                        value={l.E}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 0;
                          const next = input.layers.map((item, idx) => (idx === i ? { ...item, E: v } : item));
                          setField('layers', next);
                        }}
                      />
                      <span className="u">MPa</span>
                    </div>
                    <div className="fld">
                      <label>h</label>
                      <input
                        data-k="h"
                        data-i={i}
                        type="number"
                        step="0.01"
                        value={l.h}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 0;
                          const next = input.layers.map((item, idx) => (idx === i ? { ...item, h: v } : item));
                          setField('layers', next);
                        }}
                      />
                      <span className="u">m</span>
                    </div>
                  </div>
                ))}
              </div>
              <button
                className="addbtn"
                id="addLayer"
                type="button"
                onClick={() =>
                  setField('layers', [...input.layers, { name: `Lớp hạt ${input.layers.length + 1}`, E: 300, h: 0.15 }])
                }
              >
                + Thêm lớp móng hạt
              </button>
            </div>
          </div>

          <div className="grp">
            <div className="gh">
              <span className="num">7</span>
              <h3>
                Tính N<sub>e</sub> từ lưu lượng (Phụ lục A)
              </h3>
            </div>
            <div className="gb">
              <div className="hint">Nhập lưu lượng và phổ trục để tính N<sub>e</sub>, rồi bấm &quot;Áp dụng&quot;.</div>
              <div className="fld">
                <label>ADTT – xe nặng 2 chiều, năm đầu</label>
                <input id="adtt" type="number" step="10" value={traffic.adtt} onChange={setTrafficNum('adtt')} />
                <span className="u">xe/ng</span>
              </div>
              <div className="fld">
                <label>
                  f<sub>hướng</sub> <span className="sub">(0,5–0,6)</span>
                </label>
                <input id="fhuong" type="number" step="0.05" value={traffic.fhuong} onChange={setTrafficNum('fhuong')} />
                <span className="u">–</span>
              </div>
              <div className="fld">
                <label>
                  f<sub>làn</sub> <span className="sub">(Bảng A.1)</span>
                </label>
                <input id="flan" type="number" step="0.05" value={traffic.flan} onChange={setTrafficNum('flan')} />
                <span className="u">–</span>
              </div>
              <div className="fld">
                <label>n – trục đơn / 3000 xe điều tra</label>
                <input id="naxle" type="number" step="100" value={traffic.naxle} onChange={setTrafficNum('naxle')} />
                <span className="u">trục</span>
              </div>
              <div className="fld">
                <label>
                  g<sub>r</sub> – tăng trưởng năm
                </label>
                <input id="grow" type="number" step="0.5" value={traffic.grow} onChange={setTrafficNum('grow')} />
                <span className="u">%</span>
              </div>
              <div className="fld">
                <label>t – thời hạn phục vụ</label>
                <input id="tyear" type="number" step="1" value={traffic.tyear} onChange={setTrafficNum('tyear')} />
                <span className="u">năm</span>
              </div>
              <div className="fld">
                <label>
                  η – phân bố ngang <span className="sub">(Bảng A.2)</span>
                </label>
                <input id="eta" type="number" step="0.01" value={traffic.eta} onChange={setTrafficNum('eta')} />
                <span className="u">–</span>
              </div>
              <div className="subhead">Phổ tải trọng trục</div>
              <table className="netbl">
                <thead>
                  <tr>
                    <th>
                      P<sub>i</sub> (kN)
                    </th>
                    <th>
                      p<sub>i</sub> (%)
                    </th>
                    <th style={{ width: '26px' }} />
                  </tr>
                </thead>
                <tbody id="spectbody">
                  {traffic.spec.map((s, i) => (
                    <tr key={i}>
                      <td>
                        <input
                          data-si={i}
                          data-sk="P"
                          type="number"
                          step="10"
                          value={s.P}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value) || 0;
                            onChangeTraffic({
                              ...traffic,
                              spec: traffic.spec.map((item, idx) => (idx === i ? { ...item, P: v } : item)),
                            });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          data-si={i}
                          data-sk="p"
                          type="number"
                          step="1"
                          value={s.p}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value) || 0;
                            onChangeTraffic({
                              ...traffic,
                              spec: traffic.spec.map((item, idx) => (idx === i ? { ...item, p: v } : item)),
                            });
                          }}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {traffic.spec.length > 1 && (
                          <button
                            className="lx"
                            data-sdel={i}
                            type="button"
                            onClick={() =>
                              onChangeTraffic({
                                ...traffic,
                                spec: traffic.spec.filter((_, idx) => idx !== i),
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
              <button
                className="smallbtn"
                id="addSpec"
                type="button"
                onClick={() => onChangeTraffic({ ...traffic, spec: [...traffic.spec, { P: 100, p: 0 }] })}
              >
                + Dòng phổ trục
              </button>
              <div className="neOut" id="neOut">
                ADTT<sub>làn</sub> = <b>{fmt(neSummary.adttlan, 1)}</b> xe/ng·làn · Σ(k<sub>ni</sub>·p<sub>i</sub>) ={' '}
                <b>{fmt(neSummary.sum, 3)}</b>
                <br />
                N<sub>s</sub>¹ = <b>{fmt(neSummary.Ns1, 2)}</b> trục/ng·làn → <b>N<sub>e</sub> = {fmtI(neSummary.Ne)}</b> lần
                {Math.abs(neSummary.ptot - 100) > 0.5 && (
                  <>
                    <br />
                    <span style={{ color: 'var(--fail)' }}>⚠ Σp<sub>i</sub> = {fmt(neSummary.ptot, 1)}% (nên = 100%)</span>
                  </>
                )}
              </div>
              <button
                className="smallbtn"
                id="applyNe"
                type="button"
                style={{
                  marginTop: '9px',
                  width: '100%',
                  borderColor: 'var(--steel)',
                  background: 'var(--steel)',
                  color: '#fff',
                }}
                onClick={() => setField('Ne', Math.round(neSummary.Ne))}
              >
                Áp dụng N<sub>e</sub> này vào tính toán
              </button>
            </div>
          </div>
        </aside>

        <main className="results">
          <section className="rsec">
            <div className="rh">
              <span className="rn">A</span>
              <h2>Cắt ngang kết cấu áo đường</h2>
            </div>
            <div className="sectionwrap">
              <div id="section">
                <PavementSectionSvg
                  idPrefix="r_"
                  layers={sectionLayers}
                  subgradeText={`E₀=${fmtI(input.E0)} MPa`}
                  loadMode="pmax"
                  loadValueKn={input.Pmax}
                  concreteSurfaceDetail
                  showTotalDim
                />
              </div>
            </div>
            <div className="cap">Hình vẽ tự cập nhật theo chiều dày các lớp. Chú thích ghi kèm mô đun E và chiều dày mỗi lớp.</div>
          </section>

          <section className="rsec">
            <div className="rh">
              <span className="rn">B</span>
              <h2>Kết quả kiểm toán trạng thái giới hạn</h2>
            </div>
            <div className="minbar">
              <button className="smallbtn" id="btnMin" type="button" onClick={handleFindMinHc}>
                Dò h&#x200A;<sub>c</sub> tối thiểu
              </button>
              <span className="r" id="minRes">
                {!minHcProbe.tested && 'Giữ nguyên các thông số khác, tìm chiều dày tấm nhỏ nhất đạt đủ trạng thái giới hạn.'}
                {minHcProbe.tested && minHcProbe.found !== null && minHcProbe.res && (
                  <>
                    Tối thiểu <b>h<sub>c</sub> = {fmt(minHcProbe.found * 100, 1)} cm</b> → (8-1)={fmt(minHcProbe.res.c1, 3)}; (8-2)=
                    {fmt(minHcProbe.res.c2, 3)} MPa ≤ f<sub>r</sub>={fmt(input.fr, 1)}.{' '}
                    <button
                      className="smallbtn"
                      id="applyMin"
                      type="button"
                      style={{ marginLeft: '8px' }}
                      onClick={() => setField('hc', Number(minHcProbe.found!.toFixed(3)))}
                    >
                      Áp dụng
                    </button>
                  </>
                )}
                {minHcProbe.tested && minHcProbe.found === null && (
                  <span style={{ color: 'var(--fail)' }}>
                    Không có h<sub>c</sub> ≤ 42 cm đạt yêu cầu — cần tăng E móng, giảm tải trọng hoặc giảm kích thước tấm.
                  </span>
                )}
              </span>
            </div>

            <div className="vgrid" id="verdicts">
              <div className={`vcard ${result.p1 ? 'pass' : 'fail'}`}>
                <span className="tag">{result.p1 ? 'ĐẠT' : 'KHÔNG ĐẠT'}</span>
                <div className="vt">TTGH mỏi tổng hợp (6)/(8-1)</div>
                <div className="veq">
                  γ<sub>r</sub>(σ<sub>pr</sub>+σ<sub>tr</sub>) ≤ f<sub>r</sub>
                </div>
                <div className="vres">
                  <span className="lhs">{fmt(result.c1, 3)}</span>
                  <span className="op">≤</span>
                  <span className="rhs">{fmt(input.fr, 2)}</span>
                  <span className="op" style={{ fontSize: '11px' }}>
                    MPa
                  </span>
                </div>
              </div>

              <div className={`vcard ${result.p2 ? 'pass' : 'fail'}`}>
                <span className="tag">{result.p2 ? 'ĐẠT' : 'KHÔNG ĐẠT'}</span>
                <div className="vt">TTGH trục nặng nhất (7)/(8-2)</div>
                <div className="veq">
                  γ<sub>r</sub>(σ<sub>pmax</sub>+σ<sub>tmax</sub>) ≤ f<sub>r</sub>
                </div>
                <div className="vres">
                  <span className="lhs">{fmt(result.c2, 3)}</span>
                  <span className="op">≤</span>
                  <span className="rhs">{fmt(input.fr, 2)}</span>
                  <span className="op" style={{ fontSize: '11px' }}>
                    MPa
                  </span>
                </div>
              </div>

              <div className={`vcard ${!result.app3 ? 'na' : result.p3 ? 'pass' : 'fail'}`}>
                <span className="tag">{!result.app3 ? 'KHÔNG XÉT' : result.p3 ? 'ĐẠT' : 'KHÔNG ĐẠT'}</span>
                <div className="vt">TTGH đáy móng bó (8)/(8-3)</div>
                <div className="veq">
                  γ<sub>r</sub>·σ<sub>bpr</sub> ≤ f<sub>br</sub>
                </div>
                <div className="vres">
                  <span className="lhs">{!result.app3 ? '—' : fmt(result.c3, 3)}</span>
                  <span className="op">≤</span>
                  <span className="rhs">{!result.app3 ? '—' : fmt(input.fbr, 2)}</span>
                  <span className="op" style={{ fontSize: '11px' }}>
                    MPa
                  </span>
                </div>
              </div>
            </div>

            <div id="overall">
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
                      ? 'KẾT CẤU ĐẠT YÊU CẦU theo TCCS 39'
                      : 'KẾT CẤU KHÔNG ĐẠT – cần điều chỉnh chiều dày/cấu tạo'}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rsec">
            <div className="rh">
              <span className="rn">C</span>
              <h2>Chi tiết tính toán</h2>
            </div>
            <div id="table">
              <table className="calc">
                <thead>
                  <tr>
                    <th>Đại lượng</th>
                    <th style={{ textAlign: 'right' }}>Giá trị</th>
                    <th>Đơn vị</th>
                    <th style={{ textAlign: 'right' }}>Biểu thức</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="sub">
                    <td colSpan={4}>II · Mô đun nền tương đương</td>
                  </tr>
                  <tr>
                    <td>
                      E<sub>x</sub> – mô đun lớp hạt tương đương
                    </td>
                    <td className="v">{fmt(result.Ex, 1)}</td>
                    <td className="u">MPa</td>
                    <td className="eq">(13)</td>
                  </tr>
                  <tr>
                    <td>
                      h<sub>x</sub> – tổng bề dày lớp hạt
                    </td>
                    <td className="v">{fmt(result.hx, 3)}</td>
                    <td className="u">m</td>
                    <td className="eq">(15)</td>
                  </tr>
                  <tr>
                    <td>α – hệ số hồi quy</td>
                    <td className="v">{fmt(result.alpha, 4)}</td>
                    <td className="u">–</td>
                    <td className="eq">(14)</td>
                  </tr>
                  <tr className="hl">
                    <td>
                      E<sub>t</sub> – mô đun nền tương đương
                    </td>
                    <td className="v">{fmt(result.Et, 2)}</td>
                    <td className="u">MPa</td>
                    <td className="eq">(12)</td>
                  </tr>

                  <tr className="sub">
                    <td colSpan={4}>III · Độ cứng &amp; bán kính độ cứng</td>
                  </tr>
                  <tr>
                    <td>
                      D<sub>c</sub> – độ cứng chịu uốn tấm
                    </td>
                    <td className="v">{fmt(result.Dc, 3)}</td>
                    <td className="u">MN·m</td>
                    <td className="eq">(11)</td>
                  </tr>
                  <tr>
                    <td>
                      D<sub>b</sub> – độ cứng chịu uốn móng bó
                    </td>
                    <td className="v">{fmt(result.Db, 3)}</td>
                    <td className="u">MN·m</td>
                    <td className="eq">(25)</td>
                  </tr>
                  <tr>
                    <td>r – bán kính độ cứng (MH1)</td>
                    <td className="v">{fmt(result.r, 4)}</td>
                    <td className="u">m</td>
                    <td className="eq">(11)</td>
                  </tr>
                  <tr>
                    <td>
                      r<sub>g</sub> – bán kính độ cứng (MH2)
                    </td>
                    <td className="v">{fmt(result.rg, 4)}</td>
                    <td className="u">m</td>
                    <td className="eq">(25)</td>
                  </tr>
                  <tr className="hl">
                    <td>R – bán kính áp dụng (MH{input.model})</td>
                    <td className="v">{fmt(result.R, 4)}</td>
                    <td className="u">m</td>
                    <td className="eq" />
                  </tr>

                  <tr className="sub">
                    <td colSpan={4}>IV · Ứng suất do tải trọng xe</td>
                  </tr>
                  <tr>
                    <td>
                      k<sub>f</sub> – hệ số mỏi mặt
                    </td>
                    <td className="v">{fmt(result.kf, 4)}</td>
                    <td className="u">–</td>
                    <td className="eq">(16)</td>
                  </tr>
                  <tr>
                    <td>
                      σ<sub>ps</sub> (P<sub>s</sub>) – {m1 ? 'MH1' : 'MH2'}
                    </td>
                    <td className="v">{fmt(m1 ? result.sps1 : result.sps2, 3)}</td>
                    <td className="u">MPa</td>
                    <td className="eq">{m1 ? '(11)' : '(25)'}</td>
                  </tr>
                  <tr>
                    <td>
                      σ<sub>pm</sub> (P<sub>max</sub>) – {m1 ? 'MH1' : 'MH2'}
                    </td>
                    <td className="v">{fmt(m1 ? result.spm1 : result.spm2, 3)}</td>
                    <td className="u">MPa</td>
                    <td className="eq">{m1 ? '(11)' : '(25)'}</td>
                  </tr>
                  <tr className="hl">
                    <td>
                      σ<sub>pr</sub> – US kéo uốn mỏi do tải
                    </td>
                    <td className="v">{fmt(result.spr, 3)}</td>
                    <td className="u">MPa</td>
                    <td className="eq">(10)</td>
                  </tr>
                  <tr className="hl">
                    <td>
                      σ<sub>pmax</sub> – US do trục nặng nhất
                    </td>
                    <td className="v">{fmt(result.spmax, 3)}</td>
                    <td className="u">MPa</td>
                    <td className="eq">(20)</td>
                  </tr>

                  <tr className="sub">
                    <td colSpan={4}>V · Ứng suất do gradien nhiệt</td>
                  </tr>
                  <tr>
                    <td>t – thông số nhiệt</td>
                    <td className="v">{fmt(result.t, 4)}</td>
                    <td className="u">–</td>
                    <td className="eq">(23/28)</td>
                  </tr>
                  {!m1 && (
                    <>
                      <tr>
                        <td>
                          k<sub>n</sub> – độ cứng tiếp xúc
                        </td>
                        <td className="v">{fmt(result.kn, 1)}</td>
                        <td className="u">MPa/m</td>
                        <td className="eq">(28)</td>
                      </tr>
                      <tr>
                        <td>
                          r<sub>β</sub> – bán kính tiếp xúc
                        </td>
                        <td className="v">{fmt(result.rb, 4)}</td>
                        <td className="u">m</td>
                        <td className="eq">(28)</td>
                      </tr>
                      <tr>
                        <td>ζ – hệ số kết cấu 2 lớp</td>
                        <td className="v">{fmt(result.zeta, 4)}</td>
                        <td className="u">–</td>
                        <td className="eq">(28)</td>
                      </tr>
                    </>
                  )}
                  <tr>
                    <td>
                      C<sub>L</sub> – hệ số uốn vồng
                    </td>
                    <td className="v">{fmt(result.CL, 4)}</td>
                    <td className="u">–</td>
                    <td className="eq">{m1 ? '(23)' : '(28)'}</td>
                  </tr>
                  <tr>
                    <td>
                      B<sub>L</sub> – hệ số US nhiệt tổng hợp
                    </td>
                    <td className="v">{fmt(result.BL, 4)}</td>
                    <td className="u">–</td>
                    <td className="eq">(23)</td>
                  </tr>
                  <tr className="hl">
                    <td>
                      σ<sub>tmax</sub> – US nhiệt lớn nhất
                    </td>
                    <td className="v">{fmt(result.stmax, 3)}</td>
                    <td className="u">MPa</td>
                    <td className="eq">(22)</td>
                  </tr>
                  <tr>
                    <td>
                      k<sub>t</sub> – hệ số mỏi nhiệt
                    </td>
                    <td className="v">{fmt(result.kt, 4)}</td>
                    <td className="u">–</td>
                    <td className="eq">(24)</td>
                  </tr>
                  <tr className="hl">
                    <td>
                      σ<sub>tr</sub> – US nhiệt gây mỏi
                    </td>
                    <td className="v">{fmt(result.str, 3)}</td>
                    <td className="u">MPa</td>
                    <td className="eq">(21)</td>
                  </tr>

                  {result.Db > 0 && (
                    <>
                      <tr className="sub">
                        <td colSpan={4}>VI · Ứng suất đáy móng bó (MH2)</td>
                      </tr>
                      <tr>
                        <td>
                          σ<sub>bps</sub> – US đáy móng do P<sub>s</sub>
                        </td>
                        <td className="v">{fmt(result.sbps, 3)}</td>
                        <td className="u">MPa</td>
                        <td className="eq">(27)</td>
                      </tr>
                      <tr className="hl">
                        <td>
                          σ<sub>bpr</sub> – US mỏi đáy móng bó
                        </td>
                        <td className="v">{fmt(result.sbpr, 3)}</td>
                        <td className="u">MPa</td>
                        <td className="eq">(26)</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rsec">
            <div className="rh">
              <span className="rn">D</span>
              <h2>Công thức áp dụng theo TCCS 39</h2>
            </div>
            <div className="fgrid" id="formulas">
              {RIGID_FORMULAS.map(([nameHtml, exprHtml, eq], idx) => (
                <div className="fcard" key={idx}>
                  <div className="fn">
                    <span dangerouslySetInnerHTML={{ __html: nameHtml }} />
                    <span className="eq">{eq}</span>
                  </div>
                  <div className="fx" dangerouslySetInnerHTML={{ __html: exprHtml }} />
                </div>
              ))}
            </div>
          </section>

          <section className="rsec">
            <div className="rh">
              <span className="rn">E</span>
              <h2>So sánh phương án</h2>
            </div>
            <div className="optbar">
              <button className="smallbtn" id="saveOpt" type="button" onClick={onSaveOption}>
                ＋ Lưu phương án hiện tại
              </button>
              <button
                className="smallbtn"
                id="expJson"
                type="button"
                onClick={() => downloadRigidJson({ input, traffic }, options)}
              >
                Xuất bộ số liệu (.json)
              </button>
              <label className="smallbtn" htmlFor="impJson" style={{ cursor: 'pointer' }}>
                Nạp bộ số liệu (.json)
              </label>
              <input id="impJson" type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportFile} />
            </div>
            <div id="compare">
              {!options.length ? (
                <div className="hint" style={{ padding: '6px' }}>
                  Chưa có phương án nào. Bấm “Lưu phương án hiện tại” để thêm và so sánh.
                </div>
              ) : (
                <table className="cmp">
                  <thead>
                    <tr>
                      <th>Chỉ tiêu</th>
                      {options.map((o, i) => (
                        <th key={i}>
                          <input
                            className="onm"
                            data-onm={i}
                            value={o.name}
                            onChange={(e) => onRenameOption(i, e.target.value)}
                          />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Mô hình', (o: SavedRigidOption) => `MH${o.state.input.model}`],
                      ['h_c (cm)', (o: SavedRigidOption) => fmt(o.state.input.hc * 100, 1)],
                      ['f_r (MPa)', (o: SavedRigidOption) => fmt(o.state.input.fr, 2)],
                      ['E_c (MPa)', (o: SavedRigidOption) => fmtI(o.state.input.Ec)],
                      [
                        'Móng bó E_b',
                        (o: SavedRigidOption) => (o.state.input.Eb > 0 ? `${fmtI(o.state.input.Eb)} MPa` : '—'),
                      ],
                      ['N_e', (o: SavedRigidOption) => fmtI(o.state.input.Ne)],
                      ['σ_pr', (o: SavedRigidOption) => fmt(o.result.spr, 3)],
                      ['σ_pmax', (o: SavedRigidOption) => fmt(o.result.spmax, 3)],
                      ['σ_tmax', (o: SavedRigidOption) => fmt(o.result.stmax, 3)],
                      ['(8-1)', (o: SavedRigidOption) => fmt(o.result.c1, 3)],
                      ['(8-2)', (o: SavedRigidOption) => fmt(o.result.c2, 3)],
                    ].map(([label, getter]) => (
                      <tr key={String(label)}>
                        <td>{label as string}</td>
                        {options.map((o, idx) => (
                          <td className="v" key={idx}>
                            {(getter as (o: SavedRigidOption) => string)(o)}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr>
                      <td>Kết luận</td>
                      {options.map((o, idx) => {
                        const ok = o.result.p1 && o.result.p2 && o.result.p3;
                        return (
                          <td
                            className="v"
                            key={idx}
                            style={{ fontWeight: 700, color: ok ? 'var(--pass)' : 'var(--fail)' }}
                          >
                            {ok ? 'ĐẠT' : 'KHÔNG ĐẠT'}
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td />
                      {options.map((_, i) => (
                        <td className="v" key={i}>
                          <button className="smallbtn" data-oload={i} type="button" onClick={() => onLoadOption(i)}>
                            Nạp
                          </button>{' '}
                          <button
                            className="lx"
                            data-odel={i}
                            type="button"
                            style={{ position: 'static' }}
                            onClick={() => onDeleteOption(i)}
                          >
                            ×
                          </button>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
