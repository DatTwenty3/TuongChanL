import React, { useState } from 'react';
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
import { Glyphs, Icon } from './components/Icon';
import { AppProvider, useAppStore } from './state/appStore';
import type { AppViewMode, Project, TemplateId } from './types/project';

const APP_VERSION = '1.0.0';
const DEFAULT_TPL: TemplateId = 'B';
const INITIAL_MODE: AppViewMode = '2d';

/** Nhãn ngắn cho thanh tab (tên đầy đủ nằm trong tooltip). */
const SHEET_SHORT = [
  'Chi tiết tường',
  'Bố trí thép (1)',
  'Bố trí thép (2)',
  'Thanh thép',
  'Khối lượng',
];

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

  const [sideOpen, setSideOpen] = useState(true);

  const badge = calcBadgeStatus(calcResult, project);
  const sh = getSheet(curSheet);
  const sinfoText = `Cụm chi tiết · tỷ lệ 1/${sh.S} · rộng ${fmt((sh.W * 10) / sh.S, 0)} × cao ${fmt((sh.H * 10) / sh.S, 0)} mm trên giấy${
    sh.fits || sh.noScale ? '' : ` · ⚠ vượt khổ ${project.paper} (chọn tỷ lệ nhỏ hơn)`
  }`;

  return (
    <div
      className="app-shell"
      data-app="tuong-chan-L"
      data-tpl={project.tpl}
      data-view={viewMode}
      data-side={sideOpen ? 'open' : 'closed'}
    >
      <HeaderToolbar />
      <main>
        <aside>
          <div className="side-head">
            <Icon name={viewMode === 'calc' ? 'calc' : 'sliders'} size={16} />
            <span className="side-ttl">
              {viewMode === 'calc' ? 'Thông số tính toán' : 'Thông số bản vẽ'}
            </span>
            <span className="side-sub">
              {viewMode === 'calc' ? 'Kiểm toán TCVN 11823' : 'Kích thước · cốt thép'}
            </span>
          </div>
          <div className="side-sum">
            <SidebarMetrics />
          </div>
          <div className="side-body">
            {viewMode === 'calc' ? <SidebarCalcPanel /> : <SidebarCadPanel />}
          </div>
        </aside>

        <section className="view">
          <nav>
            <button
              id="bSide"
              type="button"
              className="sidebtn"
              aria-pressed={sideOpen}
              title={sideOpen ? 'Ẩn bảng thông số để mở rộng vùng làm việc' : 'Hiện bảng thông số'}
              onClick={() => setSideOpen((v) => !v)}
            >
              <Icon name="sidebar" />
              Thông số
            </button>

            <div id="tabs">
              <span className="tabgrp">Bản vẽ 2D</span>
              {SHEET_DEFS.map((d, i) => (
                <button
                  key={d.name}
                  type="button"
                  title={`${i + 1}. ${d.name[0] + d.name.slice(1).toLowerCase()}`}
                  className={'tsheet' + (viewMode === '2d' && curSheet === i ? ' on' : '')}
                  onClick={() => selectSheetTab(i)}
                >
                  {`${i + 1}. ${SHEET_SHORT[i] ?? d.name[0] + d.name.slice(1).toLowerCase()}`}
                </button>
              ))}
              <span className="tabsep" aria-hidden="true" />
              <button
                id="tab3d"
                type="button"
                title="3D · Mô hình"
                className={'tab3d' + (viewMode === '3d' ? ' on' : '')}
                onClick={() => setViewMode('3d')}
              >
                <Icon name="cube" />
                3D · Mô hình
              </button>
              <span className="tabsep" aria-hidden="true" />
              <button
                id="tabCalc"
                type="button"
                title="Tính toán"
                className={'tabcalc' + (viewMode === 'calc' ? ' on' : '')}
                onClick={() => setViewMode('calc')}
              >
                <Icon name="calc" />
                {'Tính toán '}
                <span id="calcBadge" className={badge.cls}>
                  <Glyphs text={badge.text} />
                </span>
              </button>
            </div>
          </nav>

          <Cad2DViewport />
          <Model3DViewport />
          <CalcReportViewport />

          <footer className="statusbar" hidden={viewMode !== '2d'}>
            <span id="sinfo" hidden={viewMode !== '2d'}>
              <Glyphs text={sinfoText} />
            </span>
            <span className="tip">
              Lăn chuột để phóng to/thu nhỏ · kéo để di chuyển · nhấp đúp để vừa khung
            </span>
            <button
              id="bFit"
              type="button"
              hidden={viewMode !== '2d'}
              onClick={requestFit2d}
            >
              <Icon name="fit" size={13} />
              Vừa khung
            </button>
          </footer>
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
