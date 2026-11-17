import { useMemo, type ChangeEvent } from 'react';
import { DRAIN_FORMULAS, calcDrain, fmt, fmtExp, type DrainInput } from '../engine';

interface DrainModuleProps {
  visible: boolean;
  input: DrainInput;
  onChange: (next: DrainInput) => void;
}

export function DrainModule({ visible, input, onChange }: DrainModuleProps) {
  const res = useMemo(() => calcDrain(input), [input]);

  const setNum = (k: keyof DrainInput) => (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...input, [k]: parseFloat(e.target.value) || 0 });
  };

  const vcard = (tt: string, lhs: string, op: string, rhs: string, unit: string, pass: boolean) => (
    <div className={`vcard ${pass ? 'pass' : 'fail'}`}>
      <span className="tag">{pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}</span>
      <div className="vt">{tt}</div>
      <div className="vres">
        <span className="lhs">{lhs}</span>
        <span className="op">{op}</span>
        <span className="rhs">{rhs}</span>
        <span className="op" style={{ fontSize: '11px' }}>
          {unit}
        </span>
      </div>
    </div>
  );

  return (
    <div className="module" id="mod-drain" hidden={!visible}>
      <div className="wrap">
        <aside className="inputs">
          <div className="grp">
            <div className="gh">
              <span className="num">1</span>
              <h3>Nước thấm qua mặt đường</h3>
            </div>
            <div className="gb">
              <div className="fld">
                <label>
                  I<sub>c</sub> – suất nước thấm qua khe
                </label>
                <input id="d_Ic" type="number" step="0.01" value={input.Ic} onChange={setNum('Ic')} />
                <span className="u">m³/ng·m</span>
              </div>
              <div className="fld">
                <label>N – số làn trong bề rộng B</label>
                <input id="d_N" type="number" step="1" value={input.N} onChange={setNum('N')} />
                <span className="u">làn</span>
              </div>
              <div className="fld">
                <label>
                  n<sub>h</sub> – khe ngang trong phạm vi L
                </label>
                <input id="d_nh" type="number" step="1" value={input.nh} onChange={setNum('nh')} />
                <span className="u">–</span>
              </div>
              <div className="fld">
                <label>B – bề rộng cùng độ dốc ngang</label>
                <input id="d_B" type="number" step="0.1" value={input.B} onChange={setNum('B')} />
                <span className="u">m</span>
              </div>
              <div className="fld">
                <label>L – khoảng cách khe ngang</label>
                <input id="d_L" type="number" step="0.1" value={input.L} onChange={setNum('L')} />
                <span className="u">m</span>
              </div>
            </div>
          </div>

          <div className="grp">
            <div className="gh">
              <span className="num">2</span>
              <h3>Lớp móng thoát nước</h3>
            </div>
            <div className="gb">
              <div className="fld">
                <label>
                  i<sub>d</sub> – độ dốc dọc lớp móng
                </label>
                <input id="d_id" type="number" step="0.1" value={input.id} onChange={setNum('id')} />
                <span className="u">%</span>
              </div>
              <div className="fld">
                <label>
                  i<sub>n</sub> – độ dốc ngang lớp móng
                </label>
                <input id="d_in" type="number" step="0.1" value={input.in_} onChange={setNum('in_')} />
                <span className="u">%</span>
              </div>
              <div className="fld">
                <label>
                  k<sub>b</sub> – hệ số thấm vật liệu móng
                </label>
                <input id="d_kb" type="number" step="10" value={input.kb} onChange={setNum('kb')} />
                <span className="u">m/ng·đ</span>
              </div>
              <div className="fld">
                <label>
                  n<sub>e</sub> – độ rỗng hữu hiệu
                </label>
                <input id="d_ne" type="number" step="0.01" value={input.ne} onChange={setNum('ne')} />
                <span className="u">–</span>
              </div>
              <div className="fld">
                <label>
                  h<sub>bt</sub> – chiều dày lớp thoát nước
                </label>
                <input id="d_hbt" type="number" step="0.01" value={input.hbt} onChange={setNum('hbt')} />
                <span className="u">m</span>
              </div>
            </div>
          </div>
        </aside>

        <main className="results">
          <section className="rsec">
            <div className="rh">
              <span className="rn">A</span>
              <h2>Kết quả kiểm toán thoát nước</h2>
            </div>
            <div id="d_out">
              <table className="calc" style={{ marginBottom: '14px' }}>
                <tbody>
                  <tr>
                    <td>
                      n<sub>z</sub> = N+1 (số khe dọc)
                    </td>
                    <td className="v">{res.nz}</td>
                    <td className="u">–</td>
                  </tr>
                  <tr className="hl">
                    <td>
                      Q<sub>i</sub> – lượng nước thấm
                    </td>
                    <td className="v">{fmt(res.Qi, 4)}</td>
                    <td className="u">m³/ng·m</td>
                  </tr>
                  <tr>
                    <td>
                      L<sub>s</sub> – chiều dài đường thấm
                    </td>
                    <td className="v">{fmt(res.Ls, 3)}</td>
                    <td className="u">m</td>
                  </tr>
                  <tr>
                    <td>
                      v<sub>s</sub> – tốc độ thấm
                    </td>
                    <td className="v">{res.vs > 0 ? fmtExp(res.vs, 3) : '–'}</td>
                    <td className="u">m/s</td>
                  </tr>
                  <tr className="hl">
                    <td>t – thời gian thấm ra khỏi móng</td>
                    <td className="v">{Number.isFinite(res.t) ? fmt(res.t, 3) : '∞'}</td>
                    <td className="u">giờ</td>
                  </tr>
                </tbody>
              </table>

              <div className="vgrid">
                {vcard(
                  'Thời gian thấm ≤ 2 h (Điều 7.1.3)',
                  Number.isFinite(res.t) ? fmt(res.t, 3) : '∞',
                  '≤',
                  '2',
                  ' h',
                  res.t <= 2,
                )}
                {vcard('Chiều dài đường thấm ≤ 45–60 m', fmt(res.Ls, 1), '≤', '60', ' m', res.Ls <= 60)}
                {vcard(
                  'Khả năng thoát: h_bt·v_s ≥ Q_i (5)',
                  fmt(res.cap, 3),
                  '≥',
                  fmt(res.Qi, 3),
                  ' m²/ng',
                  res.cap >= res.Qi,
                )}
              </div>
            </div>
          </section>

          <section className="rsec">
            <div className="rh">
              <span className="rn">B</span>
              <h2>Công thức (Điều 7)</h2>
            </div>
            <div className="fgrid">
              {DRAIN_FORMULAS.map(([nameHtml, exprHtml, eq], i) => (
                <div className="fcard" key={i}>
                  <div className="fn">
                    <span dangerouslySetInnerHTML={{ __html: nameHtml }} />
                    <span className="eq">{eq}</span>
                  </div>
                  <div className="fx" dangerouslySetInnerHTML={{ __html: exprHtml }} />
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
