import React, { useRef } from 'react';
import { useAppStore } from '../state/appStore';
import { BrandMark, Icon } from './Icon';

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
        <span className="logo" aria-hidden="true">
          <BrandMark />
        </span>
        <div>
          <b>Tường chắn BTCT</b>
          <small>Bản vẽ 2D · mô hình 3D · kiểm toán TCVN 11823 · LEDAT</small>
        </div>
      </div>

      <div className="actions">
        <div className="agrp" data-grp="file">
          <button id="bOpen" type="button" onClick={() => fileInputRef.current?.click()}>
            <Icon name="open" />
            <span>Mở dự án</span>
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
            <Icon name="save" />
            <span>Lưu dự án</span>
          </button>
        </div>
        <div className="agrp" data-grp="drawing">
          <button
            id="bDxf"
            type="button"
            className="pri"
            hidden={viewMode !== '2d'}
            onClick={() => exportDxf(false)}
          >
            <Icon name="download" />
            <span>Xuất DXF (cụm này)</span>
          </button>
          <button
            id="bPng"
            type="button"
            className="pri"
            hidden={viewMode !== '3d'}
            onClick={() => void export3dPng()}
          >
            <Icon name="image" />
            <span>Ảnh 3D (PNG)</span>
          </button>
          <button
            id="bDxfAll"
            type="button"
            hidden={viewMode === 'calc'}
            onClick={() => exportDxf(true)}
          >
            <Icon name="layers" />
            <span>DXF tất cả cụm</span>
          </button>
          <button id="bSvg" type="button" hidden={viewMode !== '2d'} onClick={exportSvg}>
            <Icon name="code" />
            <span>SVG</span>
          </button>
        </div>
        <div className="agrp" data-grp="report">
          <button
            id="bDocx"
            type="button"
            className="pri"
            hidden={viewMode !== 'calc'}
            disabled={exportBusy}
            onClick={() => void exportDocx()}
          >
            <Icon name="file" />
            <span>Xuất Word (.docx)</span>
          </button>
          <button
            id="bPrint"
            type="button"
            hidden={viewMode === '3d'}
            disabled={exportBusy}
            onClick={() => void printCurrent()}
          >
            <Icon name="printer" />
            <span>In / PDF</span>
          </button>
          <button
            id="bPdf"
            type="button"
            hidden={viewMode === '3d'}
            disabled={exportBusy}
            onClick={() => void exportPdf()}
          >
            <Icon name="file" />
            <span>Xuất PDF</span>
          </button>
          <button id="bCsv" type="button" hidden={viewMode === 'calc'} onClick={exportCsv}>
            <Icon name="table" />
            <span>Bảng thép (CSV)</span>
          </button>
        </div>

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
