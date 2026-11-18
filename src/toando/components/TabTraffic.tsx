import React, { useState } from 'react';
import { UI_ICONS } from '../assets/iconRegistry';
import { STANDARD_AXLE_PARAMS } from '../data/tables22tcn211';
import { createDefaultVehicles } from '../engine/traffic';
import type {
  AppliedAxleLoadType,
  CalculationYearMode,
  ForecastConfig,
  StandardAxleType,
  TrafficSummary,
  VehicleRow,
  WheelGroupType,
} from '../types/project';

export interface TabTrafficProps {
  vehicles: VehicleRow[];
  forecast: ForecastConfig;
  traffic: TrafficSummary;
  onVehiclesChange: (next: VehicleRow[]) => void;
  onForecastChange: (next: ForecastConfig) => void;
}

export function TabTraffic({
  vehicles,
  forecast,
  traffic,
  onVehiclesChange,
  onForecastChange,
}: TabTrafficProps): React.ReactElement {
  const [subTab, setSubTab] = useState<'thanh-phan' | 'quy-doi'>('thanh-phan');

  const updateVehicle = (index: number, patch: Partial<VehicleRow>) => {
    const next = vehicles.map((v, idx) => (idx === index ? { ...v, ...patch } : v));
    onVehiclesChange(next);
  };

  const handleAxleTypeChange = (tlTrucQuyDoi_kN: StandardAxleType) => {
    const p = STANDARD_AXLE_PARAMS[tlTrucQuyDoi_kN];
    onForecastChange({
      ...forecast,
      tlTrucQuyDoi_kN,
      duongKinhVetBanh_D_cm: p.D_cm,
      apLucBanh_p_MPa: p.p_MPa,
    });
  };

  const axleInfo = STANDARD_AXLE_PARAMS[forecast.tlTrucQuyDoi_kN];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }} data-testid="tab-luu-luong">
      {/* Sub-tabs */}
      <div className="adm-subtabs">
        <button
          type="button"
          className={`adm-subtab ${subTab === 'thanh-phan' ? 'active' : ''}`}
          onClick={() => setSubTab('thanh-phan')}
        >
          Thành phần xe
        </button>
        <button
          type="button"
          className={`adm-subtab ${subTab === 'quy-doi' ? 'active' : ''}`}
          onClick={() => setSubTab('quy-doi')}
        >
          Bảng quy đổi về trục tính toán
        </button>
      </div>

      {/* Top Grid Area */}
      <div className="adm-grid-wrap" style={{ flex: 1, minHeight: 190, margin: '10px 12px' }}>
        {subTab === 'thanh-phan' ? (
          <table className="adm-table" data-testid="table-thanh-phan-xe">
            <thead>
              <tr>
                <th rowSpan={2} style={{ width: 175 }}>Loại xe</th>
                <th colSpan={2}>Trọng lượng trục (kN)</th>
                <th rowSpan={2} style={{ width: 72 }}>Số trục sau</th>
                <th rowSpan={2} style={{ width: 135 }}>Số bánh của mỗi cụm bánh ở trục sau</th>
                <th rowSpan={2} style={{ width: 112 }}>Khoảng cách giữa các trục sau (m)</th>
                <th rowSpan={2} style={{ width: 120 }}>Lưu lượng xe 2 chiều ni (xe/ngày đêm)</th>
              </tr>
              <tr>
                <th style={{ width: 82 }}>Trục trước</th>
                <th style={{ width: 82 }}>Trục sau</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v, idx) => {
                const isCar = idx === 0 && v.soTrucSau === 0;
                return (
                  <tr key={v.id}>
                    <td>
                      <input
                        type="text"
                        value={v.tenXe}
                        onChange={(e) => updateVehicle(idx, { tenXe: e.target.value })}
                      />
                    </td>
                    <td>
                      {isCar ? (
                        <div className="center adm-muted-dash">—</div>
                      ) : (
                        <input
                          type="number"
                          step="0.1"
                          className="num"
                          value={v.tlTrucTruoc_kN}
                          onChange={(e) =>
                            updateVehicle(idx, { tlTrucTruoc_kN: parseFloat(e.target.value) || 0 })
                          }
                        />
                      )}
                    </td>
                    <td>
                      {isCar ? (
                        <div className="center adm-muted-dash">—</div>
                      ) : (
                        <input
                          type="number"
                          step="0.1"
                          className="num"
                          value={v.tlTrucSau_kN}
                          onChange={(e) =>
                            updateVehicle(idx, { tlTrucSau_kN: parseFloat(e.target.value) || 0 })
                          }
                        />
                      )}
                    </td>
                    <td>
                      {isCar ? (
                        <div className="center adm-muted-dash">—</div>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          step={1}
                          className="num"
                          value={v.soTrucSau}
                          onChange={(e) =>
                            updateVehicle(idx, { soTrucSau: parseInt(e.target.value, 10) || 0 })
                          }
                        />
                      )}
                    </td>
                    <td>
                      {isCar ? (
                        <div className="center adm-muted-dash">—</div>
                      ) : (
                        <select
                          value={v.cumBanhTrucSau}
                          onChange={(e) =>
                            updateVehicle(idx, { cumBanhTrucSau: e.target.value as WheelGroupType })
                          }
                        >
                          <option value="DON">Cụm bánh đơn</option>
                          <option value="DOI">Cụm bánh đôi</option>
                          <option value="BON">Cụm bánh bốn</option>
                        </select>
                      )}
                    </td>
                    <td>
                      {isCar || v.soTrucSau <= 1 ? (
                        <div className="center adm-muted-dash">—</div>
                      ) : (
                        <input
                          type="number"
                          step="0.1"
                          className="num"
                          value={v.khoangCachTrucSau_m}
                          onChange={(e) =>
                            updateVehicle(idx, {
                              khoangCachTrucSau_m: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                      )}
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className="num"
                        value={v.luuLuong_xeNgDem}
                        onChange={(e) =>
                          updateVehicle(idx, {
                            luuLuong_xeNgDem: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <table className="adm-table" data-testid="table-quy-doi-xe">
            <thead>
              <tr>
                <th style={{ width: 175 }}>Loại xe</th>
                <th style={{ width: 115 }}>Trọng lượng trục Pi (kN)</th>
                <th style={{ width: 70 }}>C1</th>
                <th style={{ width: 70 }}>C2</th>
                <th style={{ width: 115 }}>Lưu lượng xe 2 chiều ni (xe/ngày đêm)</th>
                <th style={{ width: 120 }}>Trục xe quy đổi Ni (trục/ngày đêm)</th>
                <th style={{ width: 130 }}>Tổng Ntk (trục/ngày đêm)</th>
              </tr>
            </thead>
            <tbody>
              {traffic.conversions.map((row) => (
                <React.Fragment key={row.vehicleIndex}>
                  <tr>
                    <td rowSpan={2}>{row.tenXe}</td>
                    <td className="num">Trước: {row.tlTrucTruoc_kN.toFixed(1)}</td>
                    <td className="num">{row.C1_truoc.toFixed(2)}</td>
                    <td className="num">{row.C2_truoc.toFixed(2)}</td>
                    <td className="num" rowSpan={2}>
                      {row.luuLuong_xeNgDem.toFixed(0)}
                    </td>
                    <td className="num">{row.Ni_truoc.toFixed(3)}</td>
                    <td className="num" rowSpan={2} style={{ fontWeight: 600 }}>
                      {row.Ni_tong.toFixed(3)}
                    </td>
                  </tr>
                  <tr>
                    <td className="num">Sau: {row.tlTrucSau_kN.toFixed(1)}</td>
                    <td className="num">{row.C1_sau.toFixed(2)}</td>
                    <td className="num">{row.C2_sau.toFixed(2)}</td>
                    <td className="num">{row.Ni_sau.toFixed(3)}</td>
                  </tr>
                </React.Fragment>
              ))}
              <tr className="group-row">
                <td colSpan={6} style={{ textAlign: 'right', paddingRight: 10 }}>
                  Tổng số trục xe sau khi quy đổi Ntk (trục/ngày đêm):
                </td>
                <td className="num" data-testid="ntk-total">
                  {traffic.Ntk_trucNgDem.toFixed(3)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* Bottom Panels */}
      <div
        className="adm-grid-2col"
        style={{ padding: '4px 12px 12px 12px', gap: 14, flexShrink: 0 }}
      >
        {/* Bottom-Left */}
        <fieldset className="adm-groupbox">
          <legend>Dự báo lưu lượng</legend>
          <label className="adm-check-row">
            <input
              type="checkbox"
              checked={forecast.khongCoSoLieuDieuTra}
              onChange={(e) =>
                onForecastChange({ ...forecast, khongCoSoLieuDieuTra: e.target.checked })
              }
            />
            <span>Không có số liệu điều tra xe</span>
          </label>

          {forecast.khongCoSoLieuDieuTra && (
            <div className="adm-form-row" style={{ gridTemplateColumns: '175px 1fr auto' }}>
              <label htmlFor="ed_LLNamTT">Lưu lượng năm tính toán:</label>
              <input
                id="ed_LLNamTT"
                type="number"
                step="any"
                className="adm-input adm-input-num"
                value={forecast.llNamTTDirect_trucNgDem}
                onChange={(e) =>
                  onForecastChange({
                    ...forecast,
                    llNamTTDirect_trucNgDem: parseFloat(e.target.value) || 0,
                  })
                }
              />
              <span className="adm-unit">(trục/ngày đêm)</span>
            </div>
          )}

          <div className="adm-form-row" style={{ gridTemplateColumns: '175px 1fr auto' }}>
            <label htmlFor="sp_ThoiHanTK">Thời hạn thiết kế:</label>
            <input
              id="sp_ThoiHanTK"
              type="number"
              min={1}
              max={50}
              className="adm-input adm-input-num"
              value={forecast.thoiHanTK_nam}
              onChange={(e) =>
                onForecastChange({
                  ...forecast,
                  thoiHanTK_nam: Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)),
                })
              }
            />
            <span className="adm-unit">(Năm)</span>
          </div>

          <div className="adm-form-row" style={{ gridTemplateColumns: '175px 1fr auto' }}>
            <label htmlFor="cb_NamTinhToan">Lưu lượng tính toán tại năm:</label>
            <select
              id="cb_NamTinhToan"
              className="adm-select"
              value={forecast.namTinhToan}
              onChange={(e) =>
                onForecastChange({
                  ...forecast,
                  namTinhToan: e.target.value as CalculationYearMode,
                })
              }
            >
              <option value="NAM_DAU">Năm đầu</option>
              <option value="NAM_CUOI">Năm cuối</option>
            </select>
            <span />
          </div>

          <div className="adm-form-row" style={{ gridTemplateColumns: '175px 1fr auto', marginBottom: 0 }}>
            <label htmlFor="sp_QuyLuatTangTruong">Quy luật tăng trưởng:</label>
            <input
              id="sp_QuyLuatTangTruong"
              type="number"
              min={0}
              max={100}
              step="0.1"
              className="adm-input adm-input-num"
              value={Number((forecast.quyLuatTangTruong_q * 100).toFixed(2))}
              onChange={(e) => {
                const pct = parseFloat(e.target.value);
                onForecastChange({
                  ...forecast,
                  quyLuatTangTruong_q: Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) / 100 : 0,
                });
              }}
            />
            <span className="adm-unit">(%)</span>
          </div>
        </fieldset>

        {/* Bottom-Right */}
        <fieldset className="adm-groupbox">
          <legend>Trục xe tính toán</legend>
          <div className="adm-form-row" style={{ gridTemplateColumns: '165px 90px 1fr' }}>
            <label htmlFor="cb_TLTrucQD">Trọng lượng trục quy đổi:</label>
            <select
              id="cb_TLTrucQD"
              className="adm-select"
              value={forecast.tlTrucQuyDoi_kN}
              onChange={(e) =>
                handleAxleTypeChange(Number(e.target.value) as StandardAxleType)
              }
            >
              <option value={100}>100</option>
              <option value={120}>120</option>
            </select>
            <span className="adm-unit">
              (kN) — (p = {axleInfo.p_MPa} MPa, D = {axleInfo.D_cm} cm)
            </span>
          </div>

          <div className="adm-form-row" style={{ gridTemplateColumns: '165px 1fr auto' }}>
            <label htmlFor="cb_TaiTrongTrucTD">Tải trọng trục tác dụng:</label>
            <select
              id="cb_TaiTrongTrucTD"
              className="adm-select"
              value={forecast.taiTrongTrucTacDung}
              onChange={(e) =>
                onForecastChange({
                  ...forecast,
                  taiTrongTrucTacDung: e.target.value as AppliedAxleLoadType,
                })
              }
            >
              <option value="BANH_DOI">Cụm bánh đôi (tải trọng trục tiêu chuẩn)</option>
              <option value="BANH_DON">Cụm bánh đơn (tải trọng trục đặc biệt)</option>
            </select>
            <span />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>
              N<sub>tk</sub> = <strong>{traffic.Ntk_trucNgDem.toFixed(3)}</strong> (trục/ng.đêm)
            </span>
            <button
              type="button"
              className="adm-btn"
              onClick={() => onVehiclesChange(createDefaultVehicles())}
            >
              <img src={UI_ICONS.resetXeSmall} alt="" />
              <span>Reset</span>
            </button>
          </div>
        </fieldset>
      </div>
    </div>
  );
}
