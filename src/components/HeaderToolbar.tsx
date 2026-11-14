import React, { useRef } from 'react';
import { useAppStore } from '../state/appStore';
import { ModuleSwitch } from '../shared/ModuleSwitch';
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
    canUndo,
    canRedo,
    undo,
    redo,
    theme,
    toggleTheme,
    setCmdOpen,
    draft,
    restoreDraft,
    discardDraft,
  } = useAppStore();

  const draftWhen = draft
    ? new Date(draft.t).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
      })
    : '';

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <header>
      <div className="brand">
        <span className="logo" aria-hidden="true">
          <BrandMark />
        </span>
        <div>
          <b>LEDAT-BIM</b>
          <small>Bản vẽ 2D · mô hình 3D · kiểm toán TCVN 11823 · LEDAT</small>
        </div>
      </div>

      <ModuleSwitch current="walls" />

      <button
        id="bCmd"
        type="button"
        className="cmdbtn"
        title="Tìm lệnh, bản vẽ, thông số (Ctrl+K)"
        aria-label="Tìm lệnh"
        onClick={() => setCmdOpen(true)}
      >
        <Icon name="search" />
        <span>Tìm lệnh, thông số…</span>
        <kbd>Ctrl K</kbd>
      </button>

      <div className="actions">
        {draft ? (
          <div className="agrp draftgrp" data-grp="draft">
            <button
              id="bRestore"
              type="button"
              title={`Phiên làm việc trước (${draftWhen}) có thay đổi chưa lưu — nhấn để khôi phục`}
              aria-label="Khôi phục phiên trước"
              onClick={restoreDraft}
            >
              <Icon name="history" />
              <span>Khôi phục phiên {draftWhen}</span>
            </button>
            <button
              id="bDraftX"
              type="button"
              className="icononly"
              title="Bỏ bản nháp của phiên trước"
              aria-label="Bỏ bản nháp"
              onClick={discardDraft}
            >
              <Icon name="close" />
            </button>
          </div>
        ) : null}
        <div className="agrp" data-grp="edit">
          <button
            id="bUndo"
            type="button"
            className="icononly"
            disabled={!canUndo}
            title="Hoàn tác (Ctrl+Z)"
            aria-label="Hoàn tác"
            onClick={undo}
          >
            <Icon name="undo" />
          </button>
          <button
            id="bRedo"
            type="button"
            className="icononly"
            disabled={!canRedo}
            title="Làm lại (Ctrl+Y)"
            aria-label="Làm lại"
            onClick={redo}
          >
            <Icon name="redo" />
          </button>
          <button
            id="bTheme"
            type="button"
            className="icononly"
            aria-pressed={theme === 'dark'}
            title={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
            aria-label="Đổi giao diện sáng / tối"
            onClick={toggleTheme}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
        </div>
        <div className="agrp" data-grp="file">
          <button id="bOpen" type="button" onClick={() => fileInputRef.current?.click()} aria-label="Mở dự án">
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
           aria-label="Lưu dự án">
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
           aria-label="Xuất DXF (cụm này)">
            <Icon name="download" />
            <span>Xuất DXF (cụm này)</span>
          </button>
          <button
            id="bPng"
            type="button"
            className="pri"
            hidden={viewMode !== '3d'}
            onClick={() => void export3dPng()}
           aria-label="Ảnh 3D (PNG)">
            <Icon name="image" />
            <span>Ảnh 3D (PNG)</span>
          </button>
          <button
            id="bDxfAll"
            type="button"
            hidden={viewMode === 'calc'}
            onClick={() => exportDxf(true)}
           aria-label="DXF tất cả cụm">
            <Icon name="layers" />
            <span>DXF tất cả cụm</span>
          </button>
          <button id="bSvg" type="button" hidden={viewMode !== '2d'} onClick={exportSvg} aria-label="SVG">
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
           aria-label="Xuất Word (.docx)">
            <Icon name="file" />
            <span>Xuất Word (.docx)</span>
          </button>
          <button
            id="bPrint"
            type="button"
            hidden={viewMode === '3d'}
            disabled={exportBusy}
            onClick={() => void printCurrent()}
           aria-label="In / PDF">
            <Icon name="printer" />
            <span>In / PDF</span>
          </button>
          <button
            id="bPdf"
            type="button"
            hidden={viewMode === '3d'}
            disabled={exportBusy}
            onClick={() => void exportPdf()}
           aria-label="Xuất PDF">
            <Icon name="file" />
            <span>Xuất PDF</span>
          </button>
          <button id="bCsv" type="button" hidden={viewMode === 'calc'} onClick={exportCsv} aria-label="Bảng thép (CSV)">
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
