import React from 'react';
import type { DesignObjectType, ProjectInfo, RehabStrategy } from '../types/project';

export interface TabProjectInfoProps {
  info: ProjectInfo;
  rehabStrategy?: RehabStrategy;
  onChange: (patch: Partial<ProjectInfo>) => void;
  onGoToExistingPavement?: () => void;
}

export function TabProjectInfo({
  info,
  rehabStrategy,
  onChange,
  onGoToExistingPavement,
}: TabProjectInfoProps): React.ReactElement {
  return (
    <div className="adm-tab-pad" data-testid="tab-thong-tin">
      <div style={{ maxWidth: 680 }}>
        <div className="adm-form-row">
          <label htmlFor="ed_CongTrinh">Công trình:</label>
          <input
            id="ed_CongTrinh"
            type="text"
            className="adm-input"
            value={info.congTrinh}
            placeholder="Nhập tên công trình..."
            onChange={(e) => onChange({ congTrinh: e.target.value })}
          />
          <span />
        </div>

        <div className="adm-form-row">
          <label htmlFor="ed_DiaDiem">Địa điểm:</label>
          <input
            id="ed_DiaDiem"
            type="text"
            className="adm-input"
            value={info.diaDiem}
            placeholder="Nhập địa điểm xây dựng..."
            onChange={(e) => onChange({ diaDiem: e.target.value })}
          />
          <span />
        </div>

        <div className="adm-form-row">
          <label htmlFor="ed_KSTK">Kỹ sư thiết kế:</label>
          <input
            id="ed_KSTK"
            type="text"
            className="adm-input"
            value={info.kySuThietKe}
            placeholder="Nhập họ tên kỹ sư thiết kế..."
            onChange={(e) => onChange({ kySuThietKe: e.target.value })}
          />
          <span />
        </div>

        <div className="adm-grid-2col" style={{ marginTop: 18 }}>
          <fieldset className="adm-groupbox">
            <legend>Đối tượng thiết kế</legend>
            {(
              [
                ['KCAD', 'Kết cấu áo đường'],
                ['LGC', 'Kết cấu lề gia cố'],
              ] as Array<[DesignObjectType, string]>
            ).map(([val, label]) => (
              <label key={val} className="adm-radio-row">
                <input
                  type="radio"
                  name="doiTuongTK"
                  checked={info.doiTuongTK === val}
                  onChange={() => onChange({ doiTuongTK: val })}
                />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>

          <fieldset className="adm-groupbox">
            <legend>Loại thiết kế</legend>
            <label className="adm-radio-row">
              <input
                type="radio"
                name="loaiTK"
                data-testid="radio-loai-tk-moi"
                checked={info.loaiTK === 'TK_MOI'}
                onChange={() => onChange({ loaiTK: 'TK_MOI' })}
              />
              <span>Thiết kế mới</span>
            </label>
            <label className="adm-radio-row">
              <input
                type="radio"
                name="loaiTK"
                data-testid="radio-loai-cai-tao"
                checked={info.loaiTK === 'CAI_TAO'}
                onChange={() => onChange({ loaiTK: 'CAI_TAO' })}
              />
              <span>Cải tạo, nâng cấp</span>
            </label>
          </fieldset>
        </div>

        {info.loaiTK === 'CAI_TAO' && (
          <div className="adm-alert-info" style={{ marginTop: 14 }} data-testid="info-cai-tao">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <strong>Chế độ Thiết kế tăng cường, cải tạo áo đường cũ (Chương 10 — TCCS 38:2022/TCĐBVN)</strong>
                <div style={{ marginTop: 3 }}>
                  {rehabStrategy === 'FULL_REBUILD'
                    ? 'Đang chọn Phương án 1 (Cải tạo toàn bộ từ nền trở lên): phần mềm sẽ tính toán trên nền đất E₀ như kết cấu mới (§10.1.4.3).'
                    : 'Vui lòng khai báo giải pháp cải tạo, đánh giá hiện trạng (Bảng 13) và mô đun đàn hồi chung áo đường cũ E_ch,cũ tại tab Áo đường cũ (Chương 10).'}
                </div>
              </div>
              {onGoToExistingPavement && (
                <button
                  type="button"
                  className="adm-btn adm-btn-primary"
                  data-testid="btn-goto-ao-duong-cu"
                  onClick={onGoToExistingPavement}
                >
                  Mở tab Áo đường cũ (Chương 10) →
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
