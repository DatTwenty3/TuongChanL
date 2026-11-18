import React, { useEffect, useState } from 'react';
import { UI_ICONS } from '../assets/iconRegistry';
import { TABLE_2_SURFACE_REF, TABLE_13_DISTRESS_REF, TABLE_F1_MIN_A1 } from '../data/tables22tcn211';
import type { PavementAlternative } from '../types/project';

/* ---------- 1. Chọn loại tầng mặt theo TCCS 38:2022/TCĐBVN (Bảng 2 & Bảng F.1) ---------- */
export function ThamKhaoTangMatModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): React.ReactElement | null {
  if (!open) return null;
  return (
    <div className="adm-modal-backdrop" onClick={onClose}>
      <div
        className="adm-modal"
        style={{ width: 760 }}
        role="dialog"
        aria-modal="true"
        aria-label="Chọn loại tầng mặt theo TCCS 38:2022"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="adm-modal-header">
          <span>Chọn loại tầng mặt theo TCCS 38:2022/TCĐBVN (Bảng 2 &amp; Bảng F.1)</span>
          <button type="button" className="adm-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="adm-modal-body adm-selectable">
          <h4 className="adm-ref-section-title">
            Bảng 2 — Vật liệu cấu tạo tầng mặt và thời hạn thiết kế (§5.2.4, tr. 10–11)
          </h4>
          <table className="adm-ref-table" data-testid="table-ref-bang2">
            <thead>
              <tr>
                <th style={{ width: 130 }}>Loại tầng mặt</th>
                <th style={{ width: 165 }}>Cấp đường áp dụng</th>
                <th>Vật liệu và cấu tạo tầng mặt</th>
                <th style={{ width: 95 }}>Thời hạn TK (năm)</th>
              </tr>
            </thead>
            <tbody>
              {TABLE_2_SURFACE_REF.map((row) => (
                <tr key={row.gradeLabel}>
                  <td style={{ fontWeight: 700, color: 'var(--accd)' }}>{row.gradeLabel}</td>
                  <td>{row.roadClasses}</td>
                  <td>{row.materialsAndStructure}</td>
                  <td className="center" style={{ fontWeight: 700 }}>
                    &ge; {row.minDesignLifeYears}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="adm-ref-note">
            <strong>Chú thích (§5.2.5):</strong> Không nên bố trí bề dày tầng mặt chỉ bằng một lớp BTN dày dưới 7 cm đối với mặt đường cấp cao A1 (trừ khi đặt trên móng gia cố nhựa &ge; 10 cm). Trên móng gia cố xi măng, bề dày tối thiểu tầng mặt nhựa tối thiểu 14–18 cm để hạn chế nứt phản ánh.
          </p>

          <h4 className="adm-ref-section-title" style={{ marginTop: 14 }}>
            Phụ lục F — Bảng F.1: Bề dày tối thiểu tầng mặt cấp cao A1 (tr. 73)
          </h4>
          <table className="adm-ref-table" data-testid="table-ref-bangf1">
            <thead>
              <tr>
                <th>Số trục xe tiêu chuẩn tích lũy 15 năm / 1 làn (trục xe/làn)</th>
                <th style={{ width: 170 }}>Bề dày tối thiểu thông thường (cm)</th>
                <th style={{ width: 210 }}>Đặt trên móng gia cố nhựa &ge; 10 cm (cm)</th>
              </tr>
            </thead>
            <tbody>
              {TABLE_F1_MIN_A1.map((row) => (
                <tr key={row.Ne_range}>
                  <td className="center">{row.Ne_range}</td>
                  <td className="center" style={{ fontWeight: 700 }}>
                    {row.standard_cm.toString().replace('.', ',')}
                  </td>
                  <td className="center">
                    {row.onAsphaltBase_ge10cm_cm.toString().replace('.', ',')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="adm-modal-footer">
          <button type="button" className="adm-btn adm-btn-primary" onClick={onClose}>
            <img src={UI_ICONS.okRefSmall} alt="" />
            <span>OK</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- 2. Material Row Editor (TfrmThem_SuaMauVL) ---------- */
export interface MaterialRowFormValues {
  name: string;
  E_vong_30C: number;
  E_truot_60C: number;
  E_keoUon_10_15C: number;
  Rku_MPa: number;
  phi_deg: number;
  C_MPa: number;
  note: string;
}

export function MaterialRowModal({
  open,
  title,
  initialValue,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  initialValue: MaterialRowFormValues;
  onConfirm: (val: MaterialRowFormValues) => void;
  onClose: () => void;
}): React.ReactElement | null {
  const [form, setForm] = useState<MaterialRowFormValues>(initialValue);

  useEffect(() => {
    if (open) setForm(initialValue);
  }, [open, initialValue]);

  if (!open) return null;

  const setNum = (field: keyof MaterialRowFormValues, raw: string) => {
    const parsed = parseFloat(raw);
    setForm((prev) => ({
      ...prev,
      [field]: Number.isFinite(parsed) ? parsed : 0,
    }));
  };

  return (
    <div className="adm-modal-backdrop" onClick={onClose}>
      <div
        className="adm-modal"
        style={{ width: 390 }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="adm-modal-header">
          <span>{title}</span>
          <button type="button" className="adm-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="adm-modal-body">
          <div className="adm-form-row" style={{ gridTemplateColumns: '155px 1fr auto' }}>
            <label>Tên vật liệu</label>
            <input
              type="text"
              className="adm-input"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
            <span />
          </div>
          {(
            [
              ['Module đàn hồi Ev (30°C)', 'E_vong_30C', '(MPa)'],
              ['Module đàn hồi Etr (60°C)', 'E_truot_60C', '(MPa)'],
              ['Module đàn hồi Eku (10-15°C)', 'E_keoUon_10_15C', '(MPa)'],
              ['Cường độ chịu kéo uốn Rku', 'Rku_MPa', '(MPa)'],
              ['Góc ma sát φ', 'phi_deg', '(độ)'],
              ['Lực dính C', 'C_MPa', '(MPa)'],
            ] as const
          ).map(([label, key, unit]) => (
            <div key={key} className="adm-form-row" style={{ gridTemplateColumns: '155px 1fr auto' }}>
              <label>{label}</label>
              <input
                type="number"
                step="any"
                className="adm-input adm-input-num"
                value={form[key]}
                onChange={(e) => setNum(key, e.target.value)}
              />
              <span className="adm-unit">{unit}</span>
            </div>
          ))}
          <div style={{ marginTop: 6 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500 }}>Ghi chú:</label>
            <textarea
              className="adm-input"
              style={{ height: 64, padding: 8, resize: 'vertical' }}
              value={form.note}
              onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
            />
          </div>
        </div>
        <div className="adm-modal-footer" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="adm-btn" onClick={() => setForm(initialValue)}>
            Reset
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="adm-btn adm-btn-primary"
              onClick={() => onConfirm(form)}
            >
              <img src={UI_ICONS.okSmall} alt="" />
              <span>OK</span>
            </button>
            <button type="button" className="adm-btn" onClick={onClose}>
              Hủy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- 3. Export Excel Dialog (TfrmXuatExcel) ---------- */
export function ExportExcelModal({
  open,
  alternatives,
  onExport,
  onClose,
}: {
  open: boolean;
  alternatives: PavementAlternative[];
  onExport: (selectedIds: string[]) => Promise<void> | void;
  onClose: () => void;
}): React.ReactElement | null {
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected(alternatives.map((a) => a.id));
    }
  }, [open, alternatives]);

  if (!open) return null;

  const allChecked = alternatives.length > 0 && selected.length === alternatives.length;

  const toggleId = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleOk = async () => {
    if (selected.length === 0) return;
    setBusy(true);
    try {
      await onExport(selected);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="adm-modal-backdrop" onClick={onClose}>
      <div
        className="adm-modal"
        style={{ width: 350 }}
        role="dialog"
        aria-modal="true"
        aria-label="Xuất kết quả sang Excel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="adm-modal-header">
          <span>Xuất kết quả sang Excel</span>
          <button type="button" className="adm-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="adm-modal-body">
          <div style={{ marginBottom: 8, fontWeight: 600 }}>Chọn phương án kết cấu cần xuất:</div>
          <div
            className="adm-modal-box"
            style={{
              minHeight: 130,
              maxHeight: 200,
              overflow: 'auto',
            }}
          >
            {alternatives.map((alt) => (
              <label key={alt.id} className="adm-check-row">
                <input
                  type="checkbox"
                  checked={selected.includes(alt.id)}
                  onChange={() => toggleId(alt.id)}
                />
                <span>{alt.name}</span>
              </label>
            ))}
          </div>
          <label className="adm-check-row" style={{ marginTop: 10 }}>
            <input
              type="checkbox"
              checked={allChecked}
              onChange={(e) =>
                setSelected(e.target.checked ? alternatives.map((a) => a.id) : [])
              }
            />
            <span>Chọn tất cả</span>
          </label>
        </div>
        <div className="adm-modal-footer">
          <button
            type="button"
            className="adm-btn adm-btn-primary"
            disabled={busy || selected.length === 0}
            onClick={handleOk}
          >
            <img src={UI_ICONS.okSmall} alt="" />
            <span>{busy ? 'Đang xuất...' : 'OK'}</span>
          </button>
          <button type="button" className="adm-btn" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- 4. Alternative Name Prompt Modal (+ / SA) ---------- */
export function AlternativeNameModal({
  open,
  title,
  promptLabel,
  initialName,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  promptLabel: string;
  initialName: string;
  onConfirm: (name: string) => void;
  onClose: () => void;
}): React.ReactElement | null {
  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

  if (!open) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return (
    <div className="adm-modal-backdrop" onClick={onClose}>
      <div
        className="adm-modal"
        style={{ width: 360 }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="adm-modal-header">
          <span>{title}</span>
          <button type="button" className="adm-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="adm-modal-body">
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>{promptLabel}</label>
            <input
              type="text"
              className="adm-input"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="adm-modal-footer">
            <button type="submit" className="adm-btn adm-btn-primary">
              OK
            </button>
            <button type="button" className="adm-btn" onClick={onClose}>
              Hủy
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------- 5. Standard Reference Modal (TCCS 38:2022/TCĐBVN) ---------- */
export function StandardInfoModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): React.ReactElement | null {
  if (!open) return null;
  return (
    <div className="adm-modal-backdrop" onClick={onClose}>
      <div
        className="adm-modal"
        style={{ width: 640 }}
        role="dialog"
        aria-modal="true"
        aria-label="Tiêu chuẩn TCCS 38:2022/TCĐBVN"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="adm-modal-header">
          <span>Tiêu chuẩn cơ sở TCCS 38:2022/TCĐBVN</span>
          <button type="button" className="adm-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="adm-modal-body adm-selectable" style={{ lineHeight: 1.6 }}>
          <p style={{ marginTop: 0 }}>
            <strong>TCCS 38:2022/TCĐBVN</strong>: <em>Áo đường mềm — Các yêu cầu và chỉ dẫn thiết kế</em> (Tổng cục Đường bộ Việt Nam ban hành; Viện KH&amp;CN GTVT biên soạn).
          </p>
          <ul style={{ paddingLeft: 18, margin: '6px 0' }}>
            <li>
              <strong>Chương 5 &amp; Bảng 2, Bảng 3, Phụ lục F (Bảng F.1)</strong>: Phân loại tầng mặt <code>A1, A2, B1, B2</code>, thời hạn thiết kế (<code>&ge;15 / &ge;10 / &ge;8 / &ge;6 năm</code>), cấu tạo và chiều dày tối thiểu tầng mặt A1.
            </li>
            <li>
              <strong>Chương 6 &amp; Phụ lục B, C</strong>: Yêu cầu nền đường, bảng tra đất nền theo độ ẩm tương đối (<code>Bảng B.4</code>, đầm nén cải tiến <code>+20% E₀</code>) và thư viện vật liệu (<code>Bảng C.1, C.2</code>).
            </li>
            <li>
              <strong>Chương 7 &amp; Phụ lục A (Bảng 6, Công thức A.2/A.3)</strong>: Trục tiêu chuẩn <code>100 kN / 120 kN</code>, quy đổi trục <code>P &ge; 25 kN</code>, hệ số làn lề gia cố <code>35%–50%</code> (<code>Điều 7.11</code>).
            </li>
            <li>
              <strong>Chương 8 &amp; Bảng 7, Bảng 8</strong>: Ngưỡng độ tin cậy thiết kế tối thiểu theo cấp đường (<code>0,80–0,98</code>) và hệ số cường độ <code>Kcđ^đv, Kcđ^tr, Kcđ^ku</code>.
            </li>
            <li>
              <strong>Chương 9 &amp; Bảng 9–12, Hình 2–8, Phụ lục E</strong>:
              <ul style={{ paddingLeft: 16, marginTop: 3 }}>
                <li><em>Độ võng đàn hồi (§9.2)</em>: Đổi 2 lớp từ dưới lên, hiệu chỉnh <code>β</code> (<code>Bảng 11</code>, kẹp trần <code>max(Ei)</code>), tra <code>Hình 2</code> (Toán đồ 3-1) hoặc <code>Công thức (E.1)</code> khi <code>H/D &gt; 2,0</code>, kiểm tra <code>Ech &ge; Kcđ^đv · max(Eyc, Emin)</code> (<code>Bảng 9, 10</code>).</li>
                <li><em>Cắt trượt (§9.3)</em>: Cho tầng mặt <code>A1, A2</code> (miễn <code>B1, B2</code>). Tra <code>Hình 4 / Hình 5</code> (Toán đồ 3-2/3-3, <code>τax/p</code>) và <code>Hình 6</code> (Toán đồ 3-4, <code>τav</code>), hệ số <code>K2</code> bậc thang (<code>Bảng 12</code>), kiểm tra <code>τax + τav &le; Ctt / Kcđ^tr</code>.</li>
                <li><em>Kéo uốn (§9.4)</em>: Cho lớp liền khối (miễn <code>B1, B2</code>). Tra <code>Hình 7</code> (Toán đồ 3-5) / <code>Hình 8</code> (Toán đồ 3-6) hoặc <code>(E.2)–(E.4)</code>, kiểm tra <code>σku &le; Rtt^ku / Kcđ^ku</code>.</li>
              </ul>
            </li>
            <li>
              <strong>Chương 10 &amp; Bảng 13</strong>: Thiết kế tăng cường, cải tạo áo đường cũ (<code>TCVN 8867</code> cần Benkelman / FWD / tính đổi các lớp cũ giữ lại trên nền <code>E₀</code>, lớp bù vênh không tính cường độ <code>§10.2.1.2</code>, kiểm toán với <code>E₀&apos; = Ech,cũ</code> theo <code>§10.4.2</code>).
            </li>
            <li>
              <strong>Phụ lục D</strong>: Các ví dụ tính toán kiểm chứng (<code>Ví dụ I</code> đường cấp II A1, <code>Ví dụ II</code> đường cấp IV A2).
            </li>
          </ul>
        </div>
        <div className="adm-modal-footer">
          <button type="button" className="adm-btn adm-btn-primary" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- 7. Table 13 Distress Reference Modal (TCCS 38:2022 §10.3.1) ---------- */
export function Bang13DistressModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): React.ReactElement | null {
  if (!open) return null;
  return (
    <div className="adm-modal-backdrop" onClick={onClose}>
      <div
        className="adm-modal"
        style={{ width: 860 }}
        role="dialog"
        aria-modal="true"
        aria-label="Tham khảo Bảng 13 — Các dạng hư hỏng bề mặt áo đường cũ"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="adm-modal-header">
          <span>Bảng 13 — Các dạng hư hỏng trên bề mặt kết cấu áo đường cũ (TCCS 38:2022, tr. 39–40)</span>
          <button type="button" className="adm-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="adm-modal-body adm-selectable">
          <table className="adm-ref-table" data-testid="table-ref-bang13">
            <thead>
              <tr>
                <th style={{ width: 110 }}>Nhóm hư hỏng</th>
                <th style={{ width: 175 }}>Tầng mặt nhựa (Cấp A1, A2)</th>
                <th style={{ width: 155 }}>Tầng mặt cấp thấp B1</th>
                <th>Tiêu chí đánh giá mức độ nghiêm trọng</th>
              </tr>
            </thead>
            <tbody>
              {TABLE_13_DISTRESS_REF.map((row, idx) => (
                <tr key={`${row.category}-${idx}`}>
                  <td style={{ fontWeight: 700, color: 'var(--accd)' }}>{row.category}</td>
                  <td>{row.distressAsphalt}</td>
                  <td>{row.distressLowGrade}</td>
                  <td>
                    {row.criteria.note && (
                      <div style={{ marginBottom: row.criteria.nhe ? 4 : 0 }}>
                        <em>{row.criteria.note}</em>
                      </div>
                    )}
                    {row.criteria.nhe && (
                      <div>
                        <strong>Nhẹ:</strong> {row.criteria.nhe}
                      </div>
                    )}
                    {row.criteria.vua && (
                      <div>
                        <strong>Vừa:</strong> {row.criteria.vua}
                      </div>
                    )}
                    {row.criteria.nang && (
                      <div>
                        <strong>Nặng:</strong> {row.criteria.nang}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="adm-ref-note">
            <strong>Ghi chú (§10.3.1.2 – §10.3.1.4):</strong> Chiều dài mỗi phân đoạn điều tra đồng nhất tối đa <strong>1000 m</strong>. Có thể kết hợp đánh giá chỉ số tình trạng mặt đường <strong>PCI</strong> theo <code>TCCS 07:2013/TCĐBVN</code>.
          </p>
        </div>
        <div className="adm-modal-footer">
          <button type="button" className="adm-btn adm-btn-primary" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
