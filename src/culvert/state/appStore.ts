/**
 * BangTinhCauCong Web App — React State Store & Coordinator
 *
 * Clean-room TypeScript state coordinator integrating:
 * - Engine orchestrator (`APPMODE`, `setMode`, `showTab`, `projGet`, `projSet`, `saveAll`, `loadSavedSnapshot`, `run`, `runAll`, `tqStep`, `objVis`)
 * - Project I/O (`serializeProjectJson`, `parseProjectJson`, `downloadBlob`, `collectKeepValues`, `applyKeepValues`)
 * - Exporters (`buildXlsx`, `buildPdf`, `buildExportFilename`)
 * - Dirty tracking (`isDirty` + `beforeunload` guard)
 * - Two-click default reset (`defaultArmed`) and backup/restore
 *
 * Clean-room standalone implementation with zero external CDN URLs.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  APP_MODES,
  BODY_MODE_CLASS,
  PROJDEF,
  STORAGE_KEYS,
  type AppMode,
  type DividerMode,
  type ExportScope,
  type ItemKey,
  type ObjScope,
  type ProjectMetadata,
  type TabId,
} from '../types/project.ts';
import {
  getAppMode,
  loadSavedSnapshot,
  projGet,
  projSet,
  run,
  runAll,
  saveAll,
  setMode as orchestratorSetMode,
  showTab as orchestratorShowTab,
  tqStep,
} from '../engine/orchestrator.ts';
import {
  applyKeepValues,
  buildExportFilename,
  collectKeepValues,
  downloadBlob,
  formatDateYmd,
  getModeProjectDefaults,
  parseProjectJson,
  serializeProjectJson,
} from '../export/projectIo.ts';
import { getDefaultStatusMessage } from '../components/Toolbar.tsx';

export interface AppStoreState {
  mode: AppMode;
  activeTab: TabId;
  objScope: ObjScope;
  exportScope: ExportScope;
  dividerMode: DividerMode;
  disabledItems: ItemKey[];
  isDirty: boolean;
  busyExport: boolean;
  statusMessage: string;
  klMessage: string;
  metadata: ProjectMetadata;
  values: Record<string, string>;
  defaultArmed: boolean;
  hasBackup: boolean;
}

export interface AppStoreActions {
  setMode: (mode: AppMode) => void;
  setActiveTab: (tabId: TabId) => void;
  setObjScope: (scope: ObjScope) => void;
  setExportScope: (scope: ExportScope) => void;
  setDividerMode: (mode: DividerMode) => void;
  setMetadataField: (field: keyof ProjectMetadata, value: string) => void;
  setMetadata: (meta: ProjectMetadata) => void;
  saveProject: () => void;
  openProjectFile: (file: File) => Promise<void>;
  exportExcel: () => Promise<void>;
  exportPdfReport: () => Promise<void>;
  handleDefaultReset: () => void;
  handleRestoreBackup: () => void;
  markDirty: () => void;
  markClean: () => void;
  triggerRecalc: () => void;
}

export type AppStoreContextValue = AppStoreState & AppStoreActions;

const AppStoreContext = createContext<AppStoreContextValue | null>(null);

const DEFAULT_METADATA: ProjectMetadata = {
  pj1: '',
  pj2: '',
  pj3: '',
  pj4: '',
  pj5: '',
  pj6: 'BẢNG TÍNH TOÁN KẾT CẤU CẦU',
};

const MODE_DEFAULT_TABS: Record<AppMode, TabId> = {
  cau: 7,
  ch: 15,
  ct: 18,
  tc: 41,
  tl: 61,
  tv: 54,
  tvc: 70,
};

function readStorage<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const item = localStorage.getItem(key);
    return item != null ? (item as unknown as T) : fallback;
  } catch {
    return fallback;
  }
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const initialMode = ((): AppMode => {
    const stored = readStorage<string>(STORAGE_KEYS.mode, 'cau');
    return APP_MODES.includes(stored as AppMode) ? (stored as AppMode) : 'cau';
  })();

  const [mode, setModeState] = useState<AppMode>(initialMode);
  const [activeTab, setActiveTabState] = useState<TabId>(MODE_DEFAULT_TABS[initialMode]);
  const [objScope, setObjScopeState] = useState<ObjScope>('all');
  const [exportScope, setExportScopeState] = useState<ExportScope>('all');
  const [dividerMode, setDividerModeState] = useState<DividerMode>(2);
  const [disabledItems, setDisabledItems] = useState<ItemKey[]>([]);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [busyExport, setBusyExport] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>(() => getDefaultStatusMessage(initialMode));
  const [klMessage, setKlMessage] = useState<string>('');
  const [metadata, setMetadataState] = useState<ProjectMetadata>(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const storedMeta = localStorage.getItem(STORAGE_KEYS.projByModePrefix + initialMode);
        if (storedMeta) {
          return { ...DEFAULT_METADATA, ...JSON.parse(storedMeta) };
        }
      }
    } catch {
      /* noop */
    }
    const def = getModeProjectDefaults(initialMode);
    return { ...DEFAULT_METADATA, ...def };
  });
  const [values, setValues] = useState<Record<string, string>>({});
  const [defaultArmed, setDefaultArmed] = useState<boolean>(false);
  const [hasBackup, setHasBackup] = useState<boolean>(() => {
    try {
      if (typeof localStorage === 'undefined') return false;
      return Boolean(localStorage.getItem(STORAGE_KEYS.snapshotBackup));
    } catch {
      return false;
    }
  });

  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  const defaultArmedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync body mode class
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const body = document.body;
    if (!body) return;
    for (const [m, cls] of Object.entries(BODY_MODE_CLASS)) {
      if (cls) {
        body.classList.toggle(cls, m === mode);
      }
    }
  }, [mode]);

  // Window beforeunload guard for unsaved changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const markDirty = useCallback(() => setIsDirty(true), []);
  const markClean = useCallback(() => setIsDirty(false), []);

  const triggerRecalc = useCallback(() => {
    try {
      run();
    } catch (err) {
      console.error('[appStore] recalculation error:', err);
    }
  }, []);

  const setMode = useCallback((nextMode: AppMode) => {
    setModeState(nextMode);
    orchestratorSetMode(nextMode);
    const targetTab = MODE_DEFAULT_TABS[nextMode];
    setActiveTabState(targetTab);
    orchestratorShowTab(targetTab);

    // Update metadata for new mode
    let nextMeta = { ...DEFAULT_METADATA };
    try {
      if (typeof localStorage !== 'undefined') {
        const storedMeta = localStorage.getItem(STORAGE_KEYS.projByModePrefix + nextMode);
        if (storedMeta) {
          nextMeta = { ...nextMeta, ...JSON.parse(storedMeta) };
        } else {
          nextMeta = { ...nextMeta, ...getModeProjectDefaults(nextMode) };
        }
      }
    } catch {
      nextMeta = { ...nextMeta, ...getModeProjectDefaults(nextMode) };
    }
    setMetadataState(nextMeta);
    projSet(nextMeta);

    setStatusMessage(getDefaultStatusMessage(nextMode));
    markDirty();
  }, [markDirty]);

  const setActiveTab = useCallback((tabId: TabId) => {
    setActiveTabState(tabId);
    orchestratorShowTab(tabId);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.tabByModePrefix + getAppMode(), String(tabId));
      }
    } catch {
      /* noop */
    }
  }, []);

  const setObjScope = useCallback((scope: ObjScope) => {
    setObjScopeState(scope);
    markDirty();
  }, [markDirty]);

  const setExportScope = useCallback((scope: ExportScope) => {
    setExportScopeState(scope);
  }, []);

  const setDividerMode = useCallback((dm: DividerMode) => {
    setDividerModeState(dm);
    markDirty();
  }, [markDirty]);

  const setMetadataField = useCallback((field: keyof ProjectMetadata, value: string) => {
    setMetadataState((prev) => {
      const next = { ...prev, [field]: value };
      projSet(next);
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEYS.projByModePrefix + getAppMode(), JSON.stringify(next));
        }
      } catch {
        /* noop */
      }
      return next;
    });
    markDirty();
  }, [markDirty]);

  const setMetadata = useCallback((meta: ProjectMetadata) => {
    setMetadataState(meta);
    projSet(meta);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.projByModePrefix + getAppMode(), JSON.stringify(meta));
      }
    } catch {
      /* noop */
    }
    markDirty();
  }, [markDirty]);

  const saveProject = useCallback(() => {
    try {
      saveAll();
      const currentValues = collectKeepValues();
      const currentMeta = projGet();
      const rawJson = serializeProjectJson({
        mode,
        values: currentValues,
        metadata: currentMeta,
      });

      const dateStr = formatDateYmd();
      const modeName =
        mode === 'tl'
          ? 'tuong chan L'
          : mode === 'tvc'
            ? 'thuy van cong'
            : mode === 'tv'
              ? 'thuy van cau'
              : mode === 'tc'
                ? 'tuong chan'
                : mode === 'ct'
                  ? 'cong tron'
                  : mode === 'ch'
                    ? 'cong hop'
                    : 'cau';
      const filename = `So lieu ${modeName} ${dateStr}.json`;
      const blob = new Blob([rawJson], { type: 'application/json' });
      downloadBlob(filename, blob, 'application/json');

      setIsDirty(false);
      setStatusMessage(`Đã lưu ${filename}.`);
    } catch (err) {
      console.error('[appStore] save error:', err);
      setStatusMessage('Lỗi khi lưu file số liệu.');
    }
  }, [mode]);

  const openProjectFile = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const snapshot = parseProjectJson(text);

      applyKeepValues(snapshot.values);
      saveAll();

      if (snapshot.metadata) {
        const mergedMeta = { ...DEFAULT_METADATA, ...snapshot.metadata };
        setMetadataState(mergedMeta);
        projSet(mergedMeta);
      }

      const nextMode = snapshot._mode;
      if (APP_MODES.includes(nextMode)) {
        setModeState(nextMode);
        orchestratorSetMode(nextMode);
      }

      setValues(snapshot.values);
      setIsDirty(false);
      setStatusMessage(`Đã nạp số liệu từ ${file.name}.`);

      try {
        runAll(nextMode);
      } catch (err) {
        console.error('[appStore] recalc after open error:', err);
      }
    } catch (err) {
      console.error('[appStore] open error:', err);
      setStatusMessage('File không đúng định dạng bảng tính TCVN 11823:2017.');
    }
  }, []);

  const exportExcel = useCallback(async () => {
    try {
      setBusyExport(true);
      setStatusMessage('Đang kết xuất Excel (.xlsx)...');
      // exceljs (~1 MB) chỉ nạp khi thật sự xuất Excel
      const { buildXlsx } = await import('../export/excelExport.ts');
      const bytes = await buildXlsx({
        scope: exportScope,
        activeTabId: activeTab,
      });
      const filename = buildExportFilename({
        mode,
        ext: 'xlsx',
        scope: exportScope,
      });
      downloadBlob(filename, bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      setStatusMessage(`Đã xuất ${filename}.`);
    } catch (err) {
      console.error('[appStore] export Excel error:', err);
      setStatusMessage('Lỗi xuất file Excel: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusyExport(false);
    }
  }, [activeTab, exportScope, mode]);

  const exportPdfReport = useCallback(async () => {
    try {
      setBusyExport(true);
      setStatusMessage('Đang kết xuất PDF...');
      // jspdf + exceljs chỉ nạp khi thật sự xuất PDF
      const { buildPdf } = await import('../export/pdfExport.ts');
      const blob = await buildPdf({
        scope: exportScope,
        activeTabId: activeTab,
      });
      const filename = buildExportFilename({
        mode,
        ext: 'pdf',
        scope: exportScope,
      });
      downloadBlob(filename, blob, 'application/pdf');
      setStatusMessage(`Đã xuất ${filename}.`);
    } catch (err) {
      console.error('[appStore] export PDF error:', err);
      setStatusMessage('Lỗi xuất PDF: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusyExport(false);
    }
  }, [activeTab, exportScope, mode]);

  const handleDefaultReset = useCallback(() => {
    if (!defaultArmed) {
      setDefaultArmed(true);
      if (defaultArmedTimer.current) clearTimeout(defaultArmedTimer.current);
      defaultArmedTimer.current = setTimeout(() => {
        setDefaultArmed(false);
      }, 5000);
      return;
    }

    if (defaultArmedTimer.current) clearTimeout(defaultArmedTimer.current);
    setDefaultArmed(false);

    try {
      if (typeof localStorage !== 'undefined') {
        const cur = localStorage.getItem(STORAGE_KEYS.snapshot);
        if (cur) {
          localStorage.setItem(STORAGE_KEYS.snapshotBackup, cur);
          setHasBackup(true);
        }
        localStorage.removeItem(STORAGE_KEYS.snapshot);
        localStorage.setItem(STORAGE_KEYS.mode, 'cau');
      }
    } catch {
      /* noop */
    }

    setModeState('cau');
    orchestratorSetMode('cau');
    setActiveTabState(7);
    orchestratorShowTab(7);

    const defMeta = { ...DEFAULT_METADATA };
    setMetadataState(defMeta);
    projSet(defMeta);

    setIsDirty(false);
    setKlMessage('Đã nạp số liệu mặc định; số liệu cũ trên máy được giữ ở nút Khôi phục.');
    setStatusMessage(getDefaultStatusMessage('cau'));

    try {
      run();
      tqStep();
    } catch (err) {
      console.error('[appStore] default reset recalc error:', err);
    }
  }, [defaultArmed]);

  const handleRestoreBackup = useCallback(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const backup = localStorage.getItem(STORAGE_KEYS.snapshotBackup);
        if (backup) {
          localStorage.setItem(STORAGE_KEYS.snapshot, backup);
          localStorage.removeItem(STORAGE_KEYS.snapshotBackup);
          loadSavedSnapshot(backup);
          setHasBackup(false);
          setIsDirty(false);
          setKlMessage('Đã khôi phục số liệu trước đó.');
          try {
            run();
            tqStep();
          } catch (err) {
            console.error('[appStore] restore recalc error:', err);
          }
        }
      }
    } catch (err) {
      console.error('[appStore] restore backup error:', err);
    }
  }, []);

  const contextValue: AppStoreContextValue = {
    mode,
    activeTab,
    objScope,
    exportScope,
    dividerMode,
    disabledItems,
    isDirty,
    busyExport,
    statusMessage,
    klMessage,
    metadata,
    values,
    defaultArmed,
    hasBackup,
    setMode,
    setActiveTab,
    setObjScope,
    setExportScope,
    setDividerMode,
    setMetadataField,
    setMetadata,
    saveProject,
    openProjectFile,
    exportExcel,
    exportPdfReport,
    handleDefaultReset,
    handleRestoreBackup,
    markDirty,
    markClean,
    triggerRecalc,
  };

  return React.createElement(AppStoreContext.Provider, { value: contextValue }, children);
}

export function useAppStore(): AppStoreContextValue {
  const ctx = useContext(AppStoreContext);
  if (!ctx) {
    throw new Error('useAppStore must be used within an AppStoreProvider');
  }
  return ctx;
}
