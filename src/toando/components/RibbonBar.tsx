import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BrandMark, Icon } from '../../components/Icon';
import { ModuleSwitch } from '../../shared/ModuleSwitch';
import type { ThemeMode } from '../../shared/theme';
import { UI_ICONS } from '../assets/iconRegistry';
import type { MainTabKey, RibbonTabKey } from '../state/navigation';
import type { DesignKindType, PavementAlternative, PavementKind } from '../types/project';

export interface RibbonBarProps {
  projectName: string;
  fileName: string | null;
  dirty: boolean;
  loaiTK?: DesignKindType;
  /** Loại mặt đường: mềm (mặc định) hoặc cứng BTXM (TCCS 39:2022). */
  loaiMat?: PavementKind;
  activeRibbonTab: RibbonTabKey;
  activePageTab: MainTabKey;
  alternatives: PavementAlternative[];
  activeAlternativeId: string;
  isRunning: boolean;
  theme?: ThemeMode;
  onToggleTheme?: () => void;
  onToggleMobileTree?: () => void;
  onSelectRibbonTab: (tab: RibbonTabKey) => void;
  onSelectPageTab: (tab: MainTabKey) => void;
  onNewProject: () => void;
  onOpenProjectFile: () => void;
  onSaveProject: () => void;
  onSaveProjectAs: () => void;
  onCloseProject: () => void;
  onLoadSampleProject: () => void;
  onLoadSampleRehabProject?: (variant?: 'overlay' | 'mill') => void;
  onLoadSampleRigidProject?: (variant?: 'B1' | 'B2') => void;
  /** Chọn loại mặt đường ngay trên thanh tiêu đề. */
  onChangePavementKind?: (kind: PavementKind) => void;
  onAddAlternative: () => void;
  onRenameAlternative: () => void;
  onDeleteAlternative: () => void;
  onSelectAlternative: (id: string) => void;
  onRunVerification: () => void;
  onOpenExportExcel: () => void;
  onOpenMaterialDbTab: () => void;
  onLoadVatLieuFile: () => void;
  onSaveVatLieuFile: () => void;
  onOpenTieuChuan: () => void;
}

const RIBBON_PREF_KEY = 'ledat-toando:ribbon-collapsed';

/** Mặc định thu gọn ribbon trên màn hình thấp/hẹp để nhường chỗ cho vùng làm việc; lựa chọn của người dùng được nhớ lại. */
function readRibbonCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const stored = window.localStorage.getItem(RIBBON_PREF_KEY);
    if (stored === '1') return true;
    if (stored === '0') return false;
  } catch {
    /* localStorage không dùng được: dùng mặc định theo kích thước màn hình */
  }
  return window.innerWidth <= 900 || window.innerHeight < 720;
}

export function RibbonBar(props: RibbonBarProps): React.ReactElement {
  const rigid = props.loaiMat === 'CUNG';
  const [collapsed, setCollapsedState] = useState<boolean>(readRibbonCollapsed);
  const setCollapsed = (next: boolean) => {
    setCollapsedState(next);
    try {
      window.localStorage.setItem(RIBBON_PREF_KEY, next ? '1' : '0');
    } catch {
      /* bỏ qua */
    }
  };
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const [kindMenuOpen, setKindMenuOpen] = useState(false);
  const titleRef = useRef<HTMLDivElement>(null);
  const [saveMenuPos, setSaveMenuPos] = useState<{ left: number; top: number } | null>(null);
  const [vlMenuPos, setVlMenuPos] = useState<{ left: number; top: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const saveBtnRef = useRef<HTMLButtonElement>(null);
  const vlBtnRef = useRef<HTMLButtonElement>(null);

  const computePopupPos = (btn: HTMLButtonElement | null): { left: number; top: number } | null => {
    if (!btn) return null;
    const rect = btn.getBoundingClientRect();
    const maxLeft = typeof window !== 'undefined' ? Math.max(8, window.innerWidth - 224) : rect.left;
    return {
      left: Math.max(8, Math.min(rect.left, maxLeft)),
      top: rect.bottom + 4,
    };
  };

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const insideTitleMenu = (e.target as Element | null)?.closest?.('.adm-title-menu');
      if (rootRef.current && !rootRef.current.contains(e.target as Node) && !insideTitleMenu) {
        setAppMenuOpen(false);
        setKindMenuOpen(false);
        setSaveMenuPos(null);
        setVlMenuPos(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAppMenuOpen(false);
        setKindMenuOpen(false);
        setSaveMenuPos(null);
        setVlMenuPos(null);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!saveMenuPos && !vlMenuPos) return;
    const syncPos = () => {
      if (saveMenuPos) setSaveMenuPos(computePopupPos(saveBtnRef.current));
      if (vlMenuPos) setVlMenuPos(computePopupPos(vlBtnRef.current));
    };
    const stripEl = stripRef.current;
    window.addEventListener('resize', syncPos);
    stripEl?.addEventListener('scroll', syncPos, { passive: true });
    return () => {
      window.removeEventListener('resize', syncPos);
      stripEl?.removeEventListener('scroll', syncPos);
    };
  }, [Boolean(saveMenuPos), Boolean(vlMenuPos)]);

  const selectRibbonTab = (tab: RibbonTabKey) => {
    props.onSelectRibbonTab(tab);
    if (collapsed) setCollapsed(false);
  };

  const titleSuffix = props.projectName.trim()
    ? ` *** Công trình: ${props.projectName.trim()}`
    : props.fileName
      ? ` *** ${props.fileName}`
      : '';
  const windowCaption = `${rigid ? 'Mặt đường cứng BTXM (TCCS 39:2022/TCĐBVN)' : 'Áo đường mềm (TCCS 38:2022/TCĐBVN)'}${titleSuffix}${props.dirty ? ' *' : ''}`;
  const theme = props.theme ?? 'light';

  return (
    <div className="adm-ribbon" ref={rootRef}>
      {/* Unified LEDAT-BIM Header Bar */}
      <header className="hdr adm-hdr">
        <div className="brand">
          <span className="logo" aria-hidden="true">
            <BrandMark />
          </span>
          <div>
            <b>
              LEDAT-<span className="wm-g">BIM</span>
            </b>
            <small>{rigid ? 'Kiểm toán mặt đường cứng · TCCS 39:2022' : 'Kiểm toán áo đường · TCCS 38:2022'}</small>
          </div>
        </div>

        <ModuleSwitch current="toando" />

        <div className="adm-hdr-meta">
          <div className="adm-window-title-wrap">
            <div
              ref={titleRef}
              className={`adm-window-title ${props.onChangePavementKind ? 'adm-window-title-pick' : ''}`}
              data-testid="window-title"
              title={props.onChangePavementKind ? `${windowCaption} — bấm để đổi loại mặt đường` : windowCaption}
              role={props.onChangePavementKind ? 'button' : undefined}
              tabIndex={props.onChangePavementKind ? 0 : undefined}
              aria-haspopup={props.onChangePavementKind ? 'menu' : undefined}
              aria-expanded={props.onChangePavementKind ? kindMenuOpen : undefined}
              onClick={() => props.onChangePavementKind && setKindMenuOpen((v) => !v)}
              onKeyDown={(e) => {
                if (props.onChangePavementKind && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  setKindMenuOpen((v) => !v);
                }
              }}
            >
              {windowCaption}
            </div>
            {kindMenuOpen &&
              props.onChangePavementKind &&
              titleRef.current &&
              createPortal(
              <div
                className="adm-title-menu"
                role="menu"
                data-testid="title-kind-menu"
                style={(() => {
                  const r = titleRef.current?.getBoundingClientRect();
                  return r
                    ? {
                        left: Math.max(8, Math.min(r.left, window.innerWidth - 360)),
                        top: r.bottom + 4,
                      }
                    : undefined;
                })()}
              >
                {(
                  [
                    ['MEM', 'Áo đường mềm (TCCS 38:2022/TCĐBVN)'],
                    ['CUNG', 'Mặt đường cứng BTXM (TCCS 39:2022/TCĐBVN)'],
                  ] as Array<[PavementKind, string]>
                ).map(([kind, label]) => (
                  <button
                    key={kind}
                    type="button"
                    role="menuitemradio"
                    aria-checked={(props.loaiMat ?? 'MEM') === kind}
                    data-testid={`title-kind-${kind === 'MEM' ? 'mem' : 'cung'}`}
                    className={`adm-title-menu-item ${(props.loaiMat ?? 'MEM') === kind ? 'active' : ''}`}
                    onClick={() => {
                      setKindMenuOpen(false);
                      if ((props.loaiMat ?? 'MEM') !== kind) props.onChangePavementKind?.(kind);
                    }}
                  >
                    <span className="adm-title-menu-check">{(props.loaiMat ?? 'MEM') === kind ? '✓' : ''}</span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>,
              titleRef.current.closest('.adm-shell') ?? document.body,
            )}
          </div>
        </div>

        <div className="adm-titlebar-actions">
          <button
            id="bTheme"
            type="button"
            className="ibtn"
            aria-pressed={theme === 'dark'}
            aria-label="Đổi giao diện sáng / tối"
            title={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
            onClick={props.onToggleTheme}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
        </div>
      </header>

      {/* Floating-Glass Ribbon Deck */}
      <div className="adm-ribbon-deck">
        <div className="adm-ribbon-topbar">
          {/* Application Menu Button */}
          <button
            type="button"
            className="adm-orb-btn"
            aria-label="Menu ứng dụng"
            aria-expanded={appMenuOpen}
            title="Menu File (ADM ver 2.0)"
            onClick={() => {
              setAppMenuOpen((v) => !v);
              setSaveMenuPos(null);
              setVlMenuPos(null);
            }}
          >
            <img src={UI_ICONS.appOrb} alt="ADM" />
            <span>Tệp ▾</span>
          </button>

          {/* Quick Access Toolbar */}
          <div className="adm-qat" aria-label="Quick Access Toolbar">
            <button
              type="button"
              className="adm-qat-btn"
              title="Dự án mới (Ctrl+N)"
              onClick={props.onNewProject}
            >
              <img src={UI_ICONS.newSmall} alt="Mới" />
            </button>
            <button
              type="button"
              className="adm-qat-btn"
              title="Mở file .ADM (Ctrl+O)"
              onClick={props.onOpenProjectFile}
            >
              <img src={UI_ICONS.openSmall} alt="Mở" />
            </button>
            <button
              type="button"
              className="adm-qat-btn"
              title="Lưu dự án (Ctrl+S)"
              onClick={props.onSaveProject}
            >
              <img src={UI_ICONS.saveSmall} alt="Lưu" />
            </button>
          </div>

          {/* Ribbon Tab Strip */}
          <nav className="adm-ribbon-tabs" aria-label="Ribbon tabs">
            <button
              type="button"
              className={`adm-ribbon-tab ${props.activeRibbonTab === 'HOME' ? 'active' : ''}`}
              onClick={() => selectRibbonTab('HOME')}
            >
              HOME
            </button>
            <button
              type="button"
              className={`adm-ribbon-tab ${props.activeRibbonTab === 'TOOLS' ? 'active' : ''}`}
              onClick={() => selectRibbonTab('TOOLS')}
            >
              CÔNG CỤ
            </button>
            <button
              type="button"
              className={`adm-ribbon-tab ${props.activeRibbonTab === 'HELP' ? 'active' : ''}`}
              onClick={() => selectRibbonTab('HELP')}
            >
              GIÚP ĐỠ
            </button>
          </nav>

          {props.onToggleMobileTree && (
            <button
              type="button"
              className="adm-mobile-tree-btn"
              aria-label="Mở cây điều hướng dự án"
              onClick={props.onToggleMobileTree}
            >
              <Icon name="sidebar" size={14} />
              <span>Cây dự án</span>
            </button>
          )}

          <div className="adm-topbar-right">
            {/* Ví dụ mẫu: nằm cùng hàng với thanh Tệp/Ribbon để header chỉ còn một hàng (menu Tệp vẫn có đủ các ví dụ). */}
            <div className="adm-topbar-samples">
              {rigid && props.onLoadSampleRigidProject ? (
                <>
                  <button
                    type="button"
                    className="adm-sample-pill"
                    data-testid="btn-load-sample-b1"
                    title="Nạp nhanh ví dụ B.1 Phụ lục B (TCCS 39:2022/TCĐBVN): tấm 23 cm trên móng CPĐD, đường cấp IV"
                    onClick={() => props.onLoadSampleRigidProject?.('B1')}
                  >
                    Ví dụ B.1
                  </button>
                  <button
                    type="button"
                    className="adm-sample-pill adm-sample-pill-ch10"
                    data-testid="btn-load-sample-b2"
                    title="Nạp nhanh ví dụ B.2 Phụ lục B (TCCS 39:2022/TCĐBVN): tấm 26 cm trên móng CPĐD gia cố xi măng, đường cấp III"
                    onClick={() => props.onLoadSampleRigidProject?.('B2')}
                  >
                    Ví dụ B.2
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="adm-sample-pill"
                  data-testid="btn-load-sample"
                  title="Nạp nhanh dự án mẫu Phụ lục D (D.1 Ví dụ I — TCCS 38:2022/TCĐBVN)"
                  onClick={props.onLoadSampleProject}
                >
                  Ví dụ mẫu
                </button>
              )}
              {!rigid && props.onLoadSampleRehabProject && (
                <button
                  type="button"
                  className="adm-sample-pill adm-sample-pill-ch10"
                  data-testid="btn-load-sample-ch10"
                  title="Nạp nhanh dự án mẫu Thiết kế tăng cường, cải tạo áo đường cũ (Chương 10 — TCCS 38:2022/TCĐBVN)"
                  onClick={() => props.onLoadSampleRehabProject?.('overlay')}
                >
                  Ví dụ cải tạo
                </button>
              )}
            </div>
            {collapsed && (
            <button
              type="button"
              className="adm-topbar-run"
              data-testid="btn-run-quick"
              disabled={props.isRunning}
              title="Chạy kiểm toán (F5)"
              onClick={props.onRunVerification}
            >
              <img src={UI_ICONS.runLarge} alt="" />
              <span>Chạy kiểm toán</span>
              <kbd>F5</kbd>
            </button>
            )}
            <button
              type="button"
              className="adm-ribbon-collapse"
              data-testid="btn-ribbon-collapse"
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Mở rộng thanh công cụ' : 'Thu gọn thanh công cụ'}
              title={collapsed ? 'Mở rộng thanh công cụ' : 'Thu gọn thanh công cụ để có thêm chỗ làm việc'}
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? '▾' : '▴'}
            </button>
          </div>
        </div>

        {/* Application Menu Popup */}
        {appMenuOpen && (
          <div className="adm-appmenu" role="menu">
            <button
              type="button"
              className="adm-appmenu-item"
              onClick={() => {
                setAppMenuOpen(false);
                props.onNewProject();
              }}
            >
              <img src={UI_ICONS.newLarge} alt="" />
              <span>Mới (Dự án mới)</span>
              <span className="adm-appmenu-shortcut">Ctrl+N</span>
            </button>
            <button
              type="button"
              className="adm-appmenu-item"
              onClick={() => {
                setAppMenuOpen(false);
                props.onOpenProjectFile();
              }}
            >
              <img src={UI_ICONS.openLarge} alt="" />
              <span>Mở (.adm / .json)...</span>
              <span className="adm-appmenu-shortcut">Ctrl+O</span>
            </button>
            <button
              type="button"
              className="adm-appmenu-item"
              onClick={() => {
                setAppMenuOpen(false);
                props.onSaveProject();
              }}
            >
              <img src={UI_ICONS.saveLarge} alt="" />
              <span>Lưu</span>
              <span className="adm-appmenu-shortcut">Ctrl+S</span>
            </button>
            <button
              type="button"
              className="adm-appmenu-item"
              onClick={() => {
                setAppMenuOpen(false);
                props.onSaveProjectAs();
              }}
            >
              <img src={UI_ICONS.saveAsLarge} alt="" />
              <span>Lưu với tên khác...</span>
              <span className="adm-appmenu-shortcut">Ctrl+Shift+S</span>
            </button>
            <div className="adm-appmenu-sep" />
            <button
              type="button"
              className="adm-appmenu-item"
              onClick={() => {
                setAppMenuOpen(false);
                props.onLoadSampleProject();
              }}
            >
              <img src={UI_ICONS.kcadLarge} alt="" />
              <span>Nạp ví dụ mẫu (TCCS 38:2022)</span>
            </button>
            {props.onLoadSampleRehabProject && (
              <button
                type="button"
                className="adm-appmenu-item"
                onClick={() => {
                  setAppMenuOpen(false);
                  props.onLoadSampleRehabProject?.('overlay');
                }}
              >
                <img src={UI_ICONS.datNenLarge} alt="" />
                <span>Nạp ví dụ cải tạo (Ch.10)</span>
              </button>
            )}
            {props.onLoadSampleRigidProject &&
              (
                [
                  ['B1', 'menu-sample-rigid', 'Nạp ví dụ B.1 mặt đường cứng (TCCS 39:2022)'],
                  ['B2', 'menu-sample-rigid-b2', 'Nạp ví dụ B.2 mặt đường cứng (TCCS 39:2022)'],
                ] as const
              ).map(([variant, tid, label]) => (
                <button
                  key={variant}
                  type="button"
                  className="adm-appmenu-item"
                  data-testid={tid}
                  onClick={() => {
                    setAppMenuOpen(false);
                    props.onLoadSampleRigidProject?.(variant);
                  }}
                >
                  <img src={UI_ICONS.kcadLarge} alt="" />
                  <span>{label}</span>
                </button>
              ))}
            <div className="adm-appmenu-sep" />
            <button
              type="button"
              className="adm-appmenu-item"
              onClick={() => {
                setAppMenuOpen(false);
                props.onCloseProject();
              }}
            >
              <img src={UI_ICONS.closeLarge} alt="" />
              <span>Đóng</span>
            </button>
          </div>
        )}

        {/* Ribbon Body */}
        {!collapsed && (
        <div className="adm-ribbon-strip" ref={stripRef}>
          {props.activeRibbonTab === 'HOME' && (
            <>
              {/* Group: File */}
              <div className="adm-rib-group">
                <div className="adm-rib-group-body">
                  <button
                    type="button"
                    className="adm-rib-large-btn"
                    title="Mở file dự án lưu trên đĩa với phần mở rộng .ADM (Ctrl+O)"
                    onClick={props.onOpenProjectFile}
                  >
                    <img src={UI_ICONS.openLarge} alt="" />
                    <span>Mở file</span>
                  </button>

                  <div className="adm-rib-dropdown-wrap">
                    <button
                      ref={saveBtnRef}
                      type="button"
                      className="adm-rib-large-btn"
                      aria-expanded={Boolean(saveMenuPos)}
                      title="Lưu dự án đang làm xuống đĩa (Ctrl+S)"
                      onClick={() => {
                        setVlMenuPos(null);
                        setSaveMenuPos((prev) => (prev ? null : computePopupPos(saveBtnRef.current)));
                      }}
                    >
                      <img src={UI_ICONS.saveSubLarge} alt="" />
                      <span>Lưu ▾</span>
                    </button>
                    {saveMenuPos && (
                      <div
                        className="adm-rib-submenu"
                        style={{ left: saveMenuPos.left, top: saveMenuPos.top }}
                      >
                        <button
                          type="button"
                          className="adm-rib-small-btn"
                          onClick={() => {
                            setSaveMenuPos(null);
                            props.onSaveProject();
                          }}
                        >
                          <img src={UI_ICONS.saveSmall} alt="" />
                          <span>Lưu dự án (Ctrl+S)</span>
                        </button>
                        <button
                          type="button"
                          className="adm-rib-small-btn"
                          onClick={() => {
                            setSaveMenuPos(null);
                            props.onSaveProjectAs();
                          }}
                        >
                          <img src={UI_ICONS.saveAsSmall} alt="" />
                          <span>Lưu với tên khác...</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="adm-rib-col-stack">
                    <button
                      type="button"
                      className="adm-rib-small-btn"
                      title="Khởi tạo một dự án mới (Ctrl+N)"
                      onClick={props.onNewProject}
                    >
                      <img src={UI_ICONS.newSmall} alt="" />
                      <span>Dự án mới</span>
                    </button>
                    <button
                      type="button"
                      className="adm-rib-small-btn"
                      title="Đóng file đang mở"
                      onClick={props.onCloseProject}
                    >
                      <img src={UI_ICONS.closeSmall} alt="" />
                      <span>Đóng file</span>
                    </button>
                    <button
                      type="button"
                      className="adm-rib-small-btn"
                      title="Đóng dự án hiện tại"
                      onClick={props.onCloseProject}
                    >
                      <img src={UI_ICONS.exitSmall} alt="" />
                      <span>Thoát</span>
                    </button>
                  </div>
                </div>
                <div className="adm-rib-group-label">File</div>
              </div>

              {/* Group: Nhập dữ liệu */}
              <div className="adm-rib-group">
                <div className="adm-rib-group-body">
                  <button
                    type="button"
                    className={`adm-rib-large-btn ${props.activePageTab === 'thong-tin' ? 'active' : ''}`}
                    onClick={() => props.onSelectPageTab('thong-tin')}
                  >
                    <img src={UI_ICONS.projectInfoLarge} alt="" />
                    <span>Thông tin dự án</span>
                  </button>
                  <button
                    type="button"
                    className={`adm-rib-large-btn ${props.activePageTab === 'quy-mo' ? 'active' : ''}`}
                    onClick={() => props.onSelectPageTab('quy-mo')}
                  >
                    <img src={UI_ICONS.quymoLarge} alt="" />
                    <span>Quy mô thiết kế</span>
                  </button>
                  {!rigid && (
                    <button
                      type="button"
                      className={`adm-rib-large-btn ${props.activePageTab === 'luu-luong' ? 'active' : ''}`}
                      onClick={() => props.onSelectPageTab('luu-luong')}
                    >
                      <img src={UI_ICONS.xeLarge} alt="" />
                      <span>Thành phần xe</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className={`adm-rib-large-btn ${props.activePageTab === 'dat-nen' ? 'active' : ''}`}
                    onClick={() => props.onSelectPageTab('dat-nen')}
                  >
                    <img src={UI_ICONS.datNenLarge} alt="" />
                    <span>Đất nền</span>
                  </button>
                  {!rigid && props.loaiTK === 'CAI_TAO' && (
                    <button
                      type="button"
                      data-testid="rib-btn-ao-duong-cu"
                      className={`adm-rib-large-btn ${props.activePageTab === 'ao-duong-cu' ? 'active' : ''}`}
                      onClick={() => props.onSelectPageTab('ao-duong-cu')}
                    >
                      <img src={UI_ICONS.datNenLarge} alt="" />
                      <span>Áo đường cũ</span>
                    </button>
                  )}
                  {!rigid && (
                    <button
                      type="button"
                      className={`adm-rib-large-btn ${props.activePageTab === 'thong-so' ? 'active' : ''}`}
                      onClick={() => props.onSelectPageTab('thong-so')}
                    >
                      <img src={UI_ICONS.kcadLarge} alt="" />
                      <span>Chọn kết cấu</span>
                    </button>
                  )}
                  {rigid &&
                    (
                      [
                        ['cung-giao-thong', 'Tải trọng trục', UI_ICONS.xeLarge],
                        ['cung-ket-cau', 'Kết cấu tấm BTXM', UI_ICONS.kcadLarge],
                        ['cung-khe-noi', 'Khe nối', UI_ICONS.kcadLarge],
                        ['cung-thoat-nuoc', 'Thoát nước', UI_ICONS.datNenLarge],
                      ] as const
                    ).map(([tabKey, caption, icon]) => (
                      <button
                        key={tabKey}
                        type="button"
                        data-testid={`rib-btn-${tabKey}`}
                        className={`adm-rib-large-btn ${props.activePageTab === tabKey ? 'active' : ''}`}
                        onClick={() => props.onSelectPageTab(tabKey)}
                      >
                        <img src={icon} alt="" />
                        <span>{caption}</span>
                      </button>
                    ))}
                </div>
                <div className="adm-rib-group-label">Nhập dữ liệu</div>
              </div>

              {/* Group: Phương án áo đường (chỉ mặt đường mềm) */}
              {!rigid && (
              <div className="adm-rib-group">
                <div className="adm-rib-group-body">
                  <button
                    type="button"
                    className="adm-rib-large-btn"
                    title="Thêm một phương án kết cấu áo đường mới"
                    onClick={props.onAddAlternative}
                  >
                    <img src={UI_ICONS.themPaLarge} alt="" />
                    <span>Thêm phương án kết cấu</span>
                  </button>
                  <div className="adm-rib-col-stack">
                    <button
                      type="button"
                      className="adm-rib-small-btn"
                      disabled={props.alternatives.length <= 1}
                      title="Xóa phương án đang chọn"
                      onClick={props.onDeleteAlternative}
                    >
                      <img src={UI_ICONS.xoaPaSmall} alt="" />
                      <span>Xóa phương án</span>
                    </button>
                    <button
                      type="button"
                      className="adm-rib-small-btn"
                      title="Sửa tên phương án đang chọn"
                      onClick={props.onRenameAlternative}
                    >
                      <img src={UI_ICONS.suaPaSmall} alt="" />
                      <span>Sửa phương án</span>
                    </button>
                    <div className="adm-rib-combo-row">
                      <span>P. án:</span>
                      <select
                        aria-label="Chọn nhanh phương án"
                        value={props.activeAlternativeId}
                        onChange={(e) => props.onSelectAlternative(e.target.value)}
                      >
                        {props.alternatives.map((alt) => (
                          <option key={alt.id} value={alt.id}>
                            {alt.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="adm-rib-group-label">Phương án áo đường</div>
              </div>
              )}

              {/* Group: Kiểm toán */}
              <div className="adm-rib-group">
                <div className="adm-rib-group-body">
                  <button
                    type="button"
                    className="adm-rib-large-btn"
                    data-testid="btn-run-verification"
                    disabled={props.isRunning}
                    title="Chạy kiểm toán tất cả phương án (F5)"
                    onClick={props.onRunVerification}
                  >
                    <img src={UI_ICONS.runLarge} alt="" />
                    <span>Chạy kiểm toán</span>
                  </button>
                </div>
                <div className="adm-rib-group-label">Kiểm toán</div>
              </div>

              {/* Group: Xuất kết quả */}
              <div className="adm-rib-group">
                <div className="adm-rib-group-body">
                  <button
                    type="button"
                    className="adm-rib-large-btn"
                    data-testid="btn-export-excel"
                    title="Xuất kết quả kiểm toán sang Excel"
                    onClick={props.onOpenExportExcel}
                  >
                    <img src={UI_ICONS.exportExcelLarge} alt="" />
                    <span>Xuất k.quả sang Excel</span>
                  </button>
                </div>
                <div className="adm-rib-group-label">Xuất kết quả</div>
              </div>
            </>
          )}

          {props.activeRibbonTab === 'TOOLS' && (
            <>
              {!rigid && (
              <div className="adm-rib-group">
                <div className="adm-rib-group-body">
                  {(
                    [
                      ['td-31', 'Toán đồ Hình 2', UI_ICONS.td31Large],
                      ['td-32', 'Toán đồ Hình 4', UI_ICONS.td32Large],
                      ['td-33', 'Toán đồ Hình 5', UI_ICONS.td33Large],
                      ['td-34', 'Toán đồ Hình 6', UI_ICONS.td34Large],
                      ['td-35', 'Toán đồ Hình 7', UI_ICONS.td35Large],
                      ['td-36', 'Toán đồ Hình 8', UI_ICONS.td36Large],
                    ] as const
                  ).map(([tabKey, caption, icon]) => (
                    <button
                      key={tabKey}
                      type="button"
                      className={`adm-rib-large-btn ${props.activePageTab === tabKey ? 'active' : ''}`}
                      onClick={() => props.onSelectPageTab(tabKey)}
                    >
                      <img src={icon} alt="" />
                      <span>{caption}</span>
                    </button>
                  ))}
                </div>
                <div className="adm-rib-group-label">Tra toán đồ</div>
              </div>
              )}

              <div className="adm-rib-group">
                <div className="adm-rib-group-body">
                  <div className="adm-rib-dropdown-wrap">
                    <button
                      type="button"
                      className={`adm-rib-large-btn ${props.activePageTab === 'sua-vat-lieu' ? 'active' : ''}`}
                      onClick={() => props.onOpenMaterialDbTab()}
                    >
                      <img src={UI_ICONS.loadVlLarge} alt="" />
                      <span>Load database vật liệu</span>
                    </button>
                  </div>
                  <div className="adm-rib-dropdown-wrap">
                    <button
                      ref={vlBtnRef}
                      type="button"
                      className="adm-rib-large-btn"
                      aria-expanded={Boolean(vlMenuPos)}
                      onClick={() => {
                        setSaveMenuPos(null);
                        setVlMenuPos((prev) => (prev ? null : computePopupPos(vlBtnRef.current)));
                      }}
                    >
                      <img src={UI_ICONS.saveVlLarge} alt="" />
                      <span>Lưu database vật liệu ▾</span>
                    </button>
                    {vlMenuPos && (
                      <div
                        className="adm-rib-submenu"
                        style={{ left: vlMenuPos.left, top: vlMenuPos.top }}
                      >
                        <button
                          type="button"
                          className="adm-rib-small-btn"
                          onClick={() => {
                            setVlMenuPos(null);
                            props.onSaveVatLieuFile();
                          }}
                        >
                          <img src={UI_ICONS.saveSmall} alt="" />
                          <span>Xuất file VatLieu.dat</span>
                        </button>
                        <button
                          type="button"
                          className="adm-rib-small-btn"
                          onClick={() => {
                            setVlMenuPos(null);
                            props.onLoadVatLieuFile();
                          }}
                        >
                          <img src={UI_ICONS.openSmall} alt="" />
                          <span>Nạp từ file VatLieu.dat...</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="adm-rib-group-label">Data vật liệu</div>
              </div>
            </>
          )}

          {props.activeRibbonTab === 'HELP' && (
            <div className="adm-rib-group">
              <div className="adm-rib-group-body">
                <button
                  type="button"
                  className="adm-rib-large-btn"
                  onClick={props.onOpenTieuChuan}
                >
                  <img src={UI_ICONS.tieuChuanLarge} alt="" />
                  <span>{rigid ? 'TCCS 39:2022' : 'TCCS 38:2022'}</span>
                </button>
              </div>
              <div className="adm-rib-group-label">Giúp đỡ</div>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
