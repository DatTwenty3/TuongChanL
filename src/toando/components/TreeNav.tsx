import React, { useState } from 'react';
import { TREE_ICONS } from '../assets/iconRegistry';
import type { MainTabKey } from '../state/navigation';
import type {
  AlternativeVerificationResult,
  DesignKindType,
  FullVerificationResult,
  PavementAlternative,
  PavementKind,
} from '../types/project';

export interface TreeNavProps {
  widthPx: number;
  loaiTK?: DesignKindType;
  /** 'CUNG' → cây điều hướng mặt đường cứng BTXM (TCCS 39:2022). */
  loaiMat?: PavementKind;
  /** Kết quả tổng hợp kiểm toán tấm BTXM (undefined = chưa có). */
  rigidPassed?: boolean;
  activePageTab: MainTabKey;
  alternatives: PavementAlternative[];
  activeAlternativeId: string;
  verification: FullVerificationResult | null;
  selectedShearTargetId: string | null;
  selectedFlexuralLayerId: string | null;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  onSelectInputTab: (tab: MainTabKey) => void;
  onSelectAlternativeStructure: (altId: string) => void;
  onSelectDeflection: (altId: string) => void;
  onSelectShearTarget: (altId: string, targetId: string | null) => void;
  onSelectFlexuralLayer: (altId: string, layerId: string | null) => void;
}

function statusIcon(passed: boolean | undefined, fallback: string): string {
  if (passed === true) return TREE_ICONS.checkGreen;
  if (passed === false) return TREE_ICONS.crossRed;
  return fallback;
}

export function TreeNav({
  widthPx,
  loaiTK = 'TK_MOI',
  loaiMat = 'MEM',
  rigidPassed,
  activePageTab,
  alternatives,
  activeAlternativeId,
  verification,
  selectedShearTargetId,
  selectedFlexuralLayerId,
  mobileOpen = false,
  onCloseMobile,
  onSelectInputTab,
  onSelectAlternativeStructure,
  onSelectDeflection,
  onSelectShearTarget,
  onSelectFlexuralLayer,
}: TreeNavProps): React.ReactElement {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    kcad: true,
    results: true,
  });

  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }));

  const isExpanded = (key: string) => expanded[key] ?? true;

  const inputNodes: Array<{ key: MainTabKey; label: string; icon: string }> = [
    { key: 'thong-tin', label: 'Thông tin dự án', icon: TREE_ICONS.docInfo },
    { key: 'quy-mo', label: 'Quy mô thiết kế', icon: TREE_ICONS.docInfo },
    { key: 'luu-luong', label: 'Lưu lượng xe và quy đổi', icon: TREE_ICONS.trafficCal },
    { key: 'dat-nen', label: 'Đất nền', icon: TREE_ICONS.pavementLayers },
    ...(loaiTK === 'CAI_TAO'
      ? [
          {
            key: 'ao-duong-cu' as MainTabKey,
            label: 'Áo đường cũ (Chương 10)',
            icon: TREE_ICONS.pavementLayers,
          },
        ]
      : []),
    { key: 'thong-so', label: 'Thông số thiết kế áo đường', icon: TREE_ICONS.curveChart },
  ];

  if (loaiMat === 'CUNG') {
    const rigidInputs: Array<{ key: MainTabKey; label: string; icon: string }> = [
      { key: 'thong-tin', label: 'Thông tin dự án', icon: TREE_ICONS.docInfo },
      { key: 'quy-mo', label: 'Quy mô thiết kế', icon: TREE_ICONS.docInfo },
      { key: 'dat-nen', label: 'Đất nền', icon: TREE_ICONS.pavementLayers },
      { key: 'cung-giao-thong', label: 'Tải trọng trục và Ne', icon: TREE_ICONS.trafficCal },
      { key: 'cung-ket-cau', label: 'Kết cấu tấm BTXM', icon: TREE_ICONS.gridAdd },
      { key: 'cung-khe-noi', label: 'Khe nối', icon: TREE_ICONS.pavementLayers },
    ];
    return (
      <aside
        className={`adm-tree-pane ${mobileOpen ? 'open' : ''}`}
        style={{ width: `${widthPx}px` }}
        aria-label="Cây điều hướng dự án"
        data-testid="tree-rigid"
      >
        <div className="adm-tree-head">
          <span>Cây điều hướng — Mặt đường cứng</span>
          {onCloseMobile && (
            <button
              type="button"
              className="adm-tree-close"
              aria-label="Đóng cây điều hướng"
              onClick={onCloseMobile}
            >
              ✕
            </button>
          )}
        </div>
        <div className="adm-tree-scroll" role="tree">
          {rigidInputs.map((n) => (
            <div
              key={n.key}
              role="treeitem"
              aria-selected={activePageTab === n.key}
              className={`adm-tree-node ${activePageTab === n.key ? 'selected' : ''}`}
              onClick={() => {
                onSelectInputTab(n.key);
                onCloseMobile?.();
              }}
            >
              <span className="adm-tree-toggle-spacer" />
              <img className="adm-tree-icon" src={n.icon} alt="" />
              <span>{n.label}</span>
            </div>
          ))}
          <div
            role="treeitem"
            aria-selected={activePageTab === 'cung-kiem-toan'}
            className={`adm-tree-node ${activePageTab === 'cung-kiem-toan' ? 'selected' : ''}`}
            data-testid="tree-rigid-result"
            onClick={() => {
              onSelectInputTab('cung-kiem-toan');
              onCloseMobile?.();
            }}
          >
            <span className="adm-tree-toggle-spacer" />
            <img
              className="adm-tree-icon"
              src={statusIcon(rigidPassed, TREE_ICONS.curveChart)}
              alt=""
            />
            <span>Kết quả kiểm toán tấm BTXM</span>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={`adm-tree-pane ${mobileOpen ? 'open' : ''}`}
      style={{ width: `${widthPx}px` }}
      aria-label="Cây điều hướng dự án"
    >
      <div className="adm-tree-head">
        <span>Cây điều hướng</span>
        {onCloseMobile && (
          <button
            type="button"
            className="adm-tree-close"
            aria-label="Đóng cây điều hướng"
            onClick={onCloseMobile}
          >
            ✕
          </button>
        )}
      </div>
      <div className="adm-tree-scroll" role="tree">
        {inputNodes.map((n) => (
          <div
            key={n.key}
            role="treeitem"
            aria-selected={activePageTab === n.key}
            className={`adm-tree-node ${activePageTab === n.key ? 'selected' : ''}`}
            onClick={() => {
              onSelectInputTab(n.key);
              onCloseMobile?.();
            }}
          >
            <span className="adm-tree-toggle-spacer" />
            <img className="adm-tree-icon" src={n.icon} alt="" />
            <span>{n.label}</span>
          </div>
        ))}

        {/* Branch: Kết cấu áo đường */}
        <div>
          <div
            role="treeitem"
            aria-expanded={isExpanded('kcad')}
            className="adm-tree-node"
            onClick={() => toggle('kcad')}
          >
            <span className="adm-tree-toggle">{isExpanded('kcad') ? '−' : '+'}</span>
            <img
              className="adm-tree-icon"
              src={isExpanded('kcad') ? TREE_ICONS.folderOpen : TREE_ICONS.folderClosed}
              alt=""
            />
            <span>Kết cấu áo đường</span>
          </div>
          {isExpanded('kcad') &&
            alternatives.map((alt) => {
              const selected = activePageTab === 'ket-cau' && activeAlternativeId === alt.id;
              return (
                <div
                  key={alt.id}
                  role="treeitem"
                  aria-selected={selected}
                  className={`adm-tree-node ${selected ? 'selected' : ''}`}
                  style={{ paddingLeft: '22px' }}
                  onClick={() => {
                    onSelectAlternativeStructure(alt.id);
                    onCloseMobile?.();
                  }}
                >
                  <span className="adm-tree-toggle-spacer" />
                  <img className="adm-tree-icon" src={TREE_ICONS.gridAdd} alt="" />
                  <span>Kết cấu áo đường - {alt.name}</span>
                </div>
              );
            })}
        </div>

        {/* Branch: Kết quả kiểm toán */}
        <div>
          <div
            role="treeitem"
            aria-expanded={isExpanded('results')}
            className="adm-tree-node"
            onClick={() => toggle('results')}
          >
            <span className="adm-tree-toggle">{isExpanded('results') ? '−' : '+'}</span>
            <img
              className="adm-tree-icon"
              src={isExpanded('results') ? TREE_ICONS.folderOpen : TREE_ICONS.folderClosed}
              alt=""
            />
            <span>Kết quả kiểm toán</span>
          </div>

          {isExpanded('results') &&
            alternatives.map((alt) => {
              const altRes: AlternativeVerificationResult | undefined =
                verification?.alternatives[alt.id];
              const altKey = `res-${alt.id}`;
              const shearKey = `shear-${alt.id}`;
              const flexKey = `flex-${alt.id}`;

              return (
                <div key={alt.id}>
                  <div
                    role="treeitem"
                    aria-expanded={isExpanded(altKey)}
                    className="adm-tree-node"
                    style={{ paddingLeft: '20px' }}
                    onClick={() => toggle(altKey)}
                  >
                    <span className="adm-tree-toggle">{isExpanded(altKey) ? '−' : '+'}</span>
                    <img
                      className="adm-tree-icon"
                      src={statusIcon(altRes?.allPassed, TREE_ICONS.folderAlt)}
                      alt=""
                    />
                    <span>{alt.name}</span>
                  </div>

                  {isExpanded(altKey) && (
                    <div>
                      {/* Độ võng đàn hồi */}
                      <div
                        role="treeitem"
                        aria-selected={activePageTab === 'vong' && activeAlternativeId === alt.id}
                        className={`adm-tree-node ${
                          activePageTab === 'vong' && activeAlternativeId === alt.id ? 'selected' : ''
                        }`}
                        style={{ paddingLeft: '38px' }}
                        onClick={() => {
                          onSelectDeflection(alt.id);
                          onCloseMobile?.();
                        }}
                      >
                        <span className="adm-tree-toggle-spacer" />
                        <img
                          className="adm-tree-icon"
                          src={statusIcon(altRes?.allDeflectionPassed, TREE_ICONS.curveChart)}
                          alt=""
                        />
                        <span>Độ võng đàn hồi</span>
                      </div>

                      {/* Cắt trượt */}
                      <div>
                        <div
                          role="treeitem"
                          aria-expanded={isExpanded(shearKey)}
                          aria-selected={
                            activePageTab === 'truot' &&
                            activeAlternativeId === alt.id &&
                            selectedShearTargetId === null
                          }
                          className={`adm-tree-node ${
                            activePageTab === 'truot' &&
                            activeAlternativeId === alt.id &&
                            selectedShearTargetId === null
                              ? 'selected'
                              : ''
                          }`}
                          style={{ paddingLeft: '38px' }}
                          onClick={() => {
                            onSelectShearTarget(alt.id, null);
                            onCloseMobile?.();
                          }}
                        >
                          <span
                            className="adm-tree-toggle"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggle(shearKey);
                            }}
                          >
                            {isExpanded(shearKey) ? '−' : '+'}
                          </span>
                          <img
                            className="adm-tree-icon"
                            src={statusIcon(
                              altRes?.shearApplicable ? altRes.allShearPassed : undefined,
                              TREE_ICONS.curveChart,
                            )}
                            alt=""
                          />
                          <span>Cắt trượt</span>
                        </div>

                        {isExpanded(shearKey) &&
                          (altRes?.shearTargets ?? []).map((t) => {
                            const sel =
                              activePageTab === 'truot' &&
                              activeAlternativeId === alt.id &&
                              selectedShearTargetId === t.targetId;
                            return (
                              <div
                                key={t.targetId}
                                role="treeitem"
                                aria-selected={sel}
                                className={`adm-tree-node ${sel ? 'selected' : ''}`}
                                style={{ paddingLeft: '56px' }}
                                onClick={() => {
                                  onSelectShearTarget(alt.id, t.targetId);
                                  onCloseMobile?.();
                                }}
                              >
                                <span className="adm-tree-toggle-spacer" />
                                <img
                                  className="adm-tree-icon"
                                  src={statusIcon(t.passed, TREE_ICONS.arrowSub)}
                                  alt=""
                                />
                                <span>
                                  {t.isSubgrade ? 'Đất nền' : `Cắt trượt: ${t.targetName}`}
                                </span>
                              </div>
                            );
                          })}
                      </div>

                      {/* Kéo uốn */}
                      <div>
                        <div
                          role="treeitem"
                          aria-expanded={isExpanded(flexKey)}
                          aria-selected={
                            activePageTab === 'keo-uon' &&
                            activeAlternativeId === alt.id &&
                            selectedFlexuralLayerId === null
                          }
                          className={`adm-tree-node ${
                            activePageTab === 'keo-uon' &&
                            activeAlternativeId === alt.id &&
                            selectedFlexuralLayerId === null
                              ? 'selected'
                              : ''
                          }`}
                          style={{ paddingLeft: '38px' }}
                          onClick={() => {
                            onSelectFlexuralLayer(alt.id, null);
                            onCloseMobile?.();
                          }}
                        >
                          <span
                            className="adm-tree-toggle"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggle(flexKey);
                            }}
                          >
                            {isExpanded(flexKey) ? '−' : '+'}
                          </span>
                          <img
                            className="adm-tree-icon"
                            src={statusIcon(
                              altRes?.flexuralApplicable ? altRes.allFlexuralPassed : undefined,
                              TREE_ICONS.curveChart,
                            )}
                            alt=""
                          />
                          <span>Kéo uốn</span>
                        </div>

                        {isExpanded(flexKey) &&
                          (altRes?.flexuralLayers ?? []).map((fl) => {
                            const sel =
                              activePageTab === 'keo-uon' &&
                              activeAlternativeId === alt.id &&
                              selectedFlexuralLayerId === fl.layerId;
                            return (
                              <div
                                key={fl.layerId}
                                role="treeitem"
                                aria-selected={sel}
                                className={`adm-tree-node ${sel ? 'selected' : ''}`}
                                style={{ paddingLeft: '56px' }}
                                onClick={() => {
                                  onSelectFlexuralLayer(alt.id, fl.layerId);
                                  onCloseMobile?.();
                                }}
                              >
                                <span className="adm-tree-toggle-spacer" />
                                <img
                                  className="adm-tree-icon"
                                  src={statusIcon(fl.passed, TREE_ICONS.arrowSub)}
                                  alt=""
                                />
                                <span>Kéo uốn: {fl.layerName}</span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </aside>
  );
}
