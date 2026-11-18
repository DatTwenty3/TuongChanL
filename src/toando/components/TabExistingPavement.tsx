import React, { useEffect, useMemo, useRef, useState } from 'react';
import { UI_ICONS } from '../assets/iconRegistry';
import {
  assessBang13Severity,
  computeBenkelmanEchCu,
  computeExistingLayersEchCu,
  getZAlphaForReliability,
  resolveRehabilitationEchCu,
  resolveSubgrade,
  validateRehabilitationInputs,
} from '../engine';
import type {
  DistressSeverity,
  EchCuMethod,
  ExistingPavementLayer,
  MaterialRecord,
  PavementTier,
  ProjectState,
  RehabStrategy,
  RehabilitationConfig,
  SurfaceGrade,
} from '../types/project';
import { Bang13DistressModal } from './Dialogs';

export interface TabExistingPavementProps {
  project: ProjectState;
  rehabilitation: RehabilitationConfig;
  materials: MaterialRecord[];
  onChange: (updater: (prev: RehabilitationConfig) => RehabilitationConfig) => void;
  onStatus?: (msg: string) => void;
}

function severityBadgeClass(level: DistressSeverity): string {
  switch (level) {
    case 'NHE':
      return 'adm-badge adm-badge-nhe';
    case 'VUA':
      return 'adm-badge adm-badge-vua';
    case 'NANG':
      return 'adm-badge adm-badge-nang';
    default:
      return 'adm-badge adm-badge-none';
  }
}

function parsePointsList(raw: string): number[] {
  return raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => parseFloat(s.replace(',', '.')))
    .filter((n) => Number.isFinite(n) && n >= 0);
}

function renumberExistingLayers(layers: ExistingPavementLayer[]): ExistingPavementLayer[] {
  const surface = layers
    .filter((l) => l.isTangMat)
    .map((l, idx) => ({
      ...l,
      tang: 'TANG_MAT' as PavementTier,
      isTangMat: true,
      sttTrongTang: idx + 1,
    }));
  const base = layers
    .filter((l) => !l.isTangMat)
    .map((l, idx) => ({
      ...l,
      tang: 'TANG_MONG' as PavementTier,
      isTangMat: false,
      sttTrongTang: idx + 1,
    }));
  return [...surface, ...base];
}

export function TabExistingPavement({
  project,
  rehabilitation,
  materials,
  onChange,
  onStatus,
}: TabExistingPavementProps): React.ReactElement {
  const [bang13Open, setBang13Open] = useState(false);
  const [selectedRowIdx, setSelectedRowIdx] = useState(0);
  const [pickerState, setPickerState] = useState<{
    rowIndex: number;
    left: number;
    top: number;
  } | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const readingsKey = rehabilitation.benkelman.readings_mm.join(',');
  const [pointsText, setPointsText] = useState(() =>
    rehabilitation.benkelman.readings_mm.join(', '),
  );
  const lastSyncedKeyRef = useRef(readingsKey);

  useEffect(() => {
    if (lastSyncedKeyRef.current !== readingsKey) {
      lastSyncedKeyRef.current = readingsKey;
      setPointsText(rehabilitation.benkelman.readings_mm.join(', '));
    }
  }, [readingsKey, rehabilitation.benkelman.readings_mm]);

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerState(null);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, []);

  const subgradeResolved = useMemo(() => resolveSubgrade(project.subgrade), [project.subgrade]);
  const bang13 = useMemo(
    () => assessBang13Severity(rehabilitation.assessment),
    [rehabilitation.assessment],
  );
  const benkelmanStats = useMemo(
    () => computeBenkelmanEchCu(rehabilitation.benkelman, project.roadScale.doTinCayTK),
    [rehabilitation.benkelman, project.roadScale.doTinCayTK],
  );
  const layerStackResult = useMemo(
    () =>
      computeExistingLayersEchCu(
        rehabilitation.existingLayers,
        subgradeResolved.E0_MPa,
        project.forecast.duongKinhVetBanh_D_cm,
      ),
    [
      rehabilitation.existingLayers,
      subgradeResolved.E0_MPa,
      project.forecast.duongKinhVetBanh_D_cm,
    ],
  );
  const resolvedEch = useMemo(
    () =>
      resolveRehabilitationEchCu(
        rehabilitation,
        subgradeResolved.E0_MPa,
        project.forecast.duongKinhVetBanh_D_cm,
        project.roadScale.doTinCayTK,
      ),
    [
      rehabilitation,
      subgradeResolved.E0_MPa,
      project.forecast.duongKinhVetBanh_D_cm,
      project.roadScale.doTinCayTK,
    ],
  );
  const issues = useMemo(() => validateRehabilitationInputs(project), [project]);

  const autoZAlpha = getZAlphaForReliability(project.roadScale.doTinCayTK);
  const directEffectiveEch = Number(
    (
      Math.max(0, rehabilitation.directEchCu_MPa) *
      (rehabilitation.directKdc > 0 ? rehabilitation.directKdc : 1.0)
    ).toFixed(2),
  );

  const updateAssessment = (patch: Partial<RehabilitationConfig['assessment']>) => {
    onChange((prev) => ({
      ...prev,
      assessment: { ...prev.assessment, ...patch },
    }));
  };

  const updateBenkelman = (patch: Partial<RehabilitationConfig['benkelman']>) => {
    onChange((prev) => ({
      ...prev,
      benkelman: { ...prev.benkelman, ...patch },
    }));
  };

  const handlePointsChange = (raw: string) => {
    setPointsText(raw);
    const parsed = parsePointsList(raw);
    lastSyncedKeyRef.current = parsed.join(',');
    updateBenkelman({ readings_mm: parsed });
  };

  const addExistingLayer = (isTangMat: boolean) => {
    const newLayer: ExistingPavementLayer = {
      id: `old-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tang: isTangMat ? 'TANG_MAT' : 'TANG_MONG',
      isTangMat,
      sttTrongTang: 1,
      tenVatLieu: isTangMat ? 'BTN chặt cũ giữ lại' : 'Cấp phối đá dăm loại I (cũ)',
      chieuDay_cm: isTangMat ? 7 : 18,
      E_vong_30C: isTangMat ? 350 : 300,
      E_truot_60C: isTangMat ? 250 : 300,
      E_keoUon_10_15C: isTangMat ? 1600 : 300,
      Rku_MPa: isTangMat ? 1.6 : 0,
      C_MPa: 0,
      phi_deg: 0,
      ghiChu: isTangMat ? 'Tầng mặt cũ' : 'Tầng móng cũ',
      K_hh: isTangMat ? 0.7 : 0.9,
      checkFlexural: false,
    };
    const next = renumberExistingLayers([...rehabilitation.existingLayers, newLayer]);
    onChange((prev) => ({ ...prev, existingLayers: next }));
    const idx = next.findIndex((l) => l.id === newLayer.id);
    setSelectedRowIdx(idx >= 0 ? idx : 0);
  };

  const deleteSelectedExistingLayer = () => {
    if (
      rehabilitation.existingLayers.length === 0 ||
      selectedRowIdx < 0 ||
      selectedRowIdx >= rehabilitation.existingLayers.length
    ) {
      return;
    }
    const next = renumberExistingLayers(
      rehabilitation.existingLayers.filter((_, i) => i !== selectedRowIdx),
    );
    onChange((prev) => ({ ...prev, existingLayers: next }));
    setSelectedRowIdx(Math.max(0, Math.min(selectedRowIdx, next.length - 1)));
  };

  const updateExistingCell = (idx: number, patch: Partial<ExistingPavementLayer>) => {
    onChange((prev) => ({
      ...prev,
      existingLayers: prev.existingLayers.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    }));
  };

  const applyMaterialToExistingRow = (rowIdx: number, mat: MaterialRecord) => {
    if (mat.isGroupHeader) return;
    updateExistingCell(rowIdx, {
      tenVatLieu: mat.name,
      E_vong_30C: mat.E_vong_30C,
      E_truot_60C: mat.E_truot_60C,
      E_keoUon_10_15C: mat.E_keoUon_10_15C,
      Rku_MPa: mat.Rku_MPa,
      C_MPa: mat.C_MPa,
      phi_deg: mat.phi_deg,
      ghiChu: mat.note,
    });
    setPickerState(null);
  };

  return (
    <div className="adm-tab-pad" style={{ maxWidth: 1080 }} data-testid="tab-ao-duong-cu">
      <div className="adm-ch10-stack">
        {/* BLOCK 1: Giải pháp cải tạo & Đánh giá hiện trạng Bảng 13 */}
        <fieldset className="adm-groupbox">
          <legend>1. Giải pháp cải tạo (§10.1.4.3) &amp; Đánh giá hiện trạng Bảng 13 (§10.3.1)</legend>

          <div className="adm-grid-2col" style={{ gap: 18 }}>
            {/* Left: Strategy + Segment info */}
            <div>
              <div style={{ fontWeight: 700, color: 'var(--accd)', marginBottom: 6 }}>
                Nhóm giải pháp thiết kế tăng cường / cải tạo:
              </div>
              {(
                [
                  [
                    'DIRECT_OVERLAY',
                    'Phương án 3: Trực tiếp tăng cường lên mặt đường cũ (có thể bù vênh)',
                  ],
                  [
                    'MILL_AND_OVERLAY',
                    'Phương án 2: Cào bóc/tái chế tầng mặt hư hỏng, tận dụng móng cũ + tăng cường',
                  ],
                  [
                    'FULL_REBUILD',
                    'Phương án 1: Cải tạo toàn bộ kết cấu từ nền trở lên (tính trên nền E₀)',
                  ],
                ] as Array<[RehabStrategy, string]>
              ).map(([val, label]) => (
                <label key={val} className="adm-radio-row">
                  <input
                    type="radio"
                    name="rehabStrategy"
                    data-testid={`radio-strategy-${val}`}
                    checked={rehabilitation.strategy === val}
                    onChange={() => {
                      onChange((prev) => ({ ...prev, strategy: val }));
                      onStatus?.(`Đã chọn giải pháp cải tạo: ${label}`);
                    }}
                  />
                  <span>{label}</span>
                </label>
              ))}

              <div className="adm-form-row" style={{ marginTop: 12, gridTemplateColumns: '150px 1fr auto' }}>
                <label htmlFor="ed_SegName">Tên phân đoạn:</label>
                <input
                  id="ed_SegName"
                  type="text"
                  className="adm-input"
                  value={rehabilitation.assessment.segmentName}
                  onChange={(e) => updateAssessment({ segmentName: e.target.value })}
                />
                <span />
              </div>

              <div className="adm-form-row" style={{ gridTemplateColumns: '150px 1fr auto' }}>
                <label htmlFor="ed_SegLen">Chiều dài phân đoạn:</label>
                <input
                  id="ed_SegLen"
                  type="number"
                  min={1}
                  step={50}
                  className="adm-input adm-input-num"
                  value={rehabilitation.assessment.segmentLength_m}
                  onChange={(e) =>
                    updateAssessment({ segmentLength_m: Math.max(0, parseFloat(e.target.value) || 0) })
                  }
                />
                <span className="adm-unit">(m) — tối đa 1000 m</span>
              </div>

              {rehabilitation.assessment.segmentLength_m > 1000 && (
                <div className="adm-alert-warn" data-testid="warn-segment-length">
                  <strong>Cảnh báo §10.3.1.2:</strong> Chiều dài phân đoạn ({rehabilitation.assessment.segmentLength_m} m) vượt quá 1000 m; nên chia nhỏ thành các phân đoạn đồng nhất.
                </div>
              )}

              <div className="adm-form-row" style={{ marginTop: 8, gridTemplateColumns: '150px 1fr auto' }}>
                <label htmlFor="cb_OldSurfaceGrade">Cấp mặt đường cũ:</label>
                <select
                  id="cb_OldSurfaceGrade"
                  className="adm-select"
                  value={rehabilitation.assessment.oldSurfaceGrade}
                  onChange={(e) =>
                    updateAssessment({ oldSurfaceGrade: e.target.value as SurfaceGrade })
                  }
                >
                  <option value="A1">Cấp cao A1</option>
                  <option value="A2">Cấp cao A2</option>
                  <option value="B1">Cấp thấp B1</option>
                  <option value="B2">Cấp thấp B2</option>
                </select>
                <span />
              </div>

              <div className="adm-form-row" style={{ gridTemplateColumns: '150px 1fr auto', marginBottom: 0 }}>
                <label htmlFor="ed_Pci">Chỉ số PCI (nếu có):</label>
                <input
                  id="ed_Pci"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  placeholder="Tùy chọn (0–100)"
                  className="adm-input adm-input-num"
                  value={rehabilitation.assessment.pci ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    updateAssessment({
                      pci: raw === '' ? null : Math.max(0, Math.min(100, parseFloat(raw) || 0)),
                    });
                  }}
                />
                <span className="adm-unit">(TCCS 07:2013)</span>
              </div>
            </div>

            {/* Right: Distress evaluation & Table 13 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, color: 'var(--accd)' }}>
                  Đánh giá mức độ hư hỏng theo Bảng 13:
                </span>
                <button
                  type="button"
                  className="adm-btn"
                  data-testid="btn-ref-bang13"
                  onClick={() => setBang13Open(true)}
                >
                  <img src={UI_ICONS.thamKhaoSmall} alt="" />
                  <span>Tham khảo Bảng 13</span>
                </button>
              </div>

              <div className="adm-form-row" style={{ gridTemplateColumns: '165px 1fr 78px' }}>
                <label htmlFor="cb_CrackLevel">Mức độ nứt mặt:</label>
                <select
                  id="cb_CrackLevel"
                  className="adm-select"
                  value={rehabilitation.assessment.crackingLevel}
                  onChange={(e) =>
                    updateAssessment({ crackingLevel: e.target.value as DistressSeverity })
                  }
                >
                  <option value="NONE">Không / Rất ít</option>
                  <option value="NHE">Nhẹ (khe nứt &lt; 10 mm / chưa nối mạng)</option>
                  <option value="VUA">Vừa (10–100 mm / đã nối mạng)</option>
                  <option value="NANG">Nặng (&gt; 100 mm / bong vỡ lan rộng)</option>
                </select>
                <span className={severityBadgeClass(bang13.cracking.level)} data-testid="badge-cracking">
                  {bang13.cracking.label}
                </span>
              </div>

              <div className="adm-form-row" style={{ gridTemplateColumns: '165px 1fr 78px' }}>
                <label htmlFor="ed_RutDepth">Vệt hằn bánh xe (mm):</label>
                <input
                  id="ed_RutDepth"
                  type="number"
                  min={0}
                  step={1}
                  className="adm-input adm-input-num"
                  value={rehabilitation.assessment.ruttingDepth_mm ?? 0}
                  onChange={(e) =>
                    updateAssessment({ ruttingDepth_mm: Math.max(0, parseFloat(e.target.value) || 0) })
                  }
                />
                <span className={severityBadgeClass(bang13.rutting.level)} data-testid="badge-rut">
                  {bang13.rutting.label}
                </span>
              </div>

              <div className="adm-form-row" style={{ gridTemplateColumns: '165px 1fr 78px' }}>
                <label htmlFor="ed_SinkDepth">Lún lõm cục bộ (mm):</label>
                <input
                  id="ed_SinkDepth"
                  type="number"
                  min={0}
                  step={1}
                  className="adm-input adm-input-num"
                  value={rehabilitation.assessment.localizedSink_mm ?? 0}
                  onChange={(e) =>
                    updateAssessment({
                      localizedSink_mm: Math.max(0, parseFloat(e.target.value) || 0),
                    })
                  }
                />
                <span className={severityBadgeClass(bang13.localizedSink.level)} data-testid="badge-sink">
                  {bang13.localizedSink.label}
                </span>
              </div>

              <label className="adm-check-row" style={{ marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={rehabilitation.assessment.hasReflectiveCrackRisk}
                  onChange={(e) =>
                    updateAssessment({ hasReflectiveCrackRisk: e.target.checked })
                  }
                />
                <span>Có lớp móng gia cố vô cơ cũ (nguy cơ nứt phản ánh — §10.2.3 &amp; §5.2.5)</span>
              </label>

              <label className="adm-check-row">
                <input
                  type="checkbox"
                  checked={rehabilitation.assessment.hasWidening}
                  onChange={(e) => updateAssessment({ hasWidening: e.target.checked })}
                />
                <span>Có mở rộng mặt đường (tạo bậc cấp &ge; 0,3 m — §10.2.5)</span>
              </label>

              <div className="adm-alert-info" data-testid="bang13-summary-box">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <strong>Đánh giá tổng hợp Bảng 13:</strong>
                  <span className={severityBadgeClass(bang13.overall)}>{bang13.overallLabel}</span>
                </div>
                <div>{bang13.reason}</div>
                {rehabilitation.assessment.hasWidening && (
                  <div style={{ marginTop: 4 }}>
                    <strong>Lưu ý mở rộng (§10.2.5):</strong> Tạo bậc cấp gối lên các lớp cũ tối thiểu <strong>0,3 m</strong>; kiểm tra chênh lệch độ võng tại vị trí tiếp giáp cũ–mới không vượt <strong>0,1 mm</strong> (hoặc mô đun chênh lệch &le; 10%).
                  </div>
                )}
              </div>
            </div>
          </div>
        </fieldset>

        {/* BLOCK 2: Xác định E_ch,cũ */}
        {rehabilitation.strategy === 'FULL_REBUILD' ? (
          <div className="adm-alert-info" data-testid="full-rebuild-note">
            <strong>Phương án 1 — Cải tạo toàn bộ kết cấu từ nền trở lên (§10.1.4.3):</strong> Không sử dụng E<sub>ch,cũ</sub> của kết cấu cũ; bộ giải kiểm toán toàn bộ các lớp kết cấu mới trực tiếp trên nền đất E<sub>0</sub> (khai báo tại tab <em>Đất nền</em>).
          </div>
        ) : (
          <fieldset className="adm-groupbox">
            <legend>2. Xác định Mô đun đàn hồi chung đặc trưng áo đường cũ E_ch,cũ (MPa)</legend>

            <div className="adm-ch10-method-bar">
              {(
                [
                  ['BENKELMAN', 'A. Cần Benkelman (TCVN 8867, §10.3.2)'],
                  ['DIRECT_FWD', 'B. Nhập trực tiếp Ech,cũ (FWD / TCVN 8867)'],
                  ['LAYER_STACK', 'C. Tính từ các lớp kết cấu cũ + nền đất (§10.3.3)'],
                ] as Array<[EchCuMethod, string]>
              ).map(([val, label]) => (
                <label key={val} className="adm-radio-row" style={{ marginBottom: 0 }}>
                  <input
                    type="radio"
                    name="echMethod"
                    data-testid={`radio-ech-${val}`}
                    checked={rehabilitation.echMethod === val}
                    onChange={() => onChange((prev) => ({ ...prev, echMethod: val }))}
                  />
                  <span style={{ fontWeight: rehabilitation.echMethod === val ? 700 : 400 }}>
                    {label}
                  </span>
                </label>
              ))}
            </div>

            {/* Method A: Benkelman */}
            {rehabilitation.echMethod === 'BENKELMAN' && (
              <div className="adm-grid-2col" style={{ marginTop: 12, gap: 16 }}>
                <div>
                  <div style={{ display: 'flex', gap: 18, marginBottom: 10 }}>
                    <label className="adm-radio-row" style={{ marginBottom: 0 }}>
                      <input
                        type="radio"
                        name="benkInputMode"
                        checked={rehabilitation.benkelman.inputMode === 'POINTS'}
                        onChange={() => updateBenkelman({ inputMode: 'POINTS' })}
                      />
                      <span>Nhập danh sách điểm đo lᵢ (mm)</span>
                    </label>
                    <label className="adm-radio-row" style={{ marginBottom: 0 }}>
                      <input
                        type="radio"
                        name="benkInputMode"
                        checked={rehabilitation.benkelman.inputMode === 'STATS'}
                        onChange={() => updateBenkelman({ inputMode: 'STATS' })}
                      />
                      <span>Nhập trực tiếp l_tb, S</span>
                    </label>
                  </div>

                  {rehabilitation.benkelman.inputMode === 'POINTS' ? (
                    <div style={{ marginBottom: 10 }}>
                      <label
                        htmlFor="txt_BenkPoints"
                        style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}
                      >
                        Danh sách độ võng từng điểm đo lᵢ (mm, ngăn cách bởi dấu phẩy hoặc khoảng trắng):
                      </label>
                      <textarea
                        id="txt_BenkPoints"
                        data-testid="benkelman-points-input"
                        className="adm-input"
                        style={{ height: 68, padding: 8, resize: 'vertical' }}
                        value={pointsText}
                        onChange={(e) => handlePointsChange(e.target.value)}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="adm-form-row" style={{ gridTemplateColumns: '175px 1fr auto' }}>
                        <label htmlFor="ed_Ltb">Độ võng trung bình l_tb:</label>
                        <input
                          id="ed_Ltb"
                          type="number"
                          min={0}
                          step="0.01"
                          className="adm-input adm-input-num"
                          value={rehabilitation.benkelman.l_tb_mm}
                          onChange={(e) =>
                            updateBenkelman({ l_tb_mm: Math.max(0, parseFloat(e.target.value) || 0) })
                          }
                        />
                        <span className="adm-unit">(mm)</span>
                      </div>
                      <div className="adm-form-row" style={{ gridTemplateColumns: '175px 1fr auto' }}>
                        <label htmlFor="ed_Smm">Độ lệch chuẩn S:</label>
                        <input
                          id="ed_Smm"
                          type="number"
                          min={0}
                          step="0.005"
                          className="adm-input adm-input-num"
                          value={rehabilitation.benkelman.S_mm}
                          onChange={(e) =>
                            updateBenkelman({ S_mm: Math.max(0, parseFloat(e.target.value) || 0) })
                          }
                        />
                        <span className="adm-unit">(mm)</span>
                      </div>
                    </>
                  )}

                  <div className="adm-form-row" style={{ gridTemplateColumns: '175px 1fr auto' }}>
                    <label htmlFor="ed_Zalpha">Hệ số tin cậy Z_α:</label>
                    <input
                      id="ed_Zalpha"
                      type="number"
                      min={0}
                      step="0.001"
                      className="adm-input adm-input-num"
                      value={rehabilitation.benkelman.Z_alpha}
                      onChange={(e) =>
                        updateBenkelman({ Z_alpha: Math.max(0, parseFloat(e.target.value) || 0) })
                      }
                    />
                    <button
                      type="button"
                      className="adm-btn"
                      style={{ height: 28, padding: '0 8px', fontSize: 11 }}
                      title="Ánh xạ tự động Z_α từ độ tin cậy thiết kế R"
                      onClick={() => updateBenkelman({ Z_alpha: autoZAlpha })}
                    >
                      Theo R={project.roadScale.doTinCayTK.toFixed(2)} ({autoZAlpha})
                    </button>
                  </div>

                  <div className="adm-grid-2col" style={{ gap: 10 }}>
                    <div className="adm-form-row" style={{ gridTemplateColumns: '110px 1fr auto' }}>
                      <label htmlFor="ed_Kt">Hệ số nhiệt K_t:</label>
                      <input
                        id="ed_Kt"
                        type="number"
                        min={0.1}
                        step="0.01"
                        className="adm-input adm-input-num"
                        value={rehabilitation.benkelman.K_t}
                        onChange={(e) =>
                          updateBenkelman({ K_t: Math.max(0.01, parseFloat(e.target.value) || 1) })
                        }
                      />
                      <span />
                    </div>
                    <div className="adm-form-row" style={{ gridTemplateColumns: '110px 1fr auto' }}>
                      <label htmlFor="ed_Kam">Hệ số ẩm K_ẩm:</label>
                      <input
                        id="ed_Kam"
                        type="number"
                        min={0.1}
                        step="0.01"
                        className="adm-input adm-input-num"
                        value={rehabilitation.benkelman.K_am}
                        onChange={(e) =>
                          updateBenkelman({ K_am: Math.max(0.01, parseFloat(e.target.value) || 1) })
                        }
                      />
                      <span />
                    </div>
                  </div>

                  <div className="adm-grid-2col" style={{ gap: 10 }}>
                    <div className="adm-form-row" style={{ gridTemplateColumns: '110px 1fr auto' }}>
                      <label htmlFor="ed_Pdo">Áp lực p_đo:</label>
                      <input
                        id="ed_Pdo"
                        type="number"
                        min={0.1}
                        step="0.05"
                        className="adm-input adm-input-num"
                        value={rehabilitation.benkelman.p_do_MPa}
                        onChange={(e) =>
                          updateBenkelman({ p_do_MPa: Math.max(0.01, parseFloat(e.target.value) || 0.6) })
                        }
                      />
                      <span className="adm-unit">MPa</span>
                    </div>
                    <div className="adm-form-row" style={{ gridTemplateColumns: '110px 1fr auto' }}>
                      <label htmlFor="ed_Ddo">Đường kính D_đo:</label>
                      <input
                        id="ed_Ddo"
                        type="number"
                        min={1}
                        step="0.5"
                        className="adm-input adm-input-num"
                        value={rehabilitation.benkelman.D_do_cm}
                        onChange={(e) =>
                          updateBenkelman({ D_do_cm: Math.max(1, parseFloat(e.target.value) || 33) })
                        }
                      />
                      <span className="adm-unit">cm</span>
                    </div>
                  </div>

                  <div className="adm-form-row" style={{ gridTemplateColumns: '175px 1fr auto', marginBottom: 0 }}>
                    <label htmlFor="ed_Mu">Hệ số Poisson μ:</label>
                    <input
                      id="ed_Mu"
                      type="number"
                      min={0}
                      max={0.49}
                      step="0.01"
                      className="adm-input adm-input-num"
                      value={rehabilitation.benkelman.mu}
                      onChange={(e) =>
                        updateBenkelman({
                          mu: Math.max(0, Math.min(0.49, parseFloat(e.target.value) || 0)),
                        })
                      }
                    />
                    <span />
                  </div>
                </div>

                {/* Live Benkelman Results + H_cu */}
                <div>
                  <div className="adm-ch10-result-box" data-testid="benkelman-live-box">
                    <div className="adm-ch10-result-title">
                      Kết quả xử lý số liệu Benkelman (TCVN 8867)
                    </div>
                    <div className="adm-ch10-kv-grid">
                      <span>Số điểm đo n:</span>
                      <strong>
                        {rehabilitation.benkelman.inputMode === 'POINTS' ? benkelmanStats.n : 'Thống kê'}
                      </strong>
                      <span>Độ võng trung bình l_tb:</span>
                      <strong>{benkelmanStats.l_tb_mm.toFixed(3)} mm</strong>
                      <span>Độ lệch chuẩn S:</span>
                      <strong>{benkelmanStats.S_mm.toFixed(4)} mm</strong>
                      <span>Hệ số biến động C_v:</span>
                      <strong style={{ color: benkelmanStats.Cv > 0.25 ? 'var(--bad)' : undefined }}>
                        {(benkelmanStats.Cv * 100).toFixed(1)}%
                      </strong>
                      <span>Độ võng đặc trưng l_đc:</span>
                      <strong>{benkelmanStats.l_dc_mm.toFixed(3)} mm</strong>
                      <span>Độ võng tính toán l_tt:</span>
                      <strong>{benkelmanStats.l_tt_mm.toFixed(3)} mm</strong>
                    </div>
                    <div className="adm-ch10-ech-highlight">
                      <span>Mô đun đàn hồi chung áo đường cũ E<sub>ch,cũ</sub>:</span>
                      <strong data-testid="benkelman-ech-value">
                        {benkelmanStats.echCu_MPa.toFixed(2)} MPa
                      </strong>
                    </div>
                  </div>

                  <div className="adm-form-row" style={{ marginTop: 12, gridTemplateColumns: '215px 1fr auto', marginBottom: 0 }}>
                    <label htmlFor="ed_TotalExistingH">Tổng bề dày kết cấu cũ H_cũ (tùy chọn):</label>
                    <input
                      id="ed_TotalExistingH"
                      data-testid="input-total-existing-h"
                      type="number"
                      min={0}
                      step="1"
                      placeholder="cm (hỗ trợ kiểm trượt nền §10.3.3)"
                      className="adm-input adm-input-num"
                      value={rehabilitation.totalExistingThickness_cm ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        onChange((prev) => ({
                          ...prev,
                          totalExistingThickness_cm:
                            raw === '' ? undefined : Math.max(0, parseFloat(raw) || 0),
                        }));
                      }}
                    />
                    <span className="adm-unit">(cm)</span>
                  </div>
                </div>
              </div>
            )}

            {/* Method B: Direct FWD */}
            {rehabilitation.echMethod === 'DIRECT_FWD' && (
              <div className="adm-grid-2col" style={{ marginTop: 12, gap: 16 }}>
                <div>
                  <div className="adm-form-row" style={{ gridTemplateColumns: '210px 1fr auto' }}>
                    <label htmlFor="ed_DirectEch">E_ch,cũ đo từ FWD / thí nghiệm:</label>
                    <input
                      id="ed_DirectEch"
                      data-testid="input-direct-ech"
                      type="number"
                      min={0}
                      step="1"
                      className="adm-input adm-input-num"
                      value={rehabilitation.directEchCu_MPa}
                      onChange={(e) =>
                        onChange((prev) => ({
                          ...prev,
                          directEchCu_MPa: Math.max(0, parseFloat(e.target.value) || 0),
                        }))
                      }
                    />
                    <span className="adm-unit">(MPa)</span>
                  </div>
                  <div className="adm-form-row" style={{ gridTemplateColumns: '210px 1fr auto' }}>
                    <label htmlFor="ed_DirectKdc">Hệ số điều chỉnh mùa/tin cậy K_đc:</label>
                    <input
                      id="ed_DirectKdc"
                      data-testid="input-direct-kdc"
                      type="number"
                      min={0.1}
                      max={1.5}
                      step="0.01"
                      className="adm-input adm-input-num"
                      value={rehabilitation.directKdc}
                      onChange={(e) =>
                        onChange((prev) => ({
                          ...prev,
                          directKdc: Math.max(0.01, parseFloat(e.target.value) || 1.0),
                        }))
                      }
                    />
                    <span className="adm-unit">(mặc định 1.00)</span>
                  </div>
                  <div className="adm-form-row" style={{ gridTemplateColumns: '210px 1fr auto', marginBottom: 0 }}>
                    <label htmlFor="ed_TotalExistingH_Fwd">Tổng bề dày kết cấu cũ H_cũ (tùy chọn):</label>
                    <input
                      id="ed_TotalExistingH_Fwd"
                      data-testid="input-total-existing-h"
                      type="number"
                      min={0}
                      step="1"
                      placeholder="cm (hỗ trợ kiểm trượt nền §10.3.3)"
                      className="adm-input adm-input-num"
                      value={rehabilitation.totalExistingThickness_cm ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        onChange((prev) => ({
                          ...prev,
                          totalExistingThickness_cm:
                            raw === '' ? undefined : Math.max(0, parseFloat(raw) || 0),
                        }));
                      }}
                    />
                    <span className="adm-unit">(cm)</span>
                  </div>
                </div>

                <div className="adm-ch10-result-box">
                  <div className="adm-ch10-result-title">
                    Giá trị E<sub>ch,cũ</sub> áp dụng kiểm toán (§10.4.2)
                  </div>
                  <div className="adm-ch10-ech-highlight" data-testid="fwd-effective-ech">
                    <span>
                      E<sub>ch,cũ</sub><sup>tt</sup> = E<sub>ch,cũ</sub> × K<sub>đc</sub>:
                    </span>
                    <strong>{directEffectiveEch.toFixed(2)} MPa</strong>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--mut)', marginTop: 6 }}>
                    Nếu đã nhập <em>H_cũ</em> (hoặc có danh sách lớp cũ), hệ thống sẽ kiểm toán cắt trượt đất nền cũ theo §10.3.3.
                  </div>
                </div>
              </div>
            )}

            {/* Method C: Layer Stack */}
            {rehabilitation.echMethod === 'LAYER_STACK' && (
              <div style={{ marginTop: 12 }}>
                <div className="adm-kcad-toolbar" style={{ marginBottom: 8 }}>
                  <button
                    type="button"
                    className="adm-btn"
                    data-testid="btn-add-old-surface"
                    onClick={() => addExistingLayer(true)}
                  >
                    Thêm lớp mặt cũ giữ lại
                  </button>
                  <button
                    type="button"
                    className="adm-btn"
                    data-testid="btn-add-old-base"
                    onClick={() => addExistingLayer(false)}
                  >
                    Thêm lớp móng cũ giữ lại
                  </button>
                  <button
                    type="button"
                    className="adm-btn"
                    disabled={rehabilitation.existingLayers.length === 0}
                    onClick={deleteSelectedExistingLayer}
                  >
                    <img src={UI_ICONS.xoaLopSmall} alt="" />
                    <span>Xóa lớp cũ</span>
                  </button>
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--accd)', fontWeight: 600 }}>
                    Nền đất cũ E₀ = {subgradeResolved.E0_MPa.toFixed(2)} MPa
                  </span>
                </div>

                <div className="adm-grid-wrap" style={{ maxHeight: 280 }}>
                  <table className="adm-table" data-testid="table-existing-layers">
                    <thead>
                      <tr>
                        <th style={{ width: 72 }}>Tầng</th>
                        <th style={{ width: 210 }}>Vật liệu lớp cũ</th>
                        <th style={{ width: 54 }}>H (cm)</th>
                        <th style={{ width: 66 }}>Ev (30°C)</th>
                        <th style={{ width: 66 }}>Etr (60°C)</th>
                        <th style={{ width: 72 }}>Eku (10-15°C)</th>
                        <th style={{ width: 58 }}>Rku</th>
                        <th style={{ width: 56 }}>C</th>
                        <th style={{ width: 52 }}>φ</th>
                        <th style={{ width: 58 }} title="Hệ số suy giảm chất lượng lớp cũ K_hh ∈ (0, 1.0]">
                          K_hh
                        </th>
                        <th style={{ width: 76 }} title="Kiểm tra kéo uốn cho lớp liền khối cũ giữ lại">
                          Kéo uốn
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rehabilitation.existingLayers.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="center adm-muted-dash" style={{ height: 42 }}>
                            Chưa có lớp kết cấu cũ giữ lại. Nhấn &quot;Thêm lớp mặt cũ giữ lại&quot; hoặc &quot;Thêm lớp móng cũ giữ lại&quot;.
                          </td>
                        </tr>
                      ) : (
                        rehabilitation.existingLayers.map((layer, idx) => (
                          <tr
                            key={layer.id}
                            className={selectedRowIdx === idx ? 'selected' : ''}
                            onClick={() => setSelectedRowIdx(idx)}
                          >
                            <td className="center" style={{ fontWeight: 600 }}>
                              {layer.isTangMat ? 'Mặt cũ' : 'Móng cũ'}
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <input
                                  type="text"
                                  value={layer.tenVatLieu}
                                  onChange={(e) =>
                                    updateExistingCell(idx, { tenVatLieu: e.target.value })
                                  }
                                />
                                <button
                                  type="button"
                                  className="adm-btn"
                                  style={{ height: 22, padding: '0 6px', fontSize: 10 }}
                                  title="Chọn từ thư viện VatLieu.dat"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                    setPickerState({
                                      rowIndex: idx,
                                      left: Math.max(8, Math.min(rect.left - 240, window.innerWidth - 395)),
                                      top: Math.min(rect.bottom + 2, window.innerHeight - 320),
                                    });
                                  }}
                                >
                                  ▾
                                </button>
                              </div>
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.5"
                                className="num"
                                value={layer.chieuDay_cm}
                                onChange={(e) =>
                                  updateExistingCell(idx, {
                                    chieuDay_cm: Math.max(0, parseFloat(e.target.value) || 0),
                                  })
                                }
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="1"
                                className="num"
                                value={layer.E_vong_30C}
                                onChange={(e) =>
                                  updateExistingCell(idx, {
                                    E_vong_30C: Math.max(0, parseFloat(e.target.value) || 0),
                                  })
                                }
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="1"
                                className="num"
                                value={layer.E_truot_60C}
                                onChange={(e) =>
                                  updateExistingCell(idx, {
                                    E_truot_60C: Math.max(0, parseFloat(e.target.value) || 0),
                                  })
                                }
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="1"
                                className="num"
                                value={layer.E_keoUon_10_15C}
                                onChange={(e) =>
                                  updateExistingCell(idx, {
                                    E_keoUon_10_15C: Math.max(0, parseFloat(e.target.value) || 0),
                                  })
                                }
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                className="num"
                                value={layer.Rku_MPa}
                                onChange={(e) =>
                                  updateExistingCell(idx, {
                                    Rku_MPa: Math.max(0, parseFloat(e.target.value) || 0),
                                  })
                                }
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.001"
                                className="num"
                                value={layer.C_MPa}
                                onChange={(e) =>
                                  updateExistingCell(idx, {
                                    C_MPa: Math.max(0, parseFloat(e.target.value) || 0),
                                  })
                                }
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.5"
                                className="num"
                                value={layer.phi_deg}
                                onChange={(e) =>
                                  updateExistingCell(idx, {
                                    phi_deg: Math.max(0, parseFloat(e.target.value) || 0),
                                  })
                                }
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min={0.05}
                                max={1.0}
                                step="0.05"
                                className="num"
                                data-testid={`input-khh-${idx}`}
                                value={layer.K_hh}
                                onChange={(e) => {
                                  const v = parseFloat(e.target.value);
                                  updateExistingCell(idx, {
                                    K_hh: Number.isFinite(v) ? Math.min(1, Math.max(0.01, v)) : 1,
                                  });
                                }}
                              />
                            </td>
                            <td className="center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                style={{ width: 14, height: 14 }}
                                checked={Boolean(layer.checkFlexural)}
                                onChange={(e) =>
                                  updateExistingCell(idx, { checkFlexural: e.target.checked })
                                }
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="adm-ch10-result-box" style={{ marginTop: 10 }} data-testid="layer-stack-live-box">
                  <div className="adm-ch10-kv-grid" style={{ gridTemplateColumns: 'repeat(4, auto)' }}>
                    <span>Tổng bề dày cũ giữ lại H<sub>cũ</sub>:</span>
                    <strong>{layerStackResult.reduction.H_total_cm.toFixed(1)} cm</strong>
                    <span>E<sub>tb,cũ</sub><sup>đc</sup> quy đổi:</span>
                    <strong>{layerStackResult.reduction.Etb_dc_MPa.toFixed(2)} MPa</strong>
                  </div>
                  <div className="adm-ch10-ech-highlight" style={{ marginTop: 6 }}>
                    <span>
                      Mô đun đàn hồi chung áo đường cũ E<sub>ch,cũ</sub> (trên nền E₀ = {subgradeResolved.E0_MPa.toFixed(2)} MPa):
                    </span>
                    <strong data-testid="layer-stack-ech-value">
                      {layerStackResult.echCu_MPa.toFixed(2)} MPa
                    </strong>
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--accd)' }}>
              Giá trị E<sub>ch,cũ</sub> hiện hành được truyền cho kiểm toán §10.4.2:{' '}
              <strong data-testid="resolved-ech-cu">{resolvedEch.echCu_MPa.toFixed(2)} MPa</strong>
            </div>
          </fieldset>
        )}

        {/* BLOCK 3: Cảnh báo & Kiểm tra hợp lệ Chương 10 */}
        <fieldset className="adm-groupbox" data-testid="ch10-validation-panel">
          <legend>3. Cảnh báo &amp; Kiểm tra hợp lệ Chương 10 (TCCS 38:2022/TCĐBVN)</legend>
          {issues.length === 0 ? (
            <div className="adm-alert-ok">
              Dữ liệu Chương 10 hợp lệ — không có cảnh báo hoặc lỗi cấu tạo/kiểm toán nào.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {issues.map((issue) => (
                <div
                  key={issue.id}
                  className={
                    issue.severity === 'error'
                      ? 'adm-alert-error'
                      : issue.severity === 'warning'
                        ? 'adm-alert-warn'
                        : 'adm-alert-info'
                  }
                  style={{ marginTop: 0 }}
                  data-severity={issue.severity}
                >
                  <strong>[{issue.clause}]</strong> {issue.message}
                </div>
              ))}
            </div>
          )}
        </fieldset>
      </div>

      {/* Material Picker Dropdown for Existing Layers */}
      {pickerState && (
        <div
          ref={pickerRef}
          className="adm-mat-dropdown"
          style={{ left: pickerState.left, top: pickerState.top }}
        >
          <div className="adm-mat-dropdown-head">Chọn vật liệu lớp cũ (VatLieu.dat)</div>
          {materials.map((m) => (
            <div
              key={`${m.index}-${m.name}`}
              className={`adm-mat-opt ${m.isGroupHeader ? 'group' : ''}`}
              onClick={() => applyMaterialToExistingRow(pickerState.rowIndex, m)}
            >
              {m.isGroupHeader ? m.name.replace(/^\(\*\)/, '') : m.name}
            </div>
          ))}
        </div>
      )}

      <Bang13DistressModal open={bang13Open} onClose={() => setBang13Open(false)} />
    </div>
  );
}
