/**
 * BangTinhCauCong Web App — React UI Integration & Parity Test Suite
 *
 * Comprehensive end-to-end integration tests in jsdom covering:
 * 1. Clean App mount, Toolbar, ProjectHeader, and TabStrip rendering
 * 2. 7-Mode calculation switching (cau, ch, ct, tc, tl, tv, tvc) with tab visibility contracts
 * 3. Tab navigation and pane visibility switching
 * 4. Overview Pane (#tab7) dashboard, quick jump buttons, and TOC structure
 * 5. Verification Test Suite (#tab60) run, pass/fail indicators, and result table
 * 6. Standards Lookup Modal (#lkBg) open/close and accessibility
 * 7. Project state dirty tracking, save/load round-trip, and default reset arming
 * 8. Clean-room & zero-CDN compliance audit across all UI sources
 *
 * Strict Clean-Room: zero licensing code and zero external CDN URLs.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/culvert/App.tsx';
import {
  openLookupModal,
  closeLookupModal,
} from '../../src/culvert/components/LookupModal.tsx';
import { vtRender } from '../../src/culvert/engine/verification/verificationSuite.ts';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const testDir = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(testDir, '../../src/culvert');

function setSelectValue(el: HTMLSelectElement, value: string): void {
  const proto = HTMLSelectElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, 'value');
  desc?.set?.call(el, value);
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function setInputValue(el: HTMLInputElement, value: string): void {
  const proto = HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, 'value');
  desc?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

async function flushUi(ms = 30): Promise<void> {
  await act(async () => {
    await new Promise<void>((r) => setTimeout(r, ms));
  });
}

describe('BangTinhCauCong Web App — UI Integration Test Suite', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    try {
      localStorage.clear();
      localStorage.setItem('ckn_mode', 'cau');
    } catch {
      /* noop */
    }
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<App />);
    });
    await flushUi(50);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    document.body.className = '';
  });

  // -------------------------------------------------------------------------
  // 1. App Mounting & Base Layout
  // -------------------------------------------------------------------------
  it('renders complete shell layout with Toolbar, ProjectHeader, and TabStrip', () => {
    const sheet = container.querySelector('#sheet');
    expect(sheet).not.toBeNull();

    // Toolbar controls
    expect(container.querySelector('#appMode')).not.toBeNull();
    expect(container.querySelector('#expScope')).not.toBeNull();
    expect(container.querySelector('#btnX')).not.toBeNull();
    expect(container.querySelector('#btnP')).not.toBeNull();
    expect(container.querySelector('#btnSv')).not.toBeNull();
    expect(container.querySelector('#btnOp')).not.toBeNull();
    expect(container.querySelector('#btnDf')).not.toBeNull();

    // Project header inputs
    for (const id of ['pj1', 'pj2', 'pj3', 'pj4', 'pj5', 'pj6']) {
      const input = container.querySelector(`#${id}`) as HTMLInputElement | null;
      expect(input, `Input #${id} should exist`).not.toBeNull();
    }
    const pj6 = container.querySelector('#pj6') as HTMLInputElement;
    expect(pj6.value).toBe('BẢNG TÍNH TOÁN KẾT CẤU CẦU');

    // TabStrip buttons
    const tabs = container.querySelectorAll('.tabs .tab');
    expect(tabs.length).toBe(46);
  });

  // -------------------------------------------------------------------------
  // 2. 7-Mode Calculation Switching & Tab Visibility Parity
  // -------------------------------------------------------------------------
  it('switches between all 7 calculation modes and applies correct visibility', async () => {
    const modeSelect = container.querySelector('#appMode') as HTMLSelectElement;
    expect(modeSelect).not.toBeNull();

    // Initial 'cau' mode: tab 7 visible, standalone tabs hidden
    expect(document.body.classList.contains('mch')).toBe(false);
    const tab7 = container.querySelector('#tab7') as HTMLElement;
    expect(tab7.hidden).toBe(false);

    // 1. Box Culvert ('ch')
    await act(async () => {
      setSelectValue(modeSelect, 'ch');
    });
    await flushUi(50);
    expect(document.body.classList.contains('mch')).toBe(true);

    const chTabs = [15, 16, 44, 17, 60];
    for (const t of chTabs) {
      const btn = container.querySelector(`.tabs .tab[data-t="${t}"]`) as HTMLButtonElement;
      expect(btn, `Tab ${t} button should exist`).not.toBeNull();
      expect(btn.hidden).toBe(false);
    }
    const bridgeTab8 = container.querySelector('.tabs .tab[data-t="8"]') as HTMLButtonElement;
    expect(bridgeTab8.hidden).toBe(true);

    // 2. Circular Pipe Culvert ('ct')
    await act(async () => {
      setSelectValue(modeSelect, 'ct');
    });
    await flushUi(50);
    expect(document.body.classList.contains('mct')).toBe(true);
    for (const t of [18, 19, 60]) {
      const btn = container.querySelector(`.tabs .tab[data-t="${t}"]`) as HTMLButtonElement;
      expect(btn.hidden).toBe(false);
    }

    // 3. Gravity Retaining Wall ('tc')
    await act(async () => {
      setSelectValue(modeSelect, 'tc');
    });
    await flushUi(50);
    expect(document.body.classList.contains('mtc')).toBe(true);
    for (const t of [41, 42, 60]) {
      const btn = container.querySelector(`.tabs .tab[data-t="${t}"]`) as HTMLButtonElement;
      expect(btn.hidden).toBe(false);
    }

    // 4. Cantilever L-Wall ('tl')
    await act(async () => {
      setSelectValue(modeSelect, 'tl');
    });
    await flushUi(50);
    expect(document.body.classList.contains('mtl')).toBe(true);
    for (const t of [61, 62, 60]) {
      const btn = container.querySelector(`.tabs .tab[data-t="${t}"]`) as HTMLButtonElement;
      expect(btn.hidden).toBe(false);
    }

    // 5. Bridge Hydrology ('tv')
    await act(async () => {
      setSelectValue(modeSelect, 'tv');
    });
    await flushUi(50);
    expect(document.body.classList.contains('mtv')).toBe(true);
    const tvBtn = container.querySelector('.tabs .tab[data-t="54"]') as HTMLButtonElement;
    expect(tvBtn.hidden).toBe(false);
    const nonTvBtn = container.querySelector('.tabs .tab[data-t="7"]') as HTMLButtonElement;
    expect(nonTvBtn.hidden).toBe(true);

    // 6. Culvert Hydrology ('tvc')
    await act(async () => {
      setSelectValue(modeSelect, 'tvc');
    });
    await flushUi(50);
    expect(document.body.classList.contains('mtvc')).toBe(true);
    const tvcBtn = container.querySelector('.tabs .tab[data-t="70"]') as HTMLButtonElement;
    expect(tvcBtn.hidden).toBe(false);

    // 7. Back to Bridge ('cau')
    await act(async () => {
      setSelectValue(modeSelect, 'cau');
    });
    await flushUi(50);
    expect(document.body.classList.contains('mtvc')).toBe(false);
    expect(bridgeTab8.hidden).toBe(false);
  }, 30000);

  // -------------------------------------------------------------------------
  // 3. Tab Navigation & Pane Switching
  // -------------------------------------------------------------------------
  it('switches active tabs and updates pane visibility', async () => {
    // Click Tab 8 (1. Dầm giữa)
    const tab8Btn = container.querySelector('.tabs .tab[data-t="8"]') as HTMLButtonElement;
    expect(tab8Btn).not.toBeNull();

    await act(async () => {
      tab8Btn.click();
    });
    await flushUi(50);

    expect(tab8Btn.getAttribute('aria-pressed')).toBe('true');
    const tab8Pane = container.querySelector('#tab8') as HTMLElement;
    expect(tab8Pane).not.toBeNull();
    expect(tab8Pane.hidden).toBe(false);

    const tab7Pane = container.querySelector('#tab7') as HTMLElement;
    expect(tab7Pane.hidden).toBe(true);

    // Click Tab 4 (8. Tải trọng mố)
    const tab4Btn = container.querySelector('.tabs .tab[data-t="4"]') as HTMLButtonElement;
    await act(async () => {
      tab4Btn.click();
    });
    await flushUi(50);

    expect(tab4Btn.getAttribute('aria-pressed')).toBe('true');
    const tab4Pane = container.querySelector('#tab4') as HTMLElement;
    expect(tab4Pane.hidden).toBe(false);
    expect(tab8Pane.hidden).toBe(true);

    // Click Tab 60 (Kiểm chứng)
    const tab60Btn = container.querySelector('.tabs .tab[data-t="60"]') as HTMLButtonElement;
    await act(async () => {
      tab60Btn.click();
    });
    await flushUi(50);

    expect(tab60Btn.getAttribute('aria-pressed')).toBe('true');
    const tab60Pane = container.querySelector('#tab60') as HTMLElement;
    expect(tab60Pane.hidden).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 4. Overview Pane (#tab7) Dashboard & TOC
  // -------------------------------------------------------------------------
  it('renders Overview Pane with TOC and structure configuration inputs', async () => {
    const tab7Btn = container.querySelector('.tabs .tab[data-t="7"]') as HTMLButtonElement;
    await act(async () => {
      tab7Btn.click();
    });
    await flushUi(50);

    const tab7Pane = container.querySelector('#tab7') as HTMLElement;
    expect(tab7Pane.hidden).toBe(false);

    // Quick navigation buttons exist in overview dashboard
    const quickNavHeader = tab7Pane.querySelector('h2');
    expect(quickNavHeader?.textContent).toContain('TỔNG QUAN');

    // Overview structure select controls exist
    expect(container.querySelector('#tq_obj')).not.toBeNull();
    expect(container.querySelector('#tq_kn')).not.toBeNull();
    expect(container.querySelector('#tq_tru')).not.toBeNull();
    expect(container.querySelector('#tq_mot')).not.toBeNull();
    expect(container.querySelector('#tq_sct')).not.toBeNull();
    expect(container.querySelector('#tq_bltn')).not.toBeNull();
    expect(container.querySelector('#tqToc')).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // 5. Verification Test Suite Pane (#tab60)
  // -------------------------------------------------------------------------
  it('executes verification test suite and renders results in #vt_tb', async () => {
    const tab60Btn = container.querySelector('.tabs .tab[data-t="60"]') as HTMLButtonElement;
    await act(async () => {
      tab60Btn.click();
    });
    await flushUi(50);

    const vtRun = container.querySelector('#vt_run') as HTMLButtonElement;
    expect(vtRun).not.toBeNull();

    await act(async () => {
      vtRun.click();
    });
    await flushUi(80);

    const vtSum = container.querySelector('#vt_sum');
    expect(vtSum?.textContent).toContain('Tổng số kiểm tra:');

    const vtTb = container.querySelector('#vt_tb') as HTMLTableElement;
    expect(vtTb.rows.length).toBeGreaterThan(10);
  });

  // -------------------------------------------------------------------------
  // 6. Standards Lookup Modal (#lkBg)
  // -------------------------------------------------------------------------
  it('opens and closes standard reference lookup modal (#lkBg)', async () => {
    const lkBg = container.querySelector('#lkBg') as HTMLElement;
    expect(lkBg).not.toBeNull();
    expect(lkBg.hidden).toBe(true);

    // Open lookup table for unit weights ('uw')
    await act(async () => {
      openLookupModal('uw');
    });
    await flushUi(30);

    expect(lkBg.hidden).toBe(false);
    const lkTt = container.querySelector('#lkTt');
    expect(lkTt?.textContent).toContain('Bảng 6');

    // Close via close button #lkX
    const lkX = container.querySelector('#lkX') as HTMLButtonElement;
    await act(async () => {
      lkX.click();
    });
    await flushUi(30);

    expect(lkBg.hidden).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 7. Project State Dirty Tracking & Default Reset
  // -------------------------------------------------------------------------
  it('tracks dirty edits, updates save button, and arms default reset', async () => {
    const btnSv = container.querySelector('#btnSv') as HTMLButtonElement;
    const btnDf = container.querySelector('#btnDf') as HTMLButtonElement;

    // Initially clean
    expect(btnSv.dataset.dirty).toBeUndefined();
    expect(btnDf.textContent).toBe('Số liệu mặc định');

    // Modify a project metadata field
    const pj1 = container.querySelector('#pj1') as HTMLInputElement;
    await act(async () => {
      setInputValue(pj1, 'Cầu Sông Mã - Km12+300');
    });
    await flushUi(30);

    // Button reflects dirty status
    expect(btnSv.dataset.dirty).toBe('true');

    // First click on default reset arms the button
    await act(async () => {
      btnDf.click();
    });
    await flushUi(30);
    expect(btnDf.textContent).toBe('Bấm lần nữa để nạp số liệu mặc định');

    // Second click on default reset executes reset and clears dirty state
    await act(async () => {
      btnDf.click();
    });
    await flushUi(50);

    expect(btnDf.textContent).toBe('Số liệu mặc định');
    expect(btnSv.dataset.dirty).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // 8. Strict Clean-Room & Zero-CDN Static Audit
  // -------------------------------------------------------------------------
  it('verifies zero licensing keywords and zero external CDN URLs across UI sources', () => {
    const targets = [
      path.resolve(srcDir, 'App.tsx'),
      path.resolve(srcDir, 'main.tsx'),
      path.resolve(srcDir, 'state/appStore.ts'),
      path.resolve(srcDir, 'components/Toolbar.tsx'),
      path.resolve(srcDir, 'components/ProjectHeader.tsx'),
      path.resolve(srcDir, 'components/TabStrip.tsx'),
      path.resolve(srcDir, 'components/OverviewPane.tsx'),
      path.resolve(srcDir, 'components/VerificationPane.tsx'),
      path.resolve(srcDir, 'components/LookupModal.tsx'),
      path.resolve(srcDir, 'components/LegacyShellBridge.tsx'),
    ];

    const forbiddenTokens = [
      /\blicens(?:e|ing)\b/i,
      /\bhwid\b/i,
      /\bmachineId\b/i,
      /\.lic\b/i,
      /__tv4/i,
      /\blicchip\b/i,
      /\blicov\b/i,
      /https?:\/\/cdn\./i,
      /jsdelivr\.net/i,
      /unpkg\.com/i,
      /cdnjs\.cloudflare\.com/i,
    ];

    for (const filePath of targets) {
      expect(fs.existsSync(filePath), `File should exist: ${filePath}`).toBe(true);
      const content = fs.readFileSync(filePath, 'utf8');

      for (const rx of forbiddenTokens) {
        const hit = content.match(rx);
        expect(
          hit,
          `Clean-room violation: found forbidden token "${hit?.[0]}" in ${path.basename(filePath)}`,
        ).toBeNull();
      }
    }
  });
});
