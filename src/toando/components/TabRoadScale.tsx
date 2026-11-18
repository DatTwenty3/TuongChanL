import React from 'react';
import {
  getMinReliabilityForRoadClass,
  HIGHWAY_CLASSES,
  LANE_COUNT_OPTIONS,
  RELIABILITY_OPTIONS,
  URBAN_CLASSES,
} from '../data/tables22tcn211';
import { computeKcd } from '../engine/modulus';
import { computeLaneFactor } from '../engine/traffic';
import type { DesignObjectType, RoadScale, RoadType } from '../types/project';

export interface TabRoadScaleProps {
  roadScale: RoadScale;
  doiTuongTK: DesignObjectType;
  onChange: (next: RoadScale) => void;
}

export function TabRoadScale({
  roadScale,
  doiTuongTK,
  onChange,
}: TabRoadScaleProps): React.ReactElement {
  const classOptions = roadScale.loaiDuong === 'DUONG_O_TO' ? HIGHWAY_CLASSES : URBAN_CLASSES;
  const minReliability = getMinReliabilityForRoadClass(roadScale.loaiDuong, roadScale.capDuong);
  const belowMinReliability = roadScale.doTinCayTK < minReliability;

  const handleRoadType = (loaiDuong: RoadType) => {
    const nextClasses = loaiDuong === 'DUONG_O_TO' ? HIGHWAY_CLASSES : URBAN_CLASSES;
    onChange({
      ...roadScale,
      loaiDuong,
      capDuong: nextClasses[0],
    });
  };

  const handleLaneChange = (soLanXe: number, gpcGiua: boolean, gpcBen: boolean) => {
    const heSoLan_fL = computeLaneFactor(soLanXe, gpcGiua, doiTuongTK);
    onChange({
      ...roadScale,
      soLanXe,
      gpcGiua,
      gpcBen,
      heSoLan_fL,
    });
  };

  const handleReliability = (doTinCayTK: number) => {
    const kcd = computeKcd(doTinCayTK);
    onChange({
      ...roadScale,
      doTinCayTK,
      Kcd_vong: kcd.Kcd_vong,
      Kcd_truot: kcd.Kcd_truot,
      Kcd_keoUon: kcd.Kcd_keoUon,
    });
  };

  return (
    <div className="adm-tab-pad" data-testid="tab-quy-mo">
      <div className="adm-grid-2col">
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <fieldset className="adm-groupbox">
            <legend>Loại đường</legend>
            <div style={{ display: 'flex', gap: 24 }}>
              <label className="adm-radio-row">
                <input
                  type="radio"
                  name="loaiDuong"
                  checked={roadScale.loaiDuong === 'DUONG_O_TO'}
                  onChange={() => handleRoadType('DUONG_O_TO')}
                />
                <span>Đường ô tô</span>
              </label>
              <label className="adm-radio-row">
                <input
                  type="radio"
                  name="loaiDuong"
                  checked={roadScale.loaiDuong === 'DUONG_DO_THI'}
                  onChange={() => handleRoadType('DUONG_DO_THI')}
                />
                <span>Đường đô thị</span>
              </label>
            </div>
          </fieldset>

          <fieldset className="adm-groupbox">
            <legend>Cấp đường</legend>
            <select
              id="cb_CapDuong"
              aria-label="Cấp đường"
              className="adm-select"
              value={roadScale.capDuong}
              onChange={(e) => onChange({ ...roadScale, capDuong: e.target.value })}
            >
              {classOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </fieldset>

          <fieldset className="adm-groupbox">
            <legend>Làn xe</legend>
            <div className="adm-form-row" style={{ gridTemplateColumns: '115px 1fr auto' }}>
              <label htmlFor="cb_SoLanXe">Số làn xe:</label>
              <select
                id="cb_SoLanXe"
                className="adm-select"
                value={roadScale.soLanXe}
                onChange={(e) =>
                  handleLaneChange(Number(e.target.value), roadScale.gpcGiua, roadScale.gpcBen)
                }
              >
                {LANE_COUNT_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span />
            </div>

            <div className="adm-form-row" style={{ gridTemplateColumns: '115px 1fr auto' }}>
              <label>Giải phân cách:</label>
              <div style={{ display: 'flex', gap: 18 }}>
                <label className="adm-check-row" style={{ marginBottom: 0 }}>
                  <input
                    type="checkbox"
                    checked={roadScale.gpcGiua}
                    onChange={(e) =>
                      handleLaneChange(roadScale.soLanXe, e.target.checked, roadScale.gpcBen)
                    }
                  />
                  <span>Giữa</span>
                </label>
                <label className="adm-check-row" style={{ marginBottom: 0 }}>
                  <input
                    type="checkbox"
                    checked={roadScale.gpcBen}
                    onChange={(e) =>
                      handleLaneChange(roadScale.soLanXe, roadScale.gpcGiua, e.target.checked)
                    }
                  />
                  <span>Bên</span>
                </label>
              </div>
              <span />
            </div>

            <div className="adm-form-row" style={{ gridTemplateColumns: '115px 1fr auto', marginBottom: 0 }}>
              <label htmlFor="ed_HSLan">Hệ số làn:</label>
              <input
                id="ed_HSLan"
                type="number"
                step="0.01"
                className="adm-input adm-input-num"
                value={roadScale.heSoLan_fL}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onChange({ ...roadScale, heSoLan_fL: Number.isFinite(val) ? val : 0 });
                }}
              />
              <span />
            </div>

            {doiTuongTK === 'LGC' && (
              <div className="adm-alert-info" data-testid="note-lgc-dieu711">
                <strong>Điều 7.11 (TCCS 38:2022)</strong>: Lề gia cố không có dải phân cách bên lấy{' '}
                <strong>50%</strong> (&le; 2 làn), <strong>42,5%</strong> (3 làn),{' '}
                <strong>35%</strong> (&ge; 4 làn) số trục xe tính toán của làn cơ giới liền kề.
              </div>
            )}

            {doiTuongTK === 'LGC' && roadScale.gpcBen && (
              <div className="adm-alert-warn" data-testid="warn-lgc-dieu512">
                <strong>Lưu ý Điều 5.12.2</strong>: Khi có dải phân cách bên cố định tách riêng làn xe thô sơ, không áp dụng tỷ lệ 35%–50% làn cơ giới mà thiết kế theo giao thông xe thô sơ (tầng mặt tối thiểu cấp cao A2).
              </div>
            )}
          </fieldset>
        </div>

        {/* Right Column */}
        <fieldset className="adm-groupbox">
          <legend>Thông số thiết kế</legend>
          <div className="adm-form-row" style={{ gridTemplateColumns: '190px 1fr auto' }}>
            <label htmlFor="sp_VanTocTK">Vận tốc thiết kế:</label>
            <input
              id="sp_VanTocTK"
              type="number"
              min={20}
              max={120}
              step={5}
              className="adm-input adm-input-num"
              value={roadScale.vanTocTK_kmh}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                onChange({
                  ...roadScale,
                  vanTocTK_kmh: Number.isFinite(v) ? Math.max(20, Math.min(120, v)) : 40,
                });
              }}
            />
            <span className="adm-unit">(km/h)</span>
          </div>

          <div className="adm-form-row" style={{ gridTemplateColumns: '190px 1fr auto' }}>
            <label htmlFor="cb_DoTinCayTK">Độ tin cậy thiết kế:</label>
            <select
              id="cb_DoTinCayTK"
              className="adm-select"
              value={roadScale.doTinCayTK.toFixed(2)}
              onChange={(e) => handleReliability(parseFloat(e.target.value))}
            >
              {RELIABILITY_OPTIONS.map((r) => (
                <option key={r} value={r.toFixed(2)}>
                  {r.toFixed(2)}
                </option>
              ))}
            </select>
            <span />
          </div>

          <div className="adm-form-row" style={{ gridTemplateColumns: '190px 1fr auto' }}>
            <label htmlFor="ed_HSCd_Vong">Hệ số cường độ về độ võng:</label>
            <input
              id="ed_HSCd_Vong"
              type="text"
              readOnly
              className="adm-input adm-input-center"
              value={roadScale.Kcd_vong.toFixed(2)}
            />
            <span />
          </div>

          <div className="adm-form-row" style={{ gridTemplateColumns: '190px 1fr auto' }}>
            <label htmlFor="ed_HSCd_Truot">Hệ số cường độ về cắt trượt:</label>
            <input
              id="ed_HSCd_Truot"
              type="text"
              readOnly
              className="adm-input adm-input-center"
              value={roadScale.Kcd_truot.toFixed(2)}
            />
            <span />
          </div>

          <div className="adm-form-row" style={{ gridTemplateColumns: '190px 1fr auto', marginBottom: 0 }}>
            <label htmlFor="ed_HSCd_KeoUon">Hệ số cường độ về kéo uốn:</label>
            <input
              id="ed_HSCd_KeoUon"
              type="text"
              readOnly
              className="adm-input adm-input-center"
              value={roadScale.Kcd_keoUon.toFixed(2)}
            />
            <span />
          </div>

          {belowMinReliability && (
            <div className="adm-alert-warn" role="alert" data-testid="warn-bang7-reliability">
              <strong>Cảnh báo Bảng 7 (§8.2)</strong>: Độ tin cậy thiết kế{' '}
              <code>{roadScale.doTinCayTK.toFixed(2)}</code> nhỏ hơn ngưỡng tối thiểu{' '}
              <code>{minReliability.toFixed(2)}</code> đối với &ldquo;{roadScale.capDuong}&rdquo;.
            </div>
          )}
        </fieldset>
      </div>
    </div>
  );
}
