import React, { useState } from 'react';
import { UI_ICONS } from '../assets/iconRegistry';
import type { MaterialRecord } from '../types/project';
import { MaterialRowModal, type MaterialRowFormValues } from './Dialogs';

export interface TabMaterialDbProps {
  materials: MaterialRecord[];
  onChange: (next: MaterialRecord[]) => void;
  onLoadFile: () => void;
  onSaveFile: () => void;
  onResetDefault: () => void;
}

function reindex(rows: MaterialRecord[]): MaterialRecord[] {
  let currentGroup = '';
  return rows.map((r, i) => {
    const isGroupHeader = r.name.trim().startsWith('(*)');
    if (isGroupHeader) {
      currentGroup = r.name.replace(/^\(\*\)\s*/, '').trim();
    }
    return {
      ...r,
      index: i,
      isGroupHeader,
      group: currentGroup || r.group,
    };
  });
}

export function TabMaterialDb({
  materials,
  onChange,
  onLoadFile,
  onSaveFile,
  onResetDefault,
}: TabMaterialDbProps): React.ReactElement {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);

  const insertRowAfter = (idx: number) => {
    const blank: MaterialRecord = {
      index: idx + 1,
      isGroupHeader: false,
      group: materials[idx]?.group ?? '',
      name: 'Vật liệu mới',
      E_vong_30C: 0,
      E_truot_60C: 0,
      E_keoUon_10_15C: 0,
      Rku_MPa: 0,
      C_MPa: 0,
      phi_deg: 0,
      note: '',
    };
    const next = [...materials];
    next.splice(Math.min(next.length, idx + 1), 0, blank);
    onChange(reindex(next));
    setSelectedIdx(Math.min(next.length - 1, idx + 1));
  };

  const deleteRowAt = (idx: number) => {
    if (materials.length === 0 || idx < 0 || idx >= materials.length) return;
    const next = reindex(materials.filter((_, i) => i !== idx));
    onChange(next);
    setSelectedIdx(Math.max(0, Math.min(idx, next.length - 1)));
  };

  const updateRow = (idx: number, patch: Partial<MaterialRecord>) => {
    const next = materials.map((m, i) => (i === idx ? { ...m, ...patch } : m));
    onChange(reindex(next));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Insert') {
      e.preventDefault();
      insertRowAfter(selectedIdx);
    } else if (e.key === 'Delete' && (e.target as HTMLElement).tagName !== 'INPUT') {
      e.preventDefault();
      deleteRowAt(selectedIdx);
    } else if (e.key === 'F2') {
      e.preventDefault();
      if (materials[selectedIdx]) setModalMode('edit');
    }
  };

  const selectedRow = materials[selectedIdx];

  return (
    <div
      className="adm-kcad-wrap"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      data-testid="tab-sua-vat-lieu"
    >
      {/* Toolbar */}
      <div className="adm-kcad-toolbar">
        <button type="button" className="adm-btn" onClick={() => setModalMode('add')}>
          Thêm mẫu vật liệu (Ins)
        </button>
        <button
          type="button"
          className="adm-btn"
          disabled={!selectedRow}
          onClick={() => setModalMode('edit')}
        >
          Sửa dòng chọn (F2)
        </button>
        <button
          type="button"
          className="adm-btn"
          disabled={materials.length === 0}
          onClick={() => deleteRowAt(selectedIdx)}
        >
          <img src={UI_ICONS.xoaLopSmall} alt="" />
          <span>Xóa hàng (Del)</span>
        </button>
        <button type="button" className="adm-btn" onClick={onLoadFile}>
          <img src={UI_ICONS.openSmall} alt="" />
          <span>Load từ VatLieu.dat</span>
        </button>
        <button type="button" className="adm-btn adm-btn-primary" onClick={onSaveFile}>
          <img src={UI_ICONS.saveSmall} alt="" />
          <span>Lưu VatLieu.dat</span>
        </button>
        <button type="button" className="adm-btn" style={{ marginLeft: 'auto' }} onClick={onResetDefault}>
          <img src={UI_ICONS.resetSmall} alt="" />
          <span>Mặc định</span>
        </button>
      </div>

      {/* 9-column table */}
      <div className="adm-grid-wrap" style={{ flex: 1, minHeight: 180 }}>
        <table className="adm-table" data-testid="table-edit-vat-lieu">
          <thead>
            <tr>
              <th style={{ width: 45 }}>STT</th>
              <th style={{ width: 245 }}>Vật liệu</th>
              <th style={{ width: 72 }}>E tính võng (30°C)</th>
              <th style={{ width: 72 }}>E tính trượt (60°C)</th>
              <th style={{ width: 78 }}>E tính kéo uốn (10-15°C)</th>
              <th style={{ width: 64 }}>Rku (MPa)</th>
              <th style={{ width: 62 }}>C (MPa)</th>
              <th style={{ width: 56 }}>φ (độ)</th>
              <th style={{ width: 140 }}>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {materials.map((m, idx) => (
              <tr
                key={`${idx}-${m.index}`}
                className={`${m.isGroupHeader ? 'group-row' : ''} ${
                  selectedIdx === idx ? 'selected' : ''
                }`}
                onClick={() => setSelectedIdx(idx)}
                onDoubleClick={() => setModalMode('edit')}
              >
                <td className="center">{idx + 1}</td>
                <td>
                  <input
                    type="text"
                    value={m.name}
                    onChange={(e) => updateRow(idx, { name: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="any"
                    className="num"
                    disabled={m.isGroupHeader}
                    value={m.isGroupHeader ? '' : m.E_vong_30C}
                    onChange={(e) =>
                      updateRow(idx, { E_vong_30C: parseFloat(e.target.value) || 0 })
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="any"
                    className="num"
                    disabled={m.isGroupHeader}
                    value={m.isGroupHeader ? '' : m.E_truot_60C}
                    onChange={(e) =>
                      updateRow(idx, { E_truot_60C: parseFloat(e.target.value) || 0 })
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="any"
                    className="num"
                    disabled={m.isGroupHeader}
                    value={m.isGroupHeader ? '' : m.E_keoUon_10_15C}
                    onChange={(e) =>
                      updateRow(idx, { E_keoUon_10_15C: parseFloat(e.target.value) || 0 })
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="any"
                    className="num"
                    disabled={m.isGroupHeader}
                    value={m.isGroupHeader ? '' : m.Rku_MPa}
                    onChange={(e) =>
                      updateRow(idx, { Rku_MPa: parseFloat(e.target.value) || 0 })
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="any"
                    className="num"
                    disabled={m.isGroupHeader}
                    value={m.isGroupHeader ? '' : m.C_MPa}
                    onChange={(e) =>
                      updateRow(idx, { C_MPa: parseFloat(e.target.value) || 0 })
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="any"
                    className="num"
                    disabled={m.isGroupHeader}
                    value={m.isGroupHeader ? '' : m.phi_deg}
                    onChange={(e) =>
                      updateRow(idx, { phi_deg: parseFloat(e.target.value) || 0 })
                    }
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={m.note}
                    onChange={(e) => updateRow(idx, { note: e.target.value })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Helper memo */}
      <div className="adm-memo-box">
        <div>[Ins]: Chèn thêm hàng &nbsp;|&nbsp; [Del]: Xóa hàng &nbsp;|&nbsp; [Enter] hoặc [F2]: Sửa nội dung ô đang chọn</div>
        <div>
          * Tip: Nếu muốn tạo mục phân cách giữa các nhóm vật liệu (ví dụ: &quot;Vật liệu dùng nhựa đặc có độ kim lún ≤ 90, thiết kế tầng mặt chỉ có 1 lớp BTN dày ≤ 7cm.&quot;) thì tại cột &quot;Vật liệu&quot; gõ <code>(*)Vật liệu dùng nhựa đặc...</code>
        </div>
      </div>

      <MaterialRowModal
        open={modalMode !== null}
        title={modalMode === 'add' ? 'Thêm mẫu Vật liệu' : 'Sửa vật liệu mẫu'}
        initialValue={
          modalMode === 'edit' && selectedRow
            ? {
                name: selectedRow.name,
                E_vong_30C: selectedRow.E_vong_30C,
                E_truot_60C: selectedRow.E_truot_60C,
                E_keoUon_10_15C: selectedRow.E_keoUon_10_15C,
                Rku_MPa: selectedRow.Rku_MPa,
                phi_deg: selectedRow.phi_deg,
                C_MPa: selectedRow.C_MPa,
                note: selectedRow.note,
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
          if (modalMode === 'add') {
            const newRec: MaterialRecord = {
              index: selectedIdx + 1,
              isGroupHeader: val.name.trim().startsWith('(*)'),
              group: selectedRow?.group ?? '',
              name: val.name,
              E_vong_30C: val.E_vong_30C,
              E_truot_60C: val.E_truot_60C,
              E_keoUon_10_15C: val.E_keoUon_10_15C,
              Rku_MPa: val.Rku_MPa,
              C_MPa: val.C_MPa,
              phi_deg: val.phi_deg,
              note: val.note,
            };
            const next = [...materials];
            next.splice(Math.min(next.length, selectedIdx + 1), 0, newRec);
            onChange(reindex(next));
          } else if (modalMode === 'edit' && selectedRow) {
            updateRow(selectedIdx, {
              name: val.name,
              E_vong_30C: val.E_vong_30C,
              E_truot_60C: val.E_truot_60C,
              E_keoUon_10_15C: val.E_keoUon_10_15C,
              Rku_MPa: val.Rku_MPa,
              phi_deg: val.phi_deg,
              C_MPa: val.C_MPa,
              note: val.note,
            });
          }
          setModalMode(null);
        }}
        onClose={() => setModalMode(null)}
      />
    </div>
  );
}
