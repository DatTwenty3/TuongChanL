import React from 'react';
import {
  COMPACTION_K_OPTIONS,
  SOIL_DIRECT_TYPES,
  SOIL_MOISTURE_TYPES,
} from '../data/tables22tcn211';
import { resolveSubgrade } from '../engine/subgrade';
import type { DesignKindType, SubgradeConfig } from '../types/project';

export interface TabSubgradeProps {
  subgrade: SubgradeConfig;
  loaiTK?: DesignKindType;
  onChange: (next: SubgradeConfig) => void;
}

export function TabSubgrade({
  subgrade,
  loaiTK = 'TK_MOI',
  onChange,
}: TabSubgradeProps): React.ReactElement {
  const soilTypes = subgrade.xacDinhTheoDoAm ? SOIL_MOISTURE_TYPES : SOIL_DIRECT_TYPES;

  const applyMoistureAndUpdate = (patch: Partial<SubgradeConfig>) => {
    const merged: SubgradeConfig = { ...subgrade, ...patch };
    if (merged.xacDinhTheoDoAm) {
      if (!SOIL_MOISTURE_TYPES.includes(merged.loaiDat)) {
        merged.loaiDat = SOIL_MOISTURE_TYPES[0];
      }
      const resolved = resolveSubgrade(merged);
      merged.E0_MPa = resolved.E0_MPa;
      merged.phi_deg = resolved.phi_deg;
      merged.C_MPa = resolved.C_MPa;
    } else if (!SOIL_DIRECT_TYPES.includes(merged.loaiDat)) {
      merged.loaiDat = SOIL_DIRECT_TYPES[0];
    }
    onChange(merged);
  };

  return (
    <div className="adm-tab-pad" data-testid="tab-dat-nen">
      {loaiTK === 'CAI_TAO' && (
        <div
          className="adm-alert-info"
          style={{ maxWidth: 560, marginTop: 0, marginBottom: 12 }}
          data-testid="banner-subgrade-ch10"
        >
          <strong>Chế độ Cải tạo, nâng cấp (Chương 10)</strong>: Thông số đất nền cũ (§9.2.5.5, §10.3.3) — dùng cho kiểm toán cắt trượt và Phương pháp C
        </div>
      )}

      <fieldset className="adm-groupbox" style={{ maxWidth: 560 }}>
        <legend>
          {loaiTK === 'CAI_TAO' ? 'Thông số đất nền cũ (§9.2.5.5, §10.3.3)' : 'Thông số đất nền'}
        </legend>

        <label className="adm-check-row" style={{ marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={subgrade.xacDinhTheoDoAm}
            onChange={(e) => applyMoistureAndUpdate({ xacDinhTheoDoAm: e.target.checked })}
          />
          <span>Xác định theo độ ẩm tương đối</span>
        </label>

        <div className="adm-form-row" style={{ gridTemplateColumns: '175px 1fr auto' }}>
          <label htmlFor="cb_LoaiDat">Loại đất:</label>
          <select
            id="cb_LoaiDat"
            className="adm-select"
            value={soilTypes.includes(subgrade.loaiDat) ? subgrade.loaiDat : soilTypes[0]}
            onChange={(e) => applyMoistureAndUpdate({ loaiDat: e.target.value })}
          >
            {soilTypes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <span />
        </div>

        <div className="adm-form-row" style={{ gridTemplateColumns: '175px 1fr auto' }}>
          <label
            htmlFor="sp_DoAmTuongDoi"
            className={subgrade.xacDinhTheoDoAm ? undefined : 'adm-disabled-label'}
          >
            Độ ẩm tương đối a =
          </label>
          <input
            id="sp_DoAmTuongDoi"
            type="number"
            min={0.55}
            max={0.9}
            step={0.01}
            disabled={!subgrade.xacDinhTheoDoAm}
            className="adm-input adm-input-num"
            value={subgrade.doAmTuongDoi_a}
            onChange={(e) =>
              applyMoistureAndUpdate({
                doAmTuongDoi_a: Math.max(0.55, Math.min(0.9, parseFloat(e.target.value) || 0.55)),
              })
            }
          />
          <span className="adm-unit">(0.55 – 0.90)</span>
        </div>

        <div className="adm-form-row" style={{ gridTemplateColumns: '175px 1fr auto' }}>
          <span />
          <label
            className={`adm-check-row ${subgrade.xacDinhTheoDoAm ? '' : 'adm-disabled-label'}`}
            style={{ marginBottom: 0 }}
          >
            <input
              type="checkbox"
              disabled={!subgrade.xacDinhTheoDoAm}
              checked={subgrade.lanSoiSan}
              onChange={(e) => applyMoistureAndUpdate({ lanSoiSan: e.target.checked })}
            />
            <span>Đất lẫn sỏi sạn</span>
          </label>
          <span />
        </div>

        <div className="adm-form-row" style={{ gridTemplateColumns: '175px 1fr auto' }}>
          <label htmlFor="cb_DoChatK">Độ chặt yêu cầu:</label>
          <select
            id="cb_DoChatK"
            className="adm-select"
            value={subgrade.doChatYeuCau_K.toFixed(2)}
            onChange={(e) =>
              applyMoistureAndUpdate({ doChatYeuCau_K: parseFloat(e.target.value) })
            }
          >
            {COMPACTION_K_OPTIONS.map((k) => (
              <option key={k} value={k.toFixed(2)}>
                {k.toFixed(2)}
              </option>
            ))}
          </select>
          <span />
        </div>

        <div className="adm-form-row" style={{ gridTemplateColumns: '175px 1fr auto' }}>
          <span />
          <label
            htmlFor="chk_DamNenCaiTien"
            className="adm-check-row"
            style={{ marginBottom: 0 }}
          >
            <input
              id="chk_DamNenCaiTien"
              type="checkbox"
              checked={Boolean(subgrade.damNenCaiTien)}
              onChange={(e) => applyMoistureAndUpdate({ damNenCaiTien: e.target.checked })}
            />
            <span>Đầm nén cải tiến (+20% E₀, Bảng B.4)</span>
          </label>
          <span />
        </div>

        <div className="adm-form-row" style={{ gridTemplateColumns: '175px 1fr auto' }}>
          <label htmlFor="sp_Module_E">Module đàn hồi E:</label>
          <input
            id="sp_Module_E"
            type="number"
            step="0.01"
            className="adm-input adm-input-num"
            value={subgrade.E0_MPa}
            onChange={(e) =>
              onChange({ ...subgrade, E0_MPa: parseFloat(e.target.value) || 0 })
            }
          />
          <span className="adm-unit">(MPa)</span>
        </div>

        <div className="adm-form-row" style={{ gridTemplateColumns: '175px 1fr auto' }}>
          <label htmlFor="sp_GocMS_Phi">Góc ma sát φ:</label>
          <input
            id="sp_GocMS_Phi"
            type="number"
            step="0.01"
            className="adm-input adm-input-num"
            value={subgrade.phi_deg}
            onChange={(e) =>
              onChange({ ...subgrade, phi_deg: parseFloat(e.target.value) || 0 })
            }
          />
          <span className="adm-unit">(độ)</span>
        </div>

        <div className="adm-form-row" style={{ gridTemplateColumns: '175px 1fr auto', marginBottom: 0 }}>
          <label htmlFor="sp_LucDinh_C">Lực dính C:</label>
          <input
            id="sp_LucDinh_C"
            type="number"
            step="0.001"
            className="adm-input adm-input-num"
            value={subgrade.C_MPa}
            onChange={(e) =>
              onChange({ ...subgrade, C_MPa: parseFloat(e.target.value) || 0 })
            }
          />
          <span className="adm-unit">(MPa)</span>
        </div>
      </fieldset>
    </div>
  );
}
