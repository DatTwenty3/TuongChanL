/**
 * BangTinhCauCong Web App — Main Application Shell
 *
 * Reconstructs the complete 7-mode (#appMode: cau, ch, ct, tc, tl, tv, tvc)
 * + 46-tab + Verification (#tab60) workspace:
 * - Toolbar: Top sticky action bar (#appMode, #expScope, #btnX, #btnP, #btnSv, #btnOp, #btnDf, #btnBk, #klMsg, #xmsg)
 * - Sheet container (#sheet):
 *   - ProjectHeader: Project metadata (#pj1..#pj6)
 *   - TabStrip: 46 calculation tabs with dynamic mode/foundation/substructure visibility
 *   - OverviewPane: Tab 7 dashboard, summary cards, TOC (#tqToc), item checklist (#tqIt)
 *   - LegacyShellBridge: Mounts and wires 44 engineering calculation panes (#tab1..#tab70)
 *   - VerificationPane: Tab 60 software verification suite (#vt_run, #vt_sum, #vt_tb)
 * - LookupModal: Standards reference modal (#lkBg / #lkBox)
 *
 * Clean-room standalone implementation with zero external CDN URLs.
 */

import React from 'react';
import {
  AppStoreProvider,
  useAppStore,
} from './state/appStore.ts';
import { CvNav } from './components/CvNav.tsx';
import { SuiteHeader } from './components/SuiteHeader.tsx';
import {
  Toolbar,
  ProjectHeader,
  OverviewPane,
  VerificationPane,
  LegacyShellBridge,
  LookupModal,
} from './components/index.ts';

function AppContent() {
  const {
    mode,
    activeTab,
    exportScope,
    disabledItems,
    isDirty,
    busyExport,
    statusMessage,
    klMessage,
    defaultArmed,
    hasBackup,
    metadata,
    setMode,
    setActiveTab,
    setExportScope,
    setMetadataField,
    saveProject,
    openProjectFile,
    exportExcel,
    exportPdfReport,
    handleDefaultReset,
    handleRestoreBackup,
    markDirty,
  } = useAppStore();

  return (
    <>
      <SuiteHeader />
      <div className="cv-layout">
        <CvNav
          mode={mode}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          disabledItems={disabledItems}
        />
        <div className="cv-main">
          <Toolbar
            mode={mode}
            exportScope={exportScope}
            isDirty={isDirty}
            busyExport={busyExport}
            klMessage={klMessage}
            statusMessage={statusMessage}
            defaultArmed={defaultArmed}
            hasBackup={hasBackup}
            onModeChange={setMode}
            onExportScopeChange={setExportScope}
            onExportXlsx={exportExcel}
            onExportPdf={exportPdfReport}
            onSaveJson={saveProject}
            onOpenFile={openProjectFile}
            onDefaultReset={handleDefaultReset}
            onRestoreBackup={handleRestoreBackup}
          />
          <div className="sheet" id="sheet">
            <ProjectHeader metadata={metadata} onChange={setMetadataField} />
            <OverviewPane mode={mode} activeTab={activeTab} onSelectTab={setActiveTab} />
            <LegacyShellBridge
              mode={mode}
              activeTab={activeTab}
              includeTab7={false}
              onTabChange={setActiveTab}
              onStateChange={markDirty}
            />
            <VerificationPane activeTab={activeTab} />
          </div>
        </div>
        <LookupModal />
      </div>
    </>
  );
}

export function App() {
  return (
    <AppStoreProvider>
      <AppContent />
    </AppStoreProvider>
  );
}

export default App;
