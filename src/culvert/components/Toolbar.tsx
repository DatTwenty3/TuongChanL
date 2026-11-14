import { useRef, type ChangeEvent } from 'react';
import {
  APP_MODES,
  APPMODE_LABELS,
  type AppMode,
  type ExportScope,
} from '../types/project';

export interface ToolbarProps {
  mode: AppMode;
  exportScope: ExportScope;
  isDirty: boolean;
  busyExport: boolean;
  klMessage: string;
  statusMessage: string;
  defaultArmed?: boolean;
  hasBackup?: boolean;
  onModeChange: (mode: AppMode) => void;
  onExportScopeChange: (scope: ExportScope) => void;
  onExportXlsx: () => void;
  onExportPdf: () => void;
  onSaveJson: () => void;
  onOpenFile: (file: File) => void;
  onDefaultReset: () => void;
  onRestoreBackup: () => void;
}

export function getDefaultStatusMessage(mode: AppMode): string {
  switch (mode) {
    case 'ct':
      return 'Xuất file Excel hoặc PDF riêng cho cống tròn: số liệu, tải trọng và nội lực; cốt thép và kiểm toán. Không kèm các phần của cầu.';
    case 'ch':
      return 'Xuất file Excel hoặc PDF riêng cho cống hộp: số liệu, tải trọng và nội lực; kiểm toán mặt cắt; kiểm toán nền móng; phụ lục hệ số nền. Không kèm các phần của cầu.';
    case 'tc':
      return 'Xuất file Excel hoặc PDF riêng cho tường chắn: số liệu, tải trọng; kiểm toán.';
    case 'tl':
      return 'Xuất file Excel hoặc PDF riêng cho tường chắn chữ L: số liệu, tải trọng; kiểm toán.';
    case 'tv':
      return 'Xuất file Excel hoặc PDF riêng cho thủy văn, thủy lực cầu.';
    case 'tvc':
      return 'Xuất file Excel hoặc PDF riêng cho thủy văn, thủy lực cống.';
    case 'cau':
    default:
      return 'Xuất file Excel hoặc PDF gồm các phần theo thứ tự bảng tính: tổng quan, kiểm toán dầm giữa, dầm biên, bản mặt cầu, gối cầu, bản liên tục nhiệt (nếu có), khe co giãn, gờ lan can, tải trọng và tổ hợp mố, kiểm toán mặt cắt mố, nội lực đầu cọc, kiểm toán bệ cọc, sức chịu tải cọc, kiểm toán cọc theo vật liệu.';
  }
}

export function Toolbar({
  mode,
  exportScope,
  isDirty,
  busyExport,
  klMessage,
  statusMessage,
  defaultArmed = false,
  hasBackup = false,
  onModeChange,
  onExportScopeChange,
  onExportXlsx,
  onExportPdf,
  onSaveJson,
  onOpenFile,
  onDefaultReset,
  onRestoreBackup,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleModeChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onModeChange(e.target.value as AppMode);
  };

  const handleScopeChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onExportScopeChange(e.target.value === 'one' ? 'one' : 'all');
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onOpenFile(file);
    }
    e.target.value = '';
  };

  return (
    <div className="tool">
      <label className="modesel">
        {'Loại bảng tính '}
        <select id="appMode" value={mode} onChange={handleModeChange}>
          {APP_MODES.map((m) => (
            <option key={m} value={m}>
              {APPMODE_LABELS[m]}
            </option>
          ))}
        </select>
      </label>

      <label className="modesel" title="Chọn xuất toàn bộ bảng tính hay chỉ tab đang mở">
        {'Phạm vi xuất '}
        <select id="expScope" value={exportScope} onChange={handleScopeChange}>
          <option value="all">Toàn bộ bảng tính</option>
          <option value="one">Chỉ tab đang mở</option>
        </select>
      </label>

      <button id="btnX" type="button" disabled={busyExport} onClick={onExportXlsx}>
        Xuất Excel (.xlsx)
      </button>
      <button id="btnP" type="button" disabled={busyExport} onClick={onExportPdf}>
        Xuất PDF
      </button>
      <button
        id="btnSv"
        type="button"
        data-dirty={isDirty ? 'true' : undefined}
        onClick={onSaveJson}
      >
        Lưu số liệu (.json)
      </button>
      <button id="btnOp" type="button" onClick={() => fileInputRef.current?.click()}>
        Mở số liệu (.json)
      </button>
      <button
        id="btnDf"
        type="button"
        title="Xoá số liệu đang lưu trên máy này và nạp lại số liệu mặc định (số liệu mẫu)"
        onClick={onDefaultReset}
      >
        {defaultArmed ? 'Bấm lần nữa để nạp số liệu mặc định' : 'Số liệu mặc định'}
      </button>
      <button
        id="btnBk"
        type="button"
        hidden={!hasBackup}
        title="Nạp lại số liệu đã lưu trên máy trước khi chuyển sang số liệu mặc định"
        onClick={onRestoreBackup}
      >
        Khôi phục số liệu trước
      </button>
      <span id="klMsg" className="small">
        {klMessage}
      </span>
      <input
        ref={fileInputRef}
        type="file"
        id="fOp"
        accept=".json,application/json"
        hidden
        onChange={handleFileChange}
      />
      <span id="xmsg">{statusMessage}</span>
    </div>
  );
}
