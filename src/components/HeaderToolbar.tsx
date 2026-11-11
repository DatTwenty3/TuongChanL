import React, { useRef } from 'react';
import { useAppStore } from '../state/appStore';

export const HeaderToolbar: React.FC = () => {
  const {
    viewMode,
    isDirty,
    exportBusy,
    openProjectFile,
    saveProject,
    exportDxf,
    exportSvg,
    exportCsv,
    exportPdf,
    exportDocx,
    export3dPng,
    printCurrent,
  } = useAppStore();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <header>
      <div className="brand">
        <span className="logo">L</span>
        <div>
          <b>Tường chắn chữ L</b>
          <small>Bố trí chung &amp; cốt thép · bản vẽ 2D + mô hình 3D · LEDAT</small>
        </div>
      </div>

      <div className="actions">
        <button id="bOpen" type="button" onClick={() => fileInputRef.current?.click()}>
          Mở dự án
        </button>
        <button
          id="bSave"
          type="button"
          data-dirty={isDirty ? '1' : undefined}
          style={isDirty ? { borderColor: '#f5b041' } : undefined}
          title={
            isDirty
              ? 'Có thay đổi chưa lưu — nhấn để lưu dự án (.tcl.json)'
              : 'Lưu dự án (.tcl.json)'
          }
          onClick={saveProject}
        >
          Lưu dự án
        </button>
        <span className="sep" />

        <button
          id="bDxf"
          type="button"
          className="pri"
          hidden={viewMode !== '2d'}
          onClick={() => exportDxf(false)}
        >
          Xuất DXF (cụm này)
        </button>
        <button
          id="bPng"
          type="button"
          className="pri"
          hidden={viewMode !== '3d'}
          onClick={() => void export3dPng()}
        >
          Ảnh 3D (PNG)
        </button>
        <button
          id="bDxfAll"
          type="button"
          hidden={viewMode === 'calc'}
          onClick={() => exportDxf(true)}
        >
          DXF tất cả cụm
        </button>
        <button id="bSvg" type="button" hidden={viewMode !== '2d'} onClick={exportSvg}>
          SVG
        </button>
        <button
          id="bPrint"
          type="button"
          hidden={viewMode === '3d'}
          disabled={exportBusy}
          onClick={() => void printCurrent()}
        >
          In / PDF
        </button>
        <button
          id="bPdf"
          type="button"
          hidden={viewMode === '3d'}
          disabled={exportBusy}
          onClick={() => void exportPdf()}
        >
          Xuất PDF
        </button>
        <button
          id="bDocx"
          type="button"
          className="pri"
          hidden={viewMode !== 'calc'}
          disabled={exportBusy}
          onClick={() => void exportDocx()}
        >
          Xuất Word (.docx)
        </button>
        <button id="bCsv" type="button" hidden={viewMode === 'calc'} onClick={exportCsv}>
          Bảng thép (CSV)
        </button>

        <input
          ref={fileInputRef}
          type="file"
          id="fOpen"
          accept=".json,.tcl.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              void openProjectFile(file);
            }
            e.target.value = '';
          }}
        />
      </div>
    </header>
  );
};
