import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  createBlankProject,
  SAMPLE_TCCS38_CH10,
  SAMPLE_TCCS38_CH10_MILL,
  SAMPLE_TCCS38_EX1,
} from '../data/sampleVd';
import { DEFAULT_MATERIALS } from '../data/vatlieu';
import {
  computeDesignModulus,
  computeTrafficSummary,
  createDefaultRehabilitationConfig,
  lookupToanDo,
  parseAdmProject,
  parseProjectJson,
  parseVatLieuDat,
  resolveRehabilitationEchCu,
  resolveSubgrade,
  runFullVerification,
  serializeAdmProject,
  serializeVatLieuDat,
} from '../engine';
import { downloadVerificationExcel } from '../export';
import type {
  DesignParams,
  ExistingPavementLayer,
  FullVerificationResult,
  MaterialRecord,
  PavementAlternative,
  PavementLayer,
  ProjectState,
  RehabilitationConfig,
  SurfaceGrade,
  ToanDoId,
  ToanDoInputStrings,
  ToanDoLookupResult,
  TrafficSummary,
} from '../types/project';
import type { MainTabKey, RibbonTabKey } from './navigation';

export type { ToanDoInputStrings };

const VATLIEU_STORAGE_KEY = 'toando-web:vatlieu:v1';

function loadInitialMaterials(): MaterialRecord[] {
  try {
    const raw = window.localStorage.getItem(VATLIEU_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MaterialRecord[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_MATERIALS;
}

function triggerDownloadBytes(bytes: Uint8Array, fileName: string, mime = 'application/octet-stream') {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const DEFAULT_TOANDO_INPUTS: Record<ToanDoId, ToanDoInputStrings> = {
  '3-1': { x: '1.50', yOrCurve: '0.15', ray: '' },
  '3-2': { x: '1.20', yOrCurve: '8.0', ray: '24' },
  '3-3': { x: '2.50', yOrCurve: '10.0', ray: '20' },
  '3-4': { x: '63', yOrCurve: '24', ray: '' },
  '3-5': { x: '0.35', yOrCurve: '6.0', ray: '' },
  '3-6': { x: '0.80', yOrCurve: '3.0', ray: '8.0' },
};

function ensureRehabState(proj: ProjectState): ProjectState {
  if (proj.projectInfo.loaiTK === 'CAI_TAO' && !proj.rehabilitation) {
    return {
      ...proj,
      rehabilitation: createDefaultRehabilitationConfig(),
    };
  }
  return proj;
}

export interface AppStoreValue {
  project: ProjectState;
  syncedProject: ProjectState;
  traffic: TrafficSummary;
  designParams: DesignParams;
  echCu_MPa: number | null;
  activeAlternative: PavementAlternative;
  materials: MaterialRecord[];
  verification: FullVerificationResult | null;
  fileName: string | null;
  dirty: boolean;
  activeRibbonTab: RibbonTabKey;
  activePageTab: MainTabKey;
  selectedShearTargetId: string | null;
  selectedFlexuralLayerId: string | null;
  statusMessage: string;
  progress: number;
  isRunning: boolean;
  toanDoInputs: Record<ToanDoId, ToanDoInputStrings>;
  toanDoResults: Record<ToanDoId, ToanDoLookupResult>;
  setActiveRibbonTab: (tab: RibbonTabKey) => void;
  setActivePageTab: (tab: MainTabKey) => void;
  setSelectedShearTargetId: (id: string | null) => void;
  setSelectedFlexuralLayerId: (id: string | null) => void;
  setStatusMessage: (msg: string) => void;
  updateProject: (updater: (prev: ProjectState) => ProjectState, invalidateVerification?: boolean) => void;
  updateRehabilitation: (updater: (prev: RehabilitationConfig) => RehabilitationConfig) => void;
  updateExistingLayers: (layers: ExistingPavementLayer[]) => void;
  toggleLayerBuVenh: (altId: string, layerId: string, isBuVenh: boolean) => void;
  setActiveAlternativeId: (altId: string) => void;
  commitAlternativeLayers: (altId: string, layers: PavementLayer[]) => void;
  addAlternative: (name: string) => void;
  renameAlternative: (altId: string, name: string) => void;
  deleteActiveAlternative: () => void;
  newProject: () => void;
  closeProject: () => void;
  loadSampleProject: () => void;
  loadSampleRehabProject: (variant?: 'overlay' | 'mill') => void;
  openProjectFromFile: (file: File) => Promise<void>;
  saveProject: (forcePromptName?: boolean) => void;
  runVerification: () => void;
  exportExcelForAlternatives: (selectedIds: string[]) => Promise<void>;
  setMaterials: (next: MaterialRecord[]) => void;
  resetMaterialsDefault: () => void;
  loadVatLieuFromFile: (file: File) => Promise<void>;
  saveVatLieuFile: () => void;
  setToanDoInput: (id: ToanDoId, next: ToanDoInputStrings) => void;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

export function AppStoreProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [project, setProject] = useState<ProjectState>(() => createBlankProject());
  const [materials, setMaterialsState] = useState<MaterialRecord[]>(loadInitialMaterials);
  const [verification, setVerification] = useState<FullVerificationResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [activeRibbonTab, setActiveRibbonTab] = useState<RibbonTabKey>('HOME');
  const [activePageTab, setActivePageTab] = useState<MainTabKey>('thong-tin');
  const [selectedShearTargetId, setSelectedShearTargetId] = useState<string | null>(null);
  const [selectedFlexuralLayerId, setSelectedFlexuralLayerId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('Sẵn sàng — Áo đường mềm (TCCS 38:2022/TCĐBVN)');
  const [progress, setProgress] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [toanDoInputs, setToanDoInputs] =
    useState<Record<ToanDoId, ToanDoInputStrings>>(DEFAULT_TOANDO_INPUTS);

  const traffic = useMemo(
    () =>
      computeTrafficSummary(
        project.vehicles,
        project.forecast,
        project.roadScale,
        project.storedNtk,
      ),
    [project.vehicles, project.forecast, project.roadScale, project.storedNtk],
  );

  const designParams = useMemo<DesignParams>(() => {
    const mod = computeDesignModulus(
      traffic.Ntt_trucLanNgDem,
      project.roadScale,
      project.forecast,
      project.designParams.loaiTangMat,
      project.projectInfo.doiTuongTK,
    );
    return {
      loaiTangMat: project.designParams.loaiTangMat,
      Eyc_MPa: mod.Eyc_MPa,
      Emin_MPa: mod.Emin_MPa,
      Ett_MPa: mod.Ett_MPa,
    };
  }, [
    traffic.Ntt_trucLanNgDem,
    project.roadScale,
    project.forecast,
    project.designParams.loaiTangMat,
    project.projectInfo.doiTuongTK,
  ]);

  const syncedProject = useMemo<ProjectState>(
    () => ({
      ...project,
      designParams,
    }),
    [project, designParams],
  );

  const echCu_MPa = useMemo<number | null>(() => {
    if (project.projectInfo.loaiTK !== 'CAI_TAO' || !project.rehabilitation) return null;
    if (project.rehabilitation.strategy === 'FULL_REBUILD') return null;
    const sub = resolveSubgrade(project.subgrade);
    return resolveRehabilitationEchCu(
      project.rehabilitation,
      sub.E0_MPa,
      project.forecast.duongKinhVetBanh_D_cm,
      project.roadScale.doTinCayTK,
    ).echCu_MPa;
  }, [
    project.projectInfo.loaiTK,
    project.rehabilitation,
    project.subgrade,
    project.forecast.duongKinhVetBanh_D_cm,
    project.roadScale.doTinCayTK,
  ]);

  const activeAlternative = useMemo(() => {
    return (
      project.alternatives.find((a) => a.id === project.activeAlternativeId) ??
      project.alternatives[0]
    );
  }, [project.alternatives, project.activeAlternativeId]);

  const toanDoResults = useMemo(() => {
    const ids: ToanDoId[] = ['3-1', '3-2', '3-3', '3-4', '3-5', '3-6'];
    const out = {} as Record<ToanDoId, ToanDoLookupResult>;
    for (const id of ids) {
      const raw = toanDoInputs[id];
      const x = parseFloat(raw.x);
      const yOrCurve = parseFloat(raw.yOrCurve);
      const ray = raw.ray.trim() === '' ? undefined : parseFloat(raw.ray);
      out[id] = lookupToanDo({ id, x, yOrCurve, ray });
    }
    return out;
  }, [toanDoInputs]);

  const updateProject = useCallback(
    (updater: (prev: ProjectState) => ProjectState, invalidateVerification = true) => {
      let switchedToTkMoi = false;
      setProject((prev) => {
        const next = ensureRehabState(updater(prev));
        if (next.projectInfo.loaiTK !== 'CAI_TAO') {
          switchedToTkMoi = true;
        }
        return next;
      });
      if (switchedToTkMoi) {
        setActivePageTab((cur) => (cur === 'ao-duong-cu' ? 'thong-tin' : cur));
      }
      setDirty(true);
      if (invalidateVerification) {
        setVerification(null);
      }
    },
    [],
  );

  const updateRehabilitation = useCallback(
    (updater: (prev: RehabilitationConfig) => RehabilitationConfig) => {
      setProject((prev) => {
        const currentRehab = prev.rehabilitation ?? createDefaultRehabilitationConfig();
        return {
          ...prev,
          rehabilitation: updater(currentRehab),
        };
      });
      setDirty(true);
      setVerification(null);
    },
    [],
  );

  const updateExistingLayers = useCallback((layers: ExistingPavementLayer[]) => {
    setProject((prev) => {
      const currentRehab = prev.rehabilitation ?? createDefaultRehabilitationConfig();
      return {
        ...prev,
        rehabilitation: {
          ...currentRehab,
          existingLayers: layers,
        },
      };
    });
    setDirty(true);
    setVerification(null);
  }, []);

  const toggleLayerBuVenh = useCallback(
    (altId: string, layerId: string, isBuVenh: boolean) => {
      setProject((prev) => ({
        ...prev,
        alternatives: prev.alternatives.map((a) =>
          a.id === altId
            ? {
                ...a,
                layers: a.layers.map((l) => (l.id === layerId ? { ...l, isBuVenh } : l)),
              }
            : a,
        ),
      }));
      setDirty(true);
      setVerification(null);
    },
    [],
  );

  const setActiveAlternativeId = useCallback((altId: string) => {
    setProject((prev) => ({ ...prev, activeAlternativeId: altId }));
    setSelectedShearTargetId(null);
    setSelectedFlexuralLayerId(null);
  }, []);

  const commitAlternativeLayers = useCallback((altId: string, layers: PavementLayer[]) => {
    setProject((prev) => ({
      ...prev,
      alternatives: prev.alternatives.map((a) => (a.id === altId ? { ...a, layers } : a)),
    }));
    setDirty(true);
    setVerification(null);
  }, []);

  const addAlternative = useCallback((name: string) => {
    const newId = `pa-${Date.now()}`;
    setProject((prev) => ({
      ...prev,
      alternatives: [...prev.alternatives, { id: newId, name, layers: [] }],
      activeAlternativeId: newId,
    }));
    setActivePageTab('ket-cau');
    setDirty(true);
    setVerification(null);
    setStatusMessage(`Đã thêm phương án "${name}".`);
  }, []);

  const renameAlternative = useCallback((altId: string, name: string) => {
    setProject((prev) => ({
      ...prev,
      alternatives: prev.alternatives.map((a) => (a.id === altId ? { ...a, name } : a)),
    }));
    setDirty(true);
    setVerification(null);
    setStatusMessage(`Đã đổi tên phương án thành "${name}".`);
  }, []);

  const deleteActiveAlternative = useCallback(() => {
    setProject((prev) => {
      if (prev.alternatives.length <= 1) return prev;
      const remaining = prev.alternatives.filter((a) => a.id !== prev.activeAlternativeId);
      return {
        ...prev,
        alternatives: remaining,
        activeAlternativeId: remaining[0].id,
      };
    });
    setDirty(true);
    setVerification(null);
    setStatusMessage('Đã xóa phương án kết cấu.');
  }, []);

  const newProject = useCallback(() => {
    setProject(createBlankProject());
    setVerification(null);
    setFileName(null);
    setDirty(false);
    setSelectedShearTargetId(null);
    setSelectedFlexuralLayerId(null);
    setActivePageTab('thong-tin');
    setStatusMessage('Đã khởi tạo dự án mới.');
  }, []);

  const closeProject = useCallback(() => {
    setProject(createBlankProject());
    setVerification(null);
    setFileName(null);
    setDirty(false);
    setSelectedShearTargetId(null);
    setSelectedFlexuralLayerId(null);
    setActivePageTab('thong-tin');
    setStatusMessage('Đã đóng dự án.');
  }, []);

  const loadSampleProject = useCallback(() => {
    const cloned = structuredClone(SAMPLE_TCCS38_EX1);
    setProject(cloned);
    setFileName('ViDu1_PhuLucD_TCCS38_2022.adm');
    setDirty(false);
    setSelectedShearTargetId(null);
    setSelectedFlexuralLayerId(null);
    setActivePageTab((cur) => (cur === 'ao-duong-cu' ? 'thong-tin' : cur));
    const res = runFullVerification(cloned);
    setVerification(res);
    setProgress(100);
    setStatusMessage('Đã nạp ví dụ mẫu Phụ lục D.1 (TCCS 38:2022/TCĐBVN) và hoàn tất kiểm toán.');
  }, []);

  const loadSampleRehabProject = useCallback((variant: 'overlay' | 'mill' = 'overlay') => {
    const source = variant === 'mill' ? SAMPLE_TCCS38_CH10_MILL : SAMPLE_TCCS38_CH10;
    const cloned = ensureRehabState(structuredClone(source));
    setProject(cloned);
    setFileName(
      variant === 'mill'
        ? 'ViDu_CaoBocTangMat_Chuong10_TCCS38.adm'
        : 'ViDu_TangCuong_Chuong10_TCCS38.adm',
    );
    setDirty(false);
    setSelectedShearTargetId(null);
    setSelectedFlexuralLayerId(null);
    const res = runFullVerification(cloned);
    setVerification(res);
    setProgress(100);
    setActivePageTab('ao-duong-cu');
    setStatusMessage(
      variant === 'mill'
        ? 'Đã nạp ví dụ cải tạo (Cào bóc & tận dụng móng — Chương 10, TCCS 38:2022) và hoàn tất kiểm toán.'
        : 'Đã nạp ví dụ cải tạo, tăng cường áo đường cũ (Chương 10 — TCCS 38:2022/TCĐBVN) và hoàn tất kiểm toán.',
    );
  }, []);

  const openProjectFromFile = useCallback(async (file: File) => {
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const isJson = file.name.toLowerCase().endsWith('.json');
      const rawLoaded = isJson
        ? parseProjectJson(new TextDecoder().decode(buf))
        : parseAdmProject(buf);
      const loaded = ensureRehabState(rawLoaded);
      setProject(loaded);
      setFileName(file.name);
      setDirty(false);
      setVerification(null);
      setSelectedShearTargetId(null);
      setSelectedFlexuralLayerId(null);
      setActivePageTab('thong-tin');
      setStatusMessage(`Đã mở dự án: ${file.name}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage(`Lỗi mở file: ${msg}`);
      window.alert(msg);
    }
  }, []);

  const saveProject = useCallback(
    (forcePromptName = false) => {
      let targetName = fileName || 'DuAnAoDuong.adm';
      if (forcePromptName) {
        const entered = window.prompt('Nhập tên file dự án (.adm):', targetName);
        if (!entered) return;
        targetName = entered.toLowerCase().endsWith('.adm') ? entered : `${entered}.adm`;
      } else if (!targetName.toLowerCase().endsWith('.adm')) {
        targetName = `${targetName}.adm`;
      }
      const bytes = serializeAdmProject(syncedProject);
      triggerDownloadBytes(bytes, targetName);
      setFileName(targetName);
      setDirty(false);
      setStatusMessage(`Đã lưu dự án xuống file ${targetName}.`);
    },
    [fileName, syncedProject],
  );

  const runVerification = useCallback(() => {
    setIsRunning(true);
    setProgress(35);
    setStatusMessage('Đang chạy kiểm toán các phương án kết cấu áo đường...');
    try {
      const res = runFullVerification(syncedProject);
      setVerification(res);
      setProgress(100);
      setIsRunning(false);
      const activeRes = res.alternatives[syncedProject.activeAlternativeId];
      const summary = activeRes
        ? `${activeRes.alternativeName}: ${activeRes.allPassed ? 'ĐẠT tất cả chỉ tiêu' : 'KHÔNG ĐẠT một số chỉ tiêu'}`
        : 'Hoàn tất kiểm toán';
      setStatusMessage(`Kiểm toán hoàn tất — ${summary}`);
      if (
        activePageTab !== 'vong' &&
        activePageTab !== 'truot' &&
        activePageTab !== 'keo-uon'
      ) {
        setActivePageTab('vong');
      }
    } catch (err) {
      setIsRunning(false);
      setProgress(0);
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage(`Lỗi kiểm toán: ${msg}`);
    }
  }, [syncedProject, activePageTab]);

  const exportExcelForAlternatives = useCallback(
    async (selectedIds: string[]) => {
      const res = verification ?? runFullVerification(syncedProject);
      if (!verification) setVerification(res);
      const base = (syncedProject.projectInfo.congTrinh || 'KetQuaAoDuong')
        .replace(/[\\/:*?"<>|]+/g, '_')
        .slice(0, 60);
      await downloadVerificationExcel(syncedProject, res, selectedIds, `${base}.xlsx`);
      setStatusMessage(`Đã xuất kết quả Excel (${selectedIds.length} phương án).`);
    },
    [verification, syncedProject],
  );

  const setMaterials = useCallback((next: MaterialRecord[]) => {
    setMaterialsState(next);
    try {
      window.localStorage.setItem(VATLIEU_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage quota errors
    }
  }, []);

  const resetMaterialsDefault = useCallback(() => {
    setMaterialsState(DEFAULT_MATERIALS);
    try {
      window.localStorage.removeItem(VATLIEU_STORAGE_KEY);
    } catch {
      // ignore
    }
    setStatusMessage(`Đã khôi phục database vật liệu mặc định (${DEFAULT_MATERIALS.length} dòng).`);
  }, []);

  const loadVatLieuFromFile = useCallback(
    async (file: File) => {
      try {
        const buf = new Uint8Array(await file.arrayBuffer());
        const loaded = parseVatLieuDat(buf);
        setMaterials(loaded);
        setActivePageTab('sua-vat-lieu');
        setStatusMessage(`Đã nạp ${loaded.length} dòng từ ${file.name}.`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        window.alert(msg);
      }
    },
    [setMaterials],
  );

  const saveVatLieuFile = useCallback(() => {
    const bytes = serializeVatLieuDat(materials);
    triggerDownloadBytes(bytes, 'VatLieu.dat');
    try {
      window.localStorage.setItem(VATLIEU_STORAGE_KEY, JSON.stringify(materials));
    } catch {
      // ignore
    }
    setStatusMessage(`Đã lưu ${materials.length} dòng vào VatLieu.dat.`);
  }, [materials]);

  const setToanDoInput = useCallback((id: ToanDoId, next: ToanDoInputStrings) => {
    setToanDoInputs((prev) => ({ ...prev, [id]: next }));
  }, []);

  const value: AppStoreValue = {
    project,
    syncedProject,
    traffic,
    designParams,
    echCu_MPa,
    activeAlternative,
    materials,
    verification,
    fileName,
    dirty,
    activeRibbonTab,
    activePageTab,
    selectedShearTargetId,
    selectedFlexuralLayerId,
    statusMessage,
    progress,
    isRunning,
    toanDoInputs,
    toanDoResults,
    setActiveRibbonTab,
    setActivePageTab,
    setSelectedShearTargetId,
    setSelectedFlexuralLayerId,
    setStatusMessage,
    updateProject,
    updateRehabilitation,
    updateExistingLayers,
    toggleLayerBuVenh,
    setActiveAlternativeId,
    commitAlternativeLayers,
    addAlternative,
    renameAlternative,
    deleteActiveAlternative,
    newProject,
    closeProject,
    loadSampleProject,
    loadSampleRehabProject,
    openProjectFromFile,
    saveProject,
    runVerification,
    exportExcelForAlternatives,
    setMaterials,
    resetMaterialsDefault,
    loadVatLieuFromFile,
    saveVatLieuFile,
    setToanDoInput,
  };

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore(): AppStoreValue {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error('useAppStore must be used inside AppStoreProvider');
  return ctx;
}
