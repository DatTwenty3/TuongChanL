import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { readTheme, writeTheme, type ThemeMode } from '../shared/theme';
import {
  AlternativeNameModal,
  ExportExcelModal,
  StandardInfoModal,
  ThamKhaoTangMatModal,
} from './components/Dialogs';
import { RibbonBar } from './components/RibbonBar';
import { StatusBar } from './components/StatusBar';
import { StepNav } from './components/StepNav';
import { TabDesignParams } from './components/TabDesignParams';
import { TabExistingPavement } from './components/TabExistingPavement';
import { TabMaterialDb } from './components/TabMaterialDb';
import { TabNomogram } from './components/TabNomogram';
import { TabPavementStructure } from './components/TabPavementStructure';
import { TabProjectInfo } from './components/TabProjectInfo';
import {
  TabRigidDrain,
  TabRigidJoint,
  TabRigidResult,
  TabRigidStructure,
  TabRigidTraffic,
} from './components/TabRigid';
import { TabRoadScale } from './components/TabRoadScale';
import { TabSubgrade } from './components/TabSubgrade';
import { TabTraffic } from './components/TabTraffic';
import { TabVerificationResult } from './components/TabVerificationResult';
import { TreeNav } from './components/TreeNav';
import { createDefaultRehabilitationConfig, createDefaultRigidProjectData, resolveSubgrade } from './engine';
import { computeLaneFactor } from './engine/traffic';
import { AppStoreProvider, useAppStore } from './state/appStore';
import { getEditedTabs, getVisibleMainTabs, type MainTabKey } from './state/navigation';
import type {
  ProjectInfo,
  ProjectState,
  RigidProjectData,
  SurfaceGrade,
  ToanDoId,
} from './types/project';

function MainWorkspace(): React.ReactElement {
  const store = useAppStore();
  const [treeWidth, setTreeWidth] = useState(288);
  const [mobileTreeOpen, setMobileTreeOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(readTheme);
  const [modal, setModal] = useState<
    | { type: 'none' }
    | { type: 'tham-khao' }
    | { type: 'xuat-excel' }
    | { type: 'tieu-chuan' }
    | { type: 'add-alt' }
    | { type: 'rename-alt' }
  >({ type: 'none' });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = theme;
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((cur) => {
      const next: ThemeMode = cur === 'dark' ? 'light' : 'dark';
      writeTheme(next);
      return next;
    });
  }, []);

  const openFileInputRef = useRef<HTMLInputElement>(null);
  const openVatLieuInputRef = useRef<HTMLInputElement>(null);
  const tabListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const activeBtn = tabListRef.current?.querySelector('[aria-selected="true"]');
    if (activeBtn && typeof (activeBtn as HTMLElement).scrollIntoView === 'function') {
      (activeBtn as HTMLElement).scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [store.activePageTab]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault();
        store.runVerification();
      } else if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        openFileInputRef.current?.click();
      } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        store.saveProject(true);
      } else if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        store.saveProject(false);
      } else if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        store.newProject();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [store]);

  const startTreeResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = treeWidth;
    const onMove = (ev: MouseEvent) => {
      setTreeWidth(Math.max(190, Math.min(480, startW + (ev.clientX - startX))));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleSelectPageTab = (key: MainTabKey) => {
    store.setActivePageTab(key);
    if (key.startsWith('td-')) {
      store.setActiveRibbonTab('TOOLS');
    } else if (key === 'sua-vat-lieu') {
      store.setActiveRibbonTab('TOOLS');
    }
  };

  const activeAltVerification =
    store.verification?.alternatives[store.activeAlternative.id] ?? null;

  const loaiTK = store.project.projectInfo.loaiTK;
  const loaiMat = store.project.projectInfo.loaiMatDuong ?? 'MEM';
  const visibleTabs = getVisibleMainTabs(loaiTK, loaiMat);

  // Mốc so sánh = dự án ở lần mở / lưu gần nhất (lúc `dirty` = false) → chấm "đã sửa" ở cây điều hướng.
  const baselineRef = useRef<ProjectState>(store.project);
  if (!store.dirty) baselineRef.current = store.project;
  const editedTabs = useMemo(
    () => (store.dirty ? getEditedTabs(store.project, baselineRef.current) : new Set<MainTabKey>()),
    [store.dirty, store.project],
  );

  const handleProjectInfoChange = (patch: Partial<ProjectInfo>) => {
    if (patch.loaiMatDuong && patch.loaiMatDuong !== loaiMat) {
      store.setStatusMessage(
        patch.loaiMatDuong === 'CUNG'
          ? 'Sẵn sàng — Mặt đường cứng BTXM (TCCS 39:2022/TCĐBVN)'
          : 'Sẵn sàng — Áo đường mềm (TCCS 38:2022/TCĐBVN)',
      );
    }
    store.updateProject((prev) => {
      const nextInfo = { ...prev.projectInfo, ...patch };
      if (patch.loaiMatDuong === 'CUNG') {
        nextInfo.loaiTK = 'TK_MOI';
        nextInfo.doiTuongTK = 'KCAD';
      }
      const nextFl =
        patch.doiTuongTK !== undefined || patch.loaiMatDuong === 'CUNG'
          ? computeLaneFactor(prev.roadScale.soLanXe, prev.roadScale.gpcGiua, nextInfo.doiTuongTK)
          : prev.roadScale.heSoLan_fL;
      return {
        ...prev,
        projectInfo: nextInfo,
        roadScale: { ...prev.roadScale, heSoLan_fL: nextFl },
      };
    });
  };

  const updateRigid = (fn: (prev: RigidProjectData) => RigidProjectData) =>
    store.updateProject((prev) => ({
      ...prev,
      rigid: fn(prev.rigid ?? createDefaultRigidProjectData()),
    }));

  const renderPageContent = () => {
    switch (store.activePageTab) {
      case 'thong-tin':
        return (
          <TabProjectInfo
            info={store.project.projectInfo}
            rehabStrategy={store.project.rehabilitation?.strategy}
            onGoToExistingPavement={() => store.setActivePageTab('ao-duong-cu')}
            onChange={handleProjectInfoChange}
          />
        );
      case 'quy-mo':
        return (
          <TabRoadScale
            roadScale={store.project.roadScale}
            doiTuongTK={store.project.projectInfo.doiTuongTK}
            onChange={(roadScale) =>
              store.updateProject((prev) => ({ ...prev, roadScale }))
            }
          />
        );
      case 'luu-luong':
        return (
          <TabTraffic
            vehicles={store.project.vehicles}
            forecast={store.project.forecast}
            traffic={store.traffic}
            onVehiclesChange={(vehicles) =>
              store.updateProject((prev) => ({
                ...prev,
                vehicles,
                storedNtk: undefined,
              }))
            }
            onForecastChange={(forecast) =>
              store.updateProject((prev) => ({
                ...prev,
                forecast,
                storedNtk: prev.forecast.tlTrucQuyDoi_kN !== forecast.tlTrucQuyDoi_kN
                  ? undefined
                  : prev.storedNtk,
              }))
            }
          />
        );
      case 'dat-nen':
        return (
          <TabSubgrade
            subgrade={store.project.subgrade}
            loaiTK={loaiTK}
            onChange={(subgrade) =>
              store.updateProject((prev) => ({ ...prev, subgrade }))
            }
          />
        );
      case 'ao-duong-cu':
        return (
          <TabExistingPavement
            project={store.syncedProject}
            rehabilitation={store.project.rehabilitation ?? createDefaultRehabilitationConfig()}
            materials={store.materials}
            onChange={store.updateRehabilitation}
            onStatus={store.setStatusMessage}
          />
        );
      case 'thong-so':
        return (
          <TabDesignParams
            forecast={store.project.forecast}
            traffic={store.traffic}
            designParams={store.designParams}
            loaiTK={loaiTK}
            echCu_MPa={store.echCu_MPa}
            rehabStrategy={store.project.rehabilitation?.strategy}
            onChangeGrade={(loaiTangMat: SurfaceGrade) =>
              store.updateProject((prev) => ({
                ...prev,
                designParams: { ...prev.designParams, loaiTangMat },
              }))
            }
            onOpenThamKhao={() => setModal({ type: 'tham-khao' })}
            onGoToKetCau={() => store.setActivePageTab('ket-cau')}
          />
        );
      case 'ket-cau':
        return (
          <TabPavementStructure
            alternative={store.activeAlternative}
            materials={store.materials}
            loaiTK={loaiTK}
            onCommitLayers={store.commitAlternativeLayers}
            onStatus={store.setStatusMessage}
          />
        );
      case 'vong':
      case 'truot':
      case 'keo-uon':
        return (
          <TabVerificationResult
            mode={store.activePageTab}
            project={store.syncedProject}
            traffic={store.traffic}
            verification={activeAltVerification}
            selectedShearTargetId={store.selectedShearTargetId}
            selectedFlexuralLayerId={store.selectedFlexuralLayerId}
            onRunVerification={store.runVerification}
          />
        );
      case 'td-31':
      case 'td-32':
      case 'td-33':
      case 'td-34':
      case 'td-35':
      case 'td-36': {
        const map: Record<'td-31' | 'td-32' | 'td-33' | 'td-34' | 'td-35' | 'td-36', ToanDoId> = {
          'td-31': '3-1',
          'td-32': '3-2',
          'td-33': '3-3',
          'td-34': '3-4',
          'td-35': '3-5',
          'td-36': '3-6',
        };
        const normalizedId = map[store.activePageTab];
        return (
          <TabNomogram
            id={normalizedId}
            inputs={store.toanDoInputs[normalizedId]}
            lookupResult={store.toanDoResults[normalizedId]}
            onChange={(next) => store.setToanDoInput(normalizedId, next)}
          />
        );
      }
      case 'cung-giao-thong':
        return store.project.rigid ? (
          <TabRigidTraffic rigid={store.project.rigid} onChange={updateRigid} />
        ) : null;
      case 'cung-ket-cau':
        return store.project.rigid ? (
          <TabRigidStructure
            rigid={store.project.rigid}
            subgradeE0={resolveSubgrade(store.project.subgrade).E0_MPa}
            onChange={updateRigid}
          />
        ) : null;
      case 'cung-khe-noi':
        return store.project.rigid && store.rigidVerification ? (
          <TabRigidJoint
            rigid={store.project.rigid}
            verification={store.rigidVerification}
            onChange={updateRigid}
          />
        ) : null;
      case 'cung-thoat-nuoc':
        return store.project.rigid && store.rigidVerification ? (
          <TabRigidDrain
            rigid={store.project.rigid}
            verification={store.rigidVerification}
            onChange={updateRigid}
          />
        ) : null;
      case 'cung-kiem-toan':
        return store.rigidVerification ? (
          <TabRigidResult
            project={store.syncedProject}
            verification={store.rigidVerification}
            onRun={store.runVerification}
          />
        ) : null;
      case 'sua-vat-lieu':
        return (
          <TabMaterialDb
            materials={store.materials}
            onChange={store.setMaterials}
            onLoadFile={() => openVatLieuInputRef.current?.click()}
            onSaveFile={store.saveVatLieuFile}
            onResetDefault={store.resetMaterialsDefault}
          />
        );
    }
  };

  return (
    <div className="adm-shell" data-theme={theme}>
      {/* Hidden File Inputs */}
      <input
        ref={openFileInputRef}
        type="file"
        accept=".adm,.json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void store.openProjectFromFile(f);
          e.target.value = '';
        }}
      />
      <input
        ref={openVatLieuInputRef}
        type="file"
        accept=".dat"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void store.loadVatLieuFromFile(f);
          e.target.value = '';
        }}
      />

      {/* Unified LEDAT-BIM Header + Floating-Glass Ribbon */}
      <RibbonBar
        projectName={store.project.projectInfo.congTrinh}
        fileName={store.fileName}
        dirty={store.dirty}
        loaiTK={loaiTK}
        loaiMat={loaiMat}
        activeRibbonTab={store.activeRibbonTab}
        activePageTab={store.activePageTab}
        alternatives={store.project.alternatives}
        activeAlternativeId={store.activeAlternative.id}
        isRunning={store.isRunning}
        theme={theme}
        onToggleTheme={toggleTheme}
        onToggleMobileTree={() => setMobileTreeOpen((v) => !v)}
        onSelectRibbonTab={store.setActiveRibbonTab}
        onSelectPageTab={handleSelectPageTab}
        onNewProject={store.newProject}
        onOpenProjectFile={() => openFileInputRef.current?.click()}
        onSaveProject={() => store.saveProject(false)}
        onSaveProjectAs={() => store.saveProject(true)}
        onCloseProject={store.closeProject}
        onLoadSampleProject={store.loadSampleProject}
        onLoadSampleRehabProject={store.loadSampleRehabProject}
        onLoadSampleRigidProject={store.loadSampleRigidProject}
        onChangePavementKind={(kind) => handleProjectInfoChange({ loaiMatDuong: kind })}
        onAddAlternative={() => setModal({ type: 'add-alt' })}
        onRenameAlternative={() => setModal({ type: 'rename-alt' })}
        onDeleteAlternative={() => {
          if (
            store.project.alternatives.length > 1 &&
            window.confirm(`Xóa phương án "${store.activeAlternative.name}"?`)
          ) {
            store.deleteActiveAlternative();
          }
        }}
        onSelectAlternative={store.setActiveAlternativeId}
        onRunVerification={store.runVerification}
        onOpenExportExcel={() =>
          loaiMat === 'CUNG' ? void store.exportRigidExcel() : setModal({ type: 'xuat-excel' })
        }
        onOpenMaterialDbTab={() => handleSelectPageTab('sua-vat-lieu')}
        onLoadVatLieuFile={() => openVatLieuInputRef.current?.click()}
        onSaveVatLieuFile={store.saveVatLieuFile}
        onOpenTieuChuan={() => setModal({ type: 'tieu-chuan' })}
      />

      {mobileTreeOpen && (
        <div
          className="adm-tree-scrim"
          aria-hidden="true"
          onClick={() => setMobileTreeOpen(false)}
        />
      )}

      {/* Main Split Workspace */}
      <div className="adm-workspace">
        <TreeNav
          widthPx={treeWidth}
          loaiTK={loaiTK}
          loaiMat={loaiMat}
          rigidPassed={store.rigidVerification?.allPassed}
          editedTabs={editedTabs}
          activePageTab={store.activePageTab}
          alternatives={store.project.alternatives}
          activeAlternativeId={store.activeAlternative.id}
          verification={store.verification}
          selectedShearTargetId={store.selectedShearTargetId}
          selectedFlexuralLayerId={store.selectedFlexuralLayerId}
          mobileOpen={mobileTreeOpen}
          onCloseMobile={() => setMobileTreeOpen(false)}
          onSelectInputTab={(tab) => {
            store.setActivePageTab(tab);
          }}
          onSelectAlternativeStructure={(altId) => {
            store.setActiveAlternativeId(altId);
            store.setActivePageTab('ket-cau');
          }}
          onSelectDeflection={(altId) => {
            store.setActiveAlternativeId(altId);
            store.setActivePageTab('vong');
          }}
          onSelectShearTarget={(altId, targetId) => {
            store.setActiveAlternativeId(altId);
            store.setSelectedShearTargetId(targetId);
            store.setActivePageTab('truot');
          }}
          onSelectFlexuralLayer={(altId, layerId) => {
            store.setActiveAlternativeId(altId);
            store.setSelectedFlexuralLayerId(layerId);
            store.setActivePageTab('keo-uon');
          }}
        />

        <div
          className="adm-splitter-v"
          title="Kéo để thay đổi độ rộng cây điều hướng"
          onMouseDown={startTreeResize}
        />

        <main className="adm-main-pane">
          <div ref={tabListRef} className="adm-page-tabs" role="tablist" aria-label="Trang đang làm việc">
            {visibleTabs
              .filter((t) => t.key === store.activePageTab)
              .map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={true}
                  className="adm-page-tab active"
                  onClick={() => handleSelectPageTab(t.key)}
                >
                  <img src={t.icon} alt="" />
                  <span>{t.label}</span>
                </button>
              ))}
          </div>

          <div className="adm-page-body">{renderPageContent()}</div>

          <StepNav
            active={store.activePageTab}
            loaiTK={loaiTK}
            loaiMat={loaiMat}
            isRunning={store.isRunning}
            onGo={handleSelectPageTab}
            onRun={store.runVerification}
          />
        </main>
      </div>

      {/* Bottom Status Bar */}
      <StatusBar
        statusMessage={store.statusMessage}
        progress={store.progress}
        isRunning={store.isRunning}
      />

      {/* Secondary Dialogs */}
      <ThamKhaoTangMatModal
        open={modal.type === 'tham-khao'}
        onClose={() => setModal({ type: 'none' })}
      />

      <ExportExcelModal
        open={modal.type === 'xuat-excel'}
        alternatives={store.project.alternatives}
        onExport={store.exportExcelForAlternatives}
        onClose={() => setModal({ type: 'none' })}
      />

      <AlternativeNameModal
        open={modal.type === 'add-alt'}
        title="Thêm phương án kết cấu"
        promptLabel="Nhập tên phương án thêm mới:"
        initialName={`Phương án ${store.project.alternatives.length + 1}`}
        onConfirm={(name) => {
          store.addAlternative(name);
          setModal({ type: 'none' });
        }}
        onClose={() => setModal({ type: 'none' })}
      />

      <AlternativeNameModal
        open={modal.type === 'rename-alt'}
        title="Sửa phương án"
        promptLabel="Nhập tên phương án mới:"
        initialName={store.activeAlternative.name}
        onConfirm={(name) => {
          store.renameAlternative(store.activeAlternative.id, name);
          setModal({ type: 'none' });
        }}
        onClose={() => setModal({ type: 'none' })}
      />

      <StandardInfoModal
        kind={loaiMat}
        open={modal.type === 'tieu-chuan'}
        onClose={() => setModal({ type: 'none' })}
      />
    </div>
  );
}

export default function App(): React.ReactElement {
  return (
    <AppStoreProvider>
      <MainWorkspace />
    </AppStoreProvider>
  );
}
