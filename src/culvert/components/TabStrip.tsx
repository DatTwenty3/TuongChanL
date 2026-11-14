import React from 'react';
import {
  IT_TAB,
  OBJ_TABS,
  type AppMode,
  type ItemKey,
  type ObjScope,
  type TabId,
} from '../types/project';

export interface TabDefinition {
  id: TabId;
  baseClasses: string;
  defaultLabel: string;
  domId?: string;
}

/**
 * Complete ordered 46-tab registry matching `shell.html:14-53` verbatim.
 */
export const TAB_DEFINITIONS: readonly TabDefinition[] = [
  { id: 7, baseClasses: 'tab tcau', defaultLabel: '0. Tổng quan' },
  { id: 54, baseClasses: 'tab thv', defaultLabel: 'Thủy văn cầu' },
  { id: 70, baseClasses: 'tab ttvc', defaultLabel: 'Thủy văn cống' },
  { id: 8, baseClasses: 'tab tcau', defaultLabel: '1. Dầm giữa' },
  { id: 9, baseClasses: 'tab tcau', defaultLabel: '2. Dầm biên' },
  { id: 10, baseClasses: 'tab tcau', defaultLabel: '3. Bản mặt cầu' },
  { id: 11, baseClasses: 'tab tcau', defaultLabel: '4. Gối cầu' },
  { id: 12, baseClasses: 'tab tcau', defaultLabel: '5. Bản liên tục nhiệt' },
  { id: 13, baseClasses: 'tab tcau', defaultLabel: '6. Khe co giãn' },
  { id: 14, baseClasses: 'tab tcau', defaultLabel: '7. Gờ lan can' },
  { id: 4, baseClasses: 'tab tcau', defaultLabel: '8. Tải trọng, tổ hợp mố' },
  { id: 5, baseClasses: 'tab tcau', defaultLabel: '9. Kiểm toán mặt cắt mố' },
  { id: 1, baseClasses: 'tab tcau', defaultLabel: '10. Nội lực đầu cọc' },
  { id: 52, baseClasses: 'tab tcau tsfm', defaultLabel: '10. Kiểm toán nền móng nông' },
  { id: 6, baseClasses: 'tab tcau', defaultLabel: '11. Kiểm toán bệ cọc' },
  { id: 2, baseClasses: 'tab tcau', defaultLabel: '12. Sức chịu tải cọc theo đất nền' },
  { id: 56, baseClasses: 'tab tcau tsct2', defaultLabel: '12b. Sức chịu tải cọc mố M2' },
  { id: 3, baseClasses: 'tab tcau', defaultLabel: '13. Kiểm toán cọc theo vật liệu' },
  { id: 20, baseClasses: 'tab ttr tdc', defaultLabel: '14. Tải trọng, tổ hợp trụ' },
  { id: 21, baseClasses: 'tab ttr', defaultLabel: '15. Nội lực trụ' },
  { id: 22, baseClasses: 'tab ttr', defaultLabel: '16. Kiểm toán xà mũ, giằng' },
  { id: 26, baseClasses: 'tab ttr', defaultLabel: '17. Kiểm toán thân trụ theo vật liệu' },
  { id: 23, baseClasses: 'tab ttr', defaultLabel: '18. Nội lực cọc trụ' },
  { id: 24, baseClasses: 'tab ttr', defaultLabel: '19. Sức chịu tải cọc trụ theo đất nền' },
  { id: 57, baseClasses: 'tab ttr tsct2', defaultLabel: '19b. Sức chịu tải cọc trụ T2' },
  { id: 25, baseClasses: 'tab ttr', defaultLabel: '20. Kiểm toán cọc trụ theo vật liệu' },
  { id: 46, baseClasses: 'tab tdc', defaultLabel: '15. Kiểm toán xà mũ trụ' },
  { id: 47, baseClasses: 'tab tdc', defaultLabel: '16. Kiểm toán thân trụ' },
  { id: 49, baseClasses: 'tab tdc', defaultLabel: '17. Nội lực đầu cọc trụ' },
  { id: 53, baseClasses: 'tab tdc tsfd', defaultLabel: '17. Kiểm toán nền móng nông trụ' },
  { id: 48, baseClasses: 'tab tdc', defaultLabel: '18. Kiểm toán bệ trụ' },
  { id: 50, baseClasses: 'tab tdc', defaultLabel: '19. Sức chịu tải cọc trụ theo đất nền' },
  { id: 58, baseClasses: 'tab tdc tsct2', defaultLabel: '19b. Sức chịu tải cọc trụ T2' },
  { id: 51, baseClasses: 'tab tdc', defaultLabel: '20. Kiểm toán cọc trụ theo vật liệu' },
  { id: 43, baseClasses: 'tab tcau', defaultLabel: '21. Bản quá độ', domId: 'qdTabBtn' },
  { id: 15, baseClasses: 'tab tch', defaultLabel: '1. Số liệu, tải trọng, nội lực' },
  { id: 16, baseClasses: 'tab tch', defaultLabel: '2. Kiểm toán mặt cắt' },
  { id: 44, baseClasses: 'tab tch', defaultLabel: '3. Kiểm toán nền móng' },
  { id: 17, baseClasses: 'tab tch', defaultLabel: 'Phụ lục 1. Hệ số nền' },
  { id: 41, baseClasses: 'tab ttc', defaultLabel: '1. Số liệu, tải trọng' },
  { id: 42, baseClasses: 'tab ttc', defaultLabel: '2. Kiểm toán' },
  { id: 61, baseClasses: 'tab ttl', defaultLabel: '1. Số liệu, tải trọng' },
  { id: 62, baseClasses: 'tab ttl', defaultLabel: '2. Kiểm toán' },
  { id: 18, baseClasses: 'tab tct', defaultLabel: '1. Số liệu, tải trọng, nội lực' },
  { id: 19, baseClasses: 'tab tct', defaultLabel: '2. Cốt thép và kiểm toán' },
  { id: 60, baseClasses: 'tab tvt', defaultLabel: 'Kiểm chứng' },
];

export interface TabStripVisibilityConfig {
  mode: AppMode;
  objScope?: ObjScope;
  disabledItems?: readonly ItemKey[];
  multiSpan?: boolean;
  pierType?: 'deo' | 'dac';
  abutmentType?: 'nang' | 'deo';
  abutmentFoundation?: 'coc' | 'nong';
  solidPierFoundation?: 'coc' | 'nong';
  separateSct?: boolean;
  directSeating?: boolean;
  linkSlabEnabled?: boolean;
  abutmentNamesRaw?: string;
  pierNamesRaw?: string;
}

export interface TabStripProps extends TabStripVisibilityConfig {
  activeTab: TabId;
  onSelectTab: (tabId: TabId) => void;
}

const STANDALONE_VISIBLE_TABS: Readonly<Record<Exclude<AppMode, 'cau'>, readonly TabId[]>> = {
  ch: [15, 16, 44, 17, 60],
  ct: [18, 19, 60],
  tc: [41, 42, 60],
  tl: [61, 62, 60],
  tv: [54],
  tvc: [70],
};

const BRIDGE_COMMON_TABS = new Set<TabId>([8, 9, 10, 11, 12, 13, 14, 4, 5, 6, 43]);

export function parseSctPair(
  raw: string | undefined,
  defaults: readonly [string, string],
): [string, string] {
  const parts = String(raw ?? '')
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const first = parts[0] || defaults[0];
  const second =
    parts[1] || (parts[0] && parts[0] !== defaults[0] ? `${parts[0]} (2)` : defaults[1]);
  return [first, second];
}

export function isTabItemDisabled(tabId: TabId, disabledItems: readonly ItemKey[] = []): boolean {
  const key = IT_TAB[tabId];
  return Boolean(key && disabledItems.includes(key));
}

export function getTabVisibility(tabId: TabId, config: TabStripVisibilityConfig): boolean {
  const {
    mode,
    objScope = 'all',
    disabledItems = [],
    multiSpan = true,
    pierType = 'deo',
    abutmentType = 'nang',
    abutmentFoundation = 'coc',
    solidPierFoundation = 'coc',
    separateSct = false,
  } = config;

  if (mode !== 'cau') {
    return STANDALONE_VISIBLE_TABS[mode].includes(tabId);
  }

  if (tabId === 7 || tabId === 60) {
    return true;
  }

  if (objScope !== 'all' && !OBJ_TABS[objScope].includes(tabId)) {
    return false;
  }

  if (isTabItemDisabled(tabId, disabledItems)) {
    return false;
  }

  const sfmOn = abutmentFoundation === 'nong' && abutmentType !== 'deo';
  const trOn = multiSpan && pierType === 'deo';
  const dcOn = multiSpan && pierType === 'dac';
  const sfdOn = solidPierFoundation === 'nong' && dcOn;

  if (BRIDGE_COMMON_TABS.has(tabId)) {
    return true;
  }
  if (tabId === 1 || tabId === 2 || tabId === 3) {
    return !sfmOn;
  }
  if (tabId === 52) {
    return sfmOn;
  }
  if (tabId === 56) {
    return !sfmOn && separateSct;
  }
  if (tabId === 20) {
    return trOn || dcOn;
  }
  if (tabId === 21 || tabId === 22 || tabId === 26 || tabId === 23 || tabId === 24 || tabId === 25) {
    return trOn;
  }
  if (tabId === 57) {
    return trOn && separateSct;
  }
  if (tabId === 46 || tabId === 47 || tabId === 48) {
    return dcOn;
  }
  if (tabId === 49 || tabId === 50 || tabId === 51) {
    return dcOn && !sfdOn;
  }
  if (tabId === 53) {
    return dcOn && sfdOn;
  }
  if (tabId === 58) {
    return dcOn && !sfdOn && separateSct;
  }

  return false;
}

export function getVisibleTabIds(config: TabStripVisibilityConfig): TabId[] {
  return TAB_DEFINITIONS.filter((def) => getTabVisibility(def.id, config)).map((def) => def.id);
}

export function getTabLabel(tabId: TabId, config: TabStripVisibilityConfig): string {
  const {
    multiSpan = true,
    pierType = 'deo',
    abutmentType = 'nang',
    abutmentFoundation = 'coc',
    separateSct = false,
    directSeating = false,
    abutmentNamesRaw = 'M1, M2',
    pierNamesRaw = 'T1',
  } = config;

  const def = TAB_DEFINITIONS.find((d) => d.id === tabId);
  const fallback = def?.defaultLabel ?? '';

  if (tabId === 11) {
    return directSeating ? '4. Kê dầm trên mố, trụ' : '4. Gối cầu';
  }

  if (tabId === 6) {
    if (abutmentType === 'deo') {
      return '11. Kiểm toán bệ mố';
    }
    return abutmentFoundation === 'nong' ? '11. Kiểm toán bệ móng' : '11. Kiểm toán bệ cọc';
  }

  if (tabId === 43) {
    const trOrDc = multiSpan && (pierType === 'deo' || pierType === 'dac');
    return `${trOrDc ? '21' : '14'}. Bản quá độ`;
  }

  if (separateSct) {
    const [m0, m1] = parseSctPair(abutmentNamesRaw, ['M1', 'M2']);
    const [t0, t1] = parseSctPair(pierNamesRaw, ['T1', 'T2']);
    if (tabId === 2) return `12. Sức chịu tải cọc mố ${m0}`;
    if (tabId === 56) return `12b. Sức chịu tải cọc mố ${m1}`;
    if (tabId === 24 || tabId === 50) return `19. Sức chịu tải cọc trụ ${t0}`;
    if (tabId === 57 || tabId === 58) return `19b. Sức chịu tải cọc trụ ${t1}`;
  }

  return fallback;
}

/** Nhóm hiển thị trong cột mục (chỉ để điều hướng; không ảnh hưởng engine). */
const TAB_GROUP_OF: Readonly<Record<number, string>> = (() => {
  const g: Record<number, string> = {};
  const set = (name: string, ids: readonly number[]) => ids.forEach((i) => (g[i] = name));
  set('Tổng quan', [7]);
  set('Thủy văn thủy lực', [54, 70]);
  set('Kết cấu nhịp', [8, 9, 10, 11, 12, 13, 14]);
  set('Mố', [4, 5, 1, 52, 6, 2, 56, 3]);
  set('Trụ', [20, 21, 22, 26, 23, 24, 57, 25, 46, 47, 49, 53, 48, 50, 58, 51]);
  set('Bản quá độ', [43]);
  set('Cống hộp BTCT', [15, 16, 44, 17]);
  set('Cống tròn BTCT', [18, 19]);
  set('Tường chắn trọng lực', [41, 42]);
  set('Tường chắn chữ L', [61, 62]);
  set('Kiểm chứng', [60]);
  return g;
})();

export function TabStrip(props: TabStripProps) {
  const { activeTab, onSelectTab, disabledItems = [] } = props;

  // Nhóm nào có ít nhất một tab đang hiện thì mới vẽ tiêu đề nhóm
  const visibleGroups = new Set<string>();
  for (const def of TAB_DEFINITIONS) {
    if (getTabVisibility(def.id, props)) visibleGroups.add(TAB_GROUP_OF[def.id] ?? '');
  }
  let prevGroup = '';

  return (
    <div className="tabs noprint" role="tablist">
      {TAB_DEFINITIONS.map((def) => {
        const visible = getTabVisibility(def.id, props);
        const disabled = props.mode === 'cau' && isTabItemDisabled(def.id, disabledItems);
        const className = disabled ? `${def.baseClasses} xoff` : def.baseClasses;
        const label = getTabLabel(def.id, props);

        const group = TAB_GROUP_OF[def.id] ?? '';
        const header =
          group && group !== prevGroup && visibleGroups.has(group) ? (
            <div key={'g-' + def.id} className="tgrp" aria-hidden="true">
              {group}
            </div>
          ) : null;
        prevGroup = group || prevGroup;

        return (
          <React.Fragment key={def.id}>
            {header}
            <button
              id={def.domId}
              type="button"
              className={className}
              data-t={def.id}
              aria-pressed={activeTab === def.id}
              hidden={!visible}
              onClick={() => onSelectTab(def.id)}
            >
              {label}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
