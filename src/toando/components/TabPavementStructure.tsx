import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { UI_ICONS } from '../assets/iconRegistry';
import { isAsphaltMixtureName, isInorganicStabilizedMaterial } from '../engine/rehabilitation';
import type {
  DesignKindType,
  MaterialRecord,
  PavementAlternative,
  PavementLayer,
  PavementTier,
} from '../types/project';
import { MaterialRowModal, type MaterialRowFormValues } from './Dialogs';

export interface TabPavementStructureProps {
  alternative: PavementAlternative;
  materials: MaterialRecord[];
  loaiTK?: DesignKindType;
  onCommitLayers: (altId: string, layers: PavementLayer[]) => void;
  onStatus: (msg: string) => void;
}

function renumberLayers(layers: PavementLayer[]): PavementLayer[] {
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

export function TabPavementStructure({
  alternative,
  materials,
  loaiTK = 'TK_MOI',
  onCommitLayers,
  onStatus,
}: TabPavementStructureProps): React.ReactElement {
  const [draftLayers, setDraftLayers] = useState<PavementLayer[]>(() =>
    renumberLayers(alternative.layers),
  );
  const [dirtyDraft, setDirtyDraft] = useState(false);
  const [selectedRowIdx, setSelectedRowIdx] = useState<number>(0);
  const [pickerState, setPickerState] = useState<{
    rowIndex: number;
    left: number;
    top: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const [editModalIdx, setEditModalIdx] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const isRehab = loaiTK === 'CAI_TAO';

  useEffect(() => {
    setDraftLayers(renumberLayers(alternative.layers));
    setDirtyDraft(false);
    setSelectedRowIdx(0);
    setPickerState(null);
  }, [alternative.id, alternative.layers]);

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target?.closest?.('[data-mat-trigger]')) return;
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerState(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickerState(null);
    };
    const onResize = () => setPickerState(null);
    document.addEventListener('mousedown', onDocDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const handleSave = () => {
    const normalized = renumberLayers(draftLayers);
    setDraftLayers(normalized);
    setDirtyDraft(false);
    onCommitLayers(alternative.id, normalized);
    onStatus(`Đã lưu kết cấu áo đường cho ${alternative.name}.`);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const addLayer = (isTangMat: boolean, isBuVenh = false) => {
    const newLayer: PavementLayer = {
      id: `layer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tang: isTangMat ? 'TANG_MAT' : 'TANG_MONG',
      isTangMat,
      sttTrongTang: 1,
      tenVatLieu: isBuVenh ? 'Bù vênh hỗn hợp BTN chặt 12,5' : '',
      chieuDay_cm: isBuVenh ? 3 : isTangMat ? 5 : 15,
      E_vong_30C: isBuVenh ? 350 : 0,
      E_truot_60C: isBuVenh ? 350 : 0,
      E_keoUon_10_15C: isBuVenh ? 1600 : 0,
      Rku_MPa: isBuVenh ? 2.0 : 0,
      C_MPa: 0,
      phi_deg: 0,
      ghiChu: isBuVenh ? 'Lớp bù vênh tạo mui luyện (§10.2.1.2)' : '',
      ...(isBuVenh ? { isBuVenh: true } : {}),
    };
    const next = renumberLayers([...draftLayers, newLayer]);
    setDraftLayers(next);
    setDirtyDraft(true);
    const idx = next.findIndex((l) => l.id === newLayer.id);
    setSelectedRowIdx(idx >= 0 ? idx : 0);
  };

  const deleteSelectedLayer = () => {
    if (draftLayers.length === 0 || selectedRowIdx < 0 || selectedRowIdx >= draftLayers.length) {
      return;
    }
    const next = renumberLayers(draftLayers.filter((_, i) => i !== selectedRowIdx));
    setDraftLayers(next);
    setDirtyDraft(true);
    setSelectedRowIdx(Math.max(0, Math.min(selectedRowIdx, next.length - 1)));
  };

  const handleReset = () => {
    setDraftLayers(renumberLayers(alternative.layers));
    setDirtyDraft(false);
    setPickerState(null);
    onStatus(`Đã khôi phục kết cấu đã lưu của ${alternative.name}.`);
  };

  const updateCell = (idx: number, patch: Partial<PavementLayer>) => {
    setDraftLayers((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
    setDirtyDraft(true);
  };

  const applyMaterialToRow = (rowIdx: number, mat: MaterialRecord) => {
    if (mat.isGroupHeader) return;
    updateCell(rowIdx, {
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

  const surfaceCount = draftLayers.filter((l) => l.isTangMat).length;
  const baseCount = draftLayers.filter((l) => !l.isTangMat).length;
  const editingLayer = editModalIdx !== null ? draftLayers[editModalIdx] : undefined;

  const buVenhInorganicViolations = isRehab
    ? draftLayers.filter((l) => l.isBuVenh && isInorganicStabilizedMaterial(l.tenVatLieu))
    : [];

  let hasAsphaltAbove = false;
  const buVenhNonAsphaltWarnings: PavementLayer[] = [];
  if (isRehab) {
    for (const l of draftLayers) {
      if (l.isBuVenh) {
        if (hasAsphaltAbove && l.tenVatLieu.trim() !== '' && !isAsphaltMixtureName(l.tenVatLieu)) {
          buVenhNonAsphaltWarnings.push(l);
        }
      } else if (l.chieuDay_cm > 0 && l.E_vong_30C > 0 && isAsphaltMixtureName(l.tenVatLieu)) {
        hasAsphaltAbove = true;
      }
    }
  }

  const colCount = isRehab ? 11 : 10;

  return (
    <div ref={wrapRef} className="adm-kcad-wrap" data-testid="tab-ket-cau">
      {/* Top Action Bar */}
      <div className="adm-kcad-toolbar">
        <button type="button" className="adm-btn" onClick={() => addLayer(true)}>
          Thêm lớp tầng mặt
        </button>
        <button type="button" className="adm-btn" onClick={() => addLayer(false)}>
          Thêm lớp tầng móng
        </button>
        {isRehab && (
          <button
            type="button"
            className="adm-btn"
            data-testid="btn-add-bu-venh"
            title="Thêm lớp bù vênh tạo mui luyện (§10.2.1.2: không tính vào cường độ)"
            onClick={() => addLayer(true, true)}
          >
            Thêm lớp bù vênh
          </button>
        )}

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 4 }}>
          <span>Số lớp:</span>
          <input
            id="ed_SoTangMat"
            type="text"
            readOnly
            title="Số lớp tầng mặt"
            className="adm-input adm-input-center"
            style={{ width: 38 }}
            value={surfaceCount > 0 ? String(surfaceCount) : '-'}
          />
          <span>/</span>
          <input
            id="ed_SoTangMong"
            type="text"
            readOnly
            title="Số lớp tầng móng"
            className="adm-input adm-input-center"
            style={{ width: 38 }}
            value={baseCount > 0 ? String(baseCount) : '-'}
          />
        </div>

        <button
          type="button"
          className="adm-btn"
          disabled={draftLayers.length === 0}
          onClick={deleteSelectedLayer}
        >
          <img src={UI_ICONS.xoaLopSmall} alt="" />
          <span>Xóa lớp</span>
        </button>

        <button
          type="button"
          className={`adm-btn ${dirtyDraft ? 'adm-btn-primary' : ''}`}
          data-testid="btn-save-kcad"
          title="Lưu các lớp vật liệu vào phương án hiện tại (Alt+L)"
          onClick={handleSave}
        >
          <img src={UI_ICONS.luuKcadSmall} alt="" />
          <span>Lưu{dirtyDraft ? ' *' : ''}</span>
        </button>

        <button type="button" className="adm-btn" onClick={handleReset}>
          <img src={UI_ICONS.resetSmall} alt="" />
          <span>Reset</span>
        </button>

        {editingLayer === undefined && draftLayers[selectedRowIdx] && (
          <button
            type="button"
            className="adm-btn"
            style={{ marginLeft: 'auto' }}
            onClick={() => setEditModalIdx(selectedRowIdx)}
          >
            Sửa chi tiết lớp...
          </button>
        )}
      </div>

      {/* Layer Grid */}
      <div className="adm-grid-wrap" style={{ flex: 1, minHeight: 180 }}>
        <table className="adm-table" data-testid="table-kcad">
          <thead>
            <tr>
              <th style={{ width: 76 }}>Tầng</th>
              <th style={{ width: 42 }}>Lớp</th>
              <th style={{ width: 225 }}>Vật liệu</th>
              <th style={{ width: 58 }}>H (cm)</th>
              <th style={{ width: 72 }}>E tính võng (30ºC)</th>
              <th style={{ width: 72 }}>E tính trượt (60ºC)</th>
              <th style={{ width: 78 }}>E tính kéo uốn (10-15ºC)</th>
              <th style={{ width: 64 }}>Rku (MPa)</th>
              <th style={{ width: 62 }}>C (MPa)</th>
              <th style={{ width: 56 }}>φ (độ)</th>
              {isRehab && (
                <th style={{ width: 118 }} title="Lớp bù vênh không tính vào cường độ (§10.2.1.2)">
                  Bù vênh
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {draftLayers.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="center adm-muted-dash" style={{ height: 48 }}>
                  Chưa có lớp kết cấu. Nhấn &quot;Thêm lớp tầng mặt&quot; hoặc &quot;Thêm lớp tầng móng&quot;.
                </td>
              </tr>
            ) : (
              draftLayers.map((layer, idx) => {
                const isLeveling = Boolean(layer.isBuVenh);
                const invalidInorganic =
                  isRehab && isLeveling && isInorganicStabilizedMaterial(layer.tenVatLieu);
                return (
                  <tr
                    key={layer.id}
                    className={[
                      selectedRowIdx === idx ? 'selected' : '',
                      isLeveling ? 'adm-bu-venh-row' : '',
                      invalidInorganic ? 'adm-bu-venh-error-row' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => setSelectedRowIdx(idx)}
                    onDoubleClick={() => setEditModalIdx(idx)}
                  >
                    <td className="center" style={{ fontWeight: 600 }}>
                      {layer.isTangMat ? 'Tầng mặt' : 'Tầng móng'}
                    </td>
                    <td className="center">{layer.sttTrongTang}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <input
                          type="text"
                          value={layer.tenVatLieu}
                          placeholder="Chọn vật liệu..."
                          onChange={(e) => updateCell(idx, { tenVatLieu: e.target.value })}
                        />
                        <button
                          type="button"
                          className="adm-btn"
                          data-mat-trigger={idx}
                          style={{ height: 22, padding: '0 6px', fontSize: 10 }}
                          title="Chọn vật liệu từ thư viện"
                          onClick={(e) => {
                            e.stopPropagation();
                            const btnEl = e.currentTarget as HTMLElement;
                            const cellEl = btnEl.closest('td') ?? btnEl.parentElement ?? btnEl;
                            const rect = cellEl.getBoundingClientRect();
                            setPickerState((prev) => {
                              if (prev?.rowIndex === idx) return null;
                              const vw = window.innerWidth;
                              const vh = window.innerHeight;
                              const width = Math.min(Math.max(390, Math.round(rect.width)), vw - 16);
                              const left = Math.max(8, Math.min(Math.round(rect.left), vw - width - 8));
                              const spaceBelow = vh - rect.bottom - 10;
                              const spaceAbove = rect.top - 10;
                              const openAbove = spaceBelow < 200 && spaceAbove > spaceBelow;
                              const maxHeight = Math.max(
                                140,
                                Math.min(320, Math.floor(openAbove ? spaceAbove : spaceBelow)),
                              );
                              const top = openAbove
                                ? Math.max(8, Math.round(rect.top - maxHeight - 2))
                                : Math.max(8, Math.round(rect.bottom + 2));
                              return { rowIndex: idx, left, top, width, maxHeight };
                            });
                          }}
                        >
                          ▾
                        </button>
                      </div>
                      {isRehab && isLeveling && (
                        <div className="adm-bu-venh-badge">Không tính cường độ (§10.2.1.2)</div>
                      )}
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.5"
                        className="num"
                        value={layer.chieuDay_cm}
                        onChange={(e) =>
                          updateCell(idx, { chieuDay_cm: parseFloat(e.target.value) || 0 })
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
                          updateCell(idx, { E_vong_30C: parseFloat(e.target.value) || 0 })
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
                          updateCell(idx, { E_truot_60C: parseFloat(e.target.value) || 0 })
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
                          updateCell(idx, { E_keoUon_10_15C: parseFloat(e.target.value) || 0 })
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
                          updateCell(idx, { Rku_MPa: parseFloat(e.target.value) || 0 })
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
                          updateCell(idx, { C_MPa: parseFloat(e.target.value) || 0 })
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
                          updateCell(idx, { phi_deg: parseFloat(e.target.value) || 0 })
                        }
                      />
                    </td>
                    {isRehab && (
                      <td className="center" onClick={(e) => e.stopPropagation()}>
                        <label
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            cursor: 'pointer',
                            fontSize: 11,
                          }}
                        >
                          <input
                            type="checkbox"
                            data-testid={`chk-bu-venh-${idx}`}
                            style={{ width: 14, height: 14 }}
                            checked={isLeveling}
                            onChange={(e) =>
                              updateCell(idx, { isBuVenh: e.target.checked })
                            }
                          />
                          <span>{isLeveling ? 'Bù vênh' : ''}</span>
                        </label>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {buVenhInorganicViolations.length > 0 && (
        <div className="adm-alert-error" role="alert" data-testid="warn-bu-venh-inorganic">
          <strong>Vi phạm Điều 10.2.1.3 (TCCS 38:2022/TCĐBVN)</strong>: Không được dùng vật liệu hạt hoặc đất gia cố chất liên kết vô cơ (xi măng, vôi...) làm lớp bù vênh ({buVenhInorganicViolations.map((l) => l.tenVatLieu).join(', ')}).
        </div>
      )}

      {buVenhNonAsphaltWarnings.length > 0 && (
        <div className="adm-alert-warn" role="alert" data-testid="warn-bu-venh-material">
          <strong>Lưu ý Điều 10.2.1.3</strong>: Khi lớp tăng cường phía trên là hỗn hợp nhựa, lớp bù vênh ({buVenhNonAsphaltWarnings.map((l) => l.tenVatLieu).join(', ')}) phải dùng hỗn hợp đá nhựa.
        </div>
      )}

      {/* Bottom Notice Bar */}
      <div className="adm-kcad-notice">
        <img src={UI_ICONS.infoKcad} alt="" style={{ width: 16, height: 16 }} />
        <span>
          Lưu ý quan trọng: Sau khi nhập xong các lớp vật liệu cho từng phương án, phải lưu lại
          (nhấn nút &quot;Lưu&quot; hoặc &quot;Alt+L&quot;)
          {isRehab ? ' · Các lớp đánh dấu "Bù vênh" bị loại khỏi stack chịu lực (§10.2.1.2).' : ''}
        </span>
      </div>

      {/* Material Picker Dropdown */}
      {pickerState &&
        createPortal(
          <div
            ref={pickerRef}
            className="adm-mat-dropdown"
            style={{
              left: pickerState.left,
              top: pickerState.top,
              width: pickerState.width,
              maxHeight: pickerState.maxHeight,
            }}
          >
            <div className="adm-mat-dropdown-head">Chọn vật liệu</div>
            {materials.map((m) => (
              <div
                key={`${m.index}-${m.name}`}
                className={`adm-mat-opt ${m.isGroupHeader ? 'group' : ''}`}
                onClick={() => applyMaterialToRow(pickerState.rowIndex, m)}
              >
                {m.isGroupHeader ? m.name.replace(/^\(\*\)/, '') : m.name}
              </div>
            ))}
          </div>,
          wrapRef.current?.closest('.adm-shell') ?? document.body,
        )}

      {/* Material Row Editor Modal */}
      <MaterialRowModal
        open={editModalIdx !== null && !!editingLayer}
        title="Sửa vật liệu lớp kết cấu"
        initialValue={
          editingLayer
            ? {
                name: editingLayer.tenVatLieu,
                E_vong_30C: editingLayer.E_vong_30C,
                E_truot_60C: editingLayer.E_truot_60C,
                E_keoUon_10_15C: editingLayer.E_keoUon_10_15C,
                Rku_MPa: editingLayer.Rku_MPa,
                phi_deg: editingLayer.phi_deg,
                C_MPa: editingLayer.C_MPa,
                note: editingLayer.ghiChu,
              }
            : {
                name: '',
                E_vong_30C: 0,
                E_truot_60C: 0,
                E_keoUon_10_15C: 0,
                Rku_MPa: 0,
                phi_deg: 0,
                C_MPa: 0,
                note: '',
              }
        }
        onConfirm={(val: MaterialRowFormValues) => {
          if (editModalIdx !== null) {
            updateCell(editModalIdx, {
              tenVatLieu: val.name,
              E_vong_30C: val.E_vong_30C,
              E_truot_60C: val.E_truot_60C,
              E_keoUon_10_15C: val.E_keoUon_10_15C,
              Rku_MPa: val.Rku_MPa,
              phi_deg: val.phi_deg,
              C_MPa: val.C_MPa,
              ghiChu: val.note,
            });
          }
          setEditModalIdx(null);
        }}
        onClose={() => setEditModalIdx(null)}
      />
    </div>
  );
}
