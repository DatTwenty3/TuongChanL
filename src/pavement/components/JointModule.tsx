import { useMemo } from 'react';
import { calcJoint, type JointInput } from '../engine';

interface JointModuleProps {
  visible: boolean;
  input: JointInput;
  onChange: (next: JointInput) => void;
}

export function JointModule({ visible, input, onChange }: JointModuleProps) {
  const r = useMemo(() => calcJoint(input), [input]);

  return (
    <div className="module" id="mod-joint" hidden={!visible}>
      <div className="wrap">
        <aside className="inputs">
          <div className="grp">
            <div className="gh">
              <span className="num">1</span>
              <h3>Thông số tấm &amp; móng</h3>
            </div>
            <div className="gb">
              <div className="fld">
                <label>h – chiều dày tấm BTXM</label>
                <input
                  id="j_h"
                  type="number"
                  step="1"
                  value={input.h}
                  onChange={(e) => onChange({ ...input, h: parseFloat(e.target.value) || 0 })}
                />
                <span className="u">cm</span>
              </div>
              <div className="fld full">
                <label>Khoảng cách đến khe dọc liền kề (m)</label>
                <select
                  id="j_kc"
                  value={input.kc}
                  onChange={(e) => onChange({ ...input, kc: e.target.value as JointInput['kc'] })}
                >
                  <option value="3.00">3.00</option>
                  <option value="3.50">3.50</option>
                  <option value="3.75">3.75</option>
                  <option value="4.50">4.50</option>
                </select>
              </div>
              <div className="fld full">
                <label>Lớp móng dưới (quyết chiều sâu khe dọc giả)</label>
                <select
                  id="j_mong"
                  value={input.mong}
                  onChange={(e) => onChange({ ...input, mong: e.target.value as JointInput['mong'] })}
                >
                  <option value="hat">CPĐD dạng hạt → 1/3·h</option>
                  <option value="gc">Gia cố chất liên kết → 2/5·h</option>
                </select>
              </div>
              <div className="fld full">
                <label>Cấp đường (số lần cắt khe co)</label>
                <select
                  id="j_cap"
                  value={input.cap}
                  onChange={(e) => onChange({ ...input, cap: e.target.value as JointInput['cap'] })}
                >
                  <option value="thap">Cấp III trở xuống → cắt 1 lần</option>
                  <option value="cao">Cao tốc / cấp I, II → cắt 2 lần</option>
                </select>
              </div>
              <div className="fld">
                <label>L – chiều dài tấm (cho khe dãn)</label>
                <input
                  id="j_L"
                  type="number"
                  step="0.1"
                  value={input.L}
                  onChange={(e) => onChange({ ...input, L: parseFloat(e.target.value) || 0 })}
                />
                <span className="u">m</span>
              </div>
            </div>
          </div>
        </aside>

        <main className="results">
          <section className="rsec">
            <div className="rh">
              <span className="rn">A</span>
              <h2>Cấu tạo khe nối &amp; thanh thép</h2>
            </div>
            <div id="j_out">
              <table className="calc">
                <thead>
                  <tr>
                    <th>Hạng mục</th>
                    <th>Cấu tạo</th>
                    <th style={{ textAlign: 'right' }}>Nguồn</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="sub">
                    <td colSpan={3}>Thanh liên kết khe dọc (Bảng 5)</td>
                  </tr>
                  <tr className="hl">
                    <td>Đường kính × dài × khoảng cách</td>
                    <td className="v">{r.tie} mm</td>
                    <td className="eq">Bảng 5</td>
                  </tr>
                  <tr>
                    <td>Vị trí / xử lý</td>
                    <td>Đặt giữa chiều dày tấm, xử lý chống gỉ 100 mm đoạn giữa</td>
                    <td className="eq">6.1.4</td>
                  </tr>

                  <tr className="sub">
                    <td colSpan={3}>Thanh truyền lực khe ngang – thép trơn (Bảng 6)</td>
                  </tr>
                  <tr className="hl">
                    <td>Đường kính</td>
                    <td className="v">Ø{r.d[1]} mm</td>
                    <td className="eq">Bảng 6</td>
                  </tr>
                  <tr>
                    <td>Chiều dài tối thiểu</td>
                    <td className="v">{r.d[2]} mm</td>
                    <td className="eq">Bảng 6</td>
                  </tr>
                  <tr>
                    <td>Khoảng cách lớn nhất</td>
                    <td className="v">{r.d[3]} mm</td>
                    <td className="eq">Bảng 6</td>
                  </tr>
                  <tr>
                    <td>Khoảng cách mép ngoài–thanh ngoài cùng</td>
                    <td>150–250 mm</td>
                    <td className="eq">6.2.6</td>
                  </tr>

                  <tr className="sub">
                    <td colSpan={3}>Chiều sâu / bề rộng cắt khe</td>
                  </tr>
                  <tr>
                    <td>Khe dọc ngừng thi công</td>
                    <td>Sâu 30–40 mm · rộng 3–8 mm</td>
                    <td className="eq">6.1.1</td>
                  </tr>
                  <tr>
                    <td>Khe dọc giả</td>
                    <td>Sâu {r.doc_gia}</td>
                    <td className="eq">6.1.2</td>
                  </tr>
                  <tr>
                    <td>Khe co giả – có thanh truyền lực</td>
                    <td>Sâu {r.co_thanh}</td>
                    <td className="eq">6.2.4</td>
                  </tr>
                  <tr>
                    <td>Khe co giả – không thanh</td>
                    <td>Sâu {r.co_khong}</td>
                    <td className="eq">6.2.4</td>
                  </tr>
                  <tr>
                    <td>Số lần cắt khe co</td>
                    <td>{r.catlan} · rộng 3–8 mm</td>
                    <td className="eq">6.2.4</td>
                  </tr>

                  <tr className="sub">
                    <td colSpan={3}>Khe dãn</td>
                  </tr>
                  <tr>
                    <td>Bề rộng khe dãn</td>
                    <td>20–25 mm · có bản đệm + thanh truyền lực di động</td>
                    <td className="eq">6.2.5</td>
                  </tr>
                  <tr>
                    <td>Khoảng cách các khe dãn</td>
                    <td>{r.dan_kc}</td>
                    <td className="eq">6.2.5</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
