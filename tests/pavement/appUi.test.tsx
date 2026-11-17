// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Landing } from '../../src/landing/Landing';
import { App } from '../../src/pavement/App';
import { MODULES, ModuleSwitch } from '../../src/shared/ModuleSwitch';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const text = (rel: string) => readFileSync(path.join(webRoot, rel), 'utf8');

describe('Phân hệ Mặt đường (TCCS 37/38/39) trong site LEDAT-BIM', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    window.scrollTo = () => {};
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('hiển thị mặc định TCCS 39 với ModuleSwitch LEDAT-BIM và dropdown TCVN', async () => {
    await act(async () => root.render(<App />));
    expect(container.querySelector('.stdnav-photo, #stdNav img')).toBeNull();
    expect(container.querySelector('.stdbtn[data-std="39"]')?.classList.contains('active')).toBe(true);
    expect(container.querySelector('#mod-rigid')?.hasAttribute('hidden')).toBe(false);
    expect(container.querySelector('#overall')?.textContent).toContain('KẾT CẤU ĐẠT YÊU CẦU theo TCCS 39');

    // Shared ModuleSwitch highlights pavement
    const activeMod = container.querySelector('.modsw a[data-mod="pavement"]');
    expect(activeMod?.getAttribute('aria-current')).toBe('page');

    const btnTcvn = container.querySelector('#btnTCVN') as HTMLButtonElement;
    const menu = container.querySelector('#tcvnMenu') as HTMLDivElement;
    expect(menu.hidden).toBe(true);
    await act(async () => btnTcvn.click());
    expect(menu.hidden).toBe(false);
  });

  it('chuyển đổi giữ sáng/tối đồng bộ qua localStorage tuong-chan-btct:theme', async () => {
    localStorage.setItem('tuong-chan-btct:theme', 'dark');
    await act(async () => root.render(<App />));
    expect(document.documentElement.dataset.theme).toBe('dark');

    const btnTheme = container.querySelector('#bTheme') as HTMLButtonElement;
    await act(async () => btnTheme.click());
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('tuong-chan-btct:theme')).toBe('light');
  });

  it('chuyển tab TCCS 39 (Drain/Joint), TCCS 38, và TCCS 37 (New/Overlay/Low)', async () => {
    await act(async () => root.render(<App />));

    await act(async () => (container.querySelector('.tab[data-tab="drain"]') as HTMLButtonElement).click());
    expect(container.querySelector('#mod-drain')?.hasAttribute('hidden')).toBe(false);
    expect((container.querySelector('#exportBtns') as HTMLElement).style.display).toBe('none');

    await act(async () => (container.querySelector('.stdbtn[data-std="38"]') as HTMLButtonElement).click());
    expect(container.querySelector('#mod-flex')?.hasAttribute('hidden')).toBe(false);
    expect((container.querySelector('#subTabs') as HTMLElement).style.display).toBe('none');
    expect(container.querySelectorAll('.shearTaxp').length).toBe(2);
    expect(container.querySelector('#f_echVal')?.textContent).toBe('198,5');
    expect(container.querySelector('#f_echManual')).toBeNull();
    expect(container.querySelector('#f_echModeAuto')?.classList.contains('active')).toBe(true);

    // Pick a value from Hình 2 nomogram lookup table & reset back to (E.1)
    const highPick = [...container.querySelectorAll<HTMLButtonElement>('#f_echLookup .nomo-pick')].find(
      (btn) => parseFloat((btn.textContent ?? '').replace(',', '.')) >= 225,
    );
    expect(highPick).toBeTruthy();
    await act(async () => highPick!.click());
    expect(container.querySelector('#f_echManual')).not.toBeNull();
    expect(container.querySelector('#f_echModeManual')?.classList.contains('active')).toBe(true);
    expect(container.querySelector('#f_tc1out .vcard')?.classList.contains('pass')).toBe(true);

    await act(async () => (container.querySelector('#f_echModeAuto') as HTMLButtonElement).click());
    expect(container.querySelector('#f_echVal')?.textContent).toBe('198,5');
    expect(container.querySelector('#f_echManual')).toBeNull();

    await act(async () => (container.querySelector('.stdbtn[data-std="37"]') as HTMLButtonElement).click());
    expect(container.querySelector('#mod-sn37')?.hasAttribute('hidden')).toBe(false);
    expect(container.querySelector('#g_out_new')?.hasAttribute('hidden')).toBe(false);

    await act(async () => (container.querySelector('.g-sub[data-sub="ol"]') as HTMLButtonElement).click());
    expect(container.querySelector('#g_out_ol')?.hasAttribute('hidden')).toBe(false);
    expect(container.querySelector('#g_ol_result')?.textContent).toContain('5,7');

    await act(async () => (container.querySelector('.g-sub[data-sub="low"]') as HTMLButtonElement).click());
    expect(container.querySelector('#g_out_low')?.hasAttribute('hidden')).toBe(false);
    expect(container.querySelector('#g_low_sn')?.textContent).toContain('2,4–2,6');
  });

  it('hỗ trợ tìm bề dày tối thiểu và lưu so sánh phương án', async () => {
    await act(async () => root.render(<App />));

    await act(async () => (container.querySelector('#btnMin') as HTMLButtonElement).click());
    expect(container.querySelector('#minRes')?.textContent).toContain('Tối thiểu');

    await act(async () => (container.querySelector('#saveOpt') as HTMLButtonElement).click());
    expect(container.querySelector('#compare table.cmp')).not.toBeNull();
    expect(container.querySelector('#compare table.cmp')?.textContent).toContain('MH2');
  });

  it('trang chủ có thẻ Mặt đường trỏ tới mat-duong/ và cấu hình MPA đã nối đủ', async () => {
    await act(async () => root.render(<Landing />));
    const cards = [...container.querySelectorAll<HTMLAnchorElement>('.lp-card')];
    expect(cards.map((c) => c.dataset.mod)).toEqual(['walls', 'culvert', 'hoga', 'pavement']);
    expect(cards[3].getAttribute('href')).toMatch(/mat-duong\/$/);

    expect(MODULES.map((m) => m.id)).toEqual(['walls', 'culvert', 'hoga', 'pavement']);
    await act(async () => root.render(<ModuleSwitch current="pavement" />));
    expect(container.querySelector('a[data-mod="pavement"]')?.getAttribute('aria-current')).toBe('page');

    expect(text('mat-duong/index.html')).toContain('/src/pavement/main.tsx');
    const vite = text('vite.config.ts');
    expect(vite).toContain("pavement: page('./mat-duong/index.html')");
    expect(vite).toContain('mat-duong');
    expect(text('vercel.json')).toContain('"/mat-duong"');
  });
});
