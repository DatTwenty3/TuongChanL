import React from 'react';
import { SHEET_DEFS } from './cad';
import { calcBadgeStatus, fmt } from './engine';
import {
  Cad2DViewport,
  CalcReportViewport,
  HeaderToolbar,
  Model3DViewport,
  SidebarCadPanel,
  SidebarCalcPanel,
  SidebarMetrics,
  ToastBanner,
} from './components';
import { AppProvider, useAppStore } from './state/appStore';
import type { AppViewMode, Project, TemplateId } from './types/project';

const APP_VERSION = '1.0.0';
const DEFAULT_TPL: TemplateId = 'B';
const INITIAL_MODE: AppViewMode = '2d';

export interface AppShellInfo {
  version: string;
  defaultTemplate: TemplateId;
  initialMode: AppViewMode;
  projectType?: Project['type'];
}

export const APP_SHELL_INFO: AppShellInfo = {
  version: APP_VERSION,
  defaultTemplate: DEFAULT_TPL,
  initialMode: INITIAL_MODE,
};

const AppWorkspace: React.FC = () => {
  const {
    project,
    viewMode,
    curSheet,
    getSheet,
    calcResult,
    feRev,
    selectSheetTab,
    setViewMode,
    requestFit2d,
  } = useAppStore();

  void feRev;

  const badge = calcBadgeStatus(calcResult, project);
  const sh = getSheet(curSheet);
  const sinfoText = `Cụm chi tiết · tỷ lệ 1/${sh.S} · rộng ${fmt((sh.W * 10) / sh.S, 0)} × cao ${fmt((sh.H * 10) / sh.S, 0)} mm trên giấy${
    sh.fits || sh.noScale ? '' : ` · ⚠ vượt khổ ${project.paper} (chọn tỷ lệ nhỏ hơn)`
  }`;

  return (
    <div className="app-shell" data-app="tuong-chan-L" data-tpl={project.tpl}>
      <HeaderToolbar />
      <main>
        <aside>
          <SidebarMetrics />
          {viewMode === 'calc' ? <SidebarCalcPanel /> : <SidebarCadPanel />}
        </aside>

        <section className="view">
          <nav>
            <div id="tabs">
              {SHEET_DEFS.map((d, i) => (
                <button
                  key={d.name}
                  type="button"
                  className={viewMode === '2d' && curSheet === i ? 'on' : undefined}
                  onClick={() => selectSheetTab(i)}
                >
                  {`${i + 1}. ${d.name[0] + d.name.slice(1).toLowerCase()}`}
                </button>
              ))}
              <button
                id="tab3d"
                type="button"
                className={'tab3d' + (viewMode === '3d' ? ' on' : '')}
                onClick={() => setViewMode('3d')}
              >
                3D · Mô hình
              </button>
              <button
                id="tabCalc"
                type="button"
                className={'tabcalc' + (viewMode === 'calc' ? ' on' : '')}
                onClick={() => setViewMode('calc')}
              >
                {'Tính toán '}
                <span id="calcBadge" className={badge.cls}>
                  {badge.text}
                </span>
              </button>
            </div>

            <div className="tools">
              <span id="sinfo" hidden={viewMode !== '2d'}>
                {sinfoText}
              </span>
              <button
                id="bFit"
                type="button"
                hidden={viewMode !== '2d'}
                onClick={requestFit2d}
              >
                Vừa khung
              </button>
            </div>
          </nav>

          <Cad2DViewport />
          <Model3DViewport />
          <CalcReportViewport />

          <div className="tip" hidden={viewMode !== '2d'}>
            Lăn chuột để phóng to/thu nhỏ · kéo để di chuyển · nhấp đúp để vừa khung
          </div>
        </section>
      </main>
      <ToastBanner />
    </div>
  );
};

export function App(): JSX.Element {
  return (
    <AppProvider>
      <AppWorkspace />
    </AppProvider>
  );
}

export default App;
