import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { foldVi, matchQuery } from '../src/components/CommandPalette';
import { resetEngineCaches, setCalcDec as setEngineCalcDec } from '../src/engine';
import { setCalcDec as setReportDec } from '../src/reports';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const DRAFT_KEY = 'tuong-chan-btct:draft';
const THEME_KEY = 'tuong-chan-btct:theme';

function setInputValue(el: HTMLInputElement, value: string): void {
  const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  desc?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

async function flushUi(ms = 40): Promise<void> {
  await act(async () => {
    await new Promise<void>((r) => setTimeout(r, ms));
  });
}

function key(init: KeyboardEventInit): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));
}

describe('Nâng cấp giao diện: hoàn tác, bảng lệnh, giao diện tối, bản nháp', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  const kpi = (): Array<string | null> =>
    Array.from(container.querySelectorAll('#sum .card')).map((c) => c.textContent);
  const q = <T extends HTMLElement>(sel: string): T => container.querySelector(sel) as T;

  async function mountApp(): Promise<void> {
    root = createRoot(container);
    await act(async () => {
      root!.render(<App />);
    });
  }

  function unmountApp(): void {
    if (root) {
      act(() => {
        root!.unmount();
      });
      root = null;
    }
  }

  beforeEach(() => {
    localStorage.clear();
    resetEngineCaches();
    setEngineCalcDec('.');
    setReportDec('.');
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    if (typeof globalThis.ResizeObserver === 'undefined') {
      class MockResizeObserver {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      }
      (globalThis as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver =
        MockResizeObserver;
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  afterEach(() => {
    unmountApp();
    container.remove();
    vi.restoreAllMocks();
    localStorage.clear();
    resetEngineCaches();
    setEngineCalcDec('.');
    setReportDec('.');
  });

  it('tìm không dấu: foldVi / matchQuery', () => {
    expect(foldVi('Bề dày bản đáy')).toBe('be day ban day');
    expect(matchQuery('Bề dày bản đáy', 'ban day')).toBe(true);
    expect(matchQuery('Bề dày bản đáy', 'day  BE')).toBe(true);
    expect(matchQuery('Bề dày thân tường – đỉnh', 'ban day')).toBe(false);
    expect(matchQuery('Xuất DXF', '')).toBe(true);
  });

  it('hoàn tác / làm lại bằng nút và phím tắt, gộp các lần gõ liên tiếp', async () => {
    await mountApp();
    const bUndo = q<HTMLButtonElement>('#bUndo');
    const bRedo = q<HTMLButtonElement>('#bRedo');
    const base = kpi();
    expect(base[0]).toBe('Bê tông21,50 m³');
    expect(bUndo.disabled).toBe(true);
    expect(bRedo.disabled).toBe(true);

    // Hai lần gõ liên tiếp (< 700 ms) = một bước hoàn tác
    const hInput = q<HTMLInputElement>('#panel input[data-path="H"]');
    await act(async () => {
      setInputValue(hInput, '60');
    });
    await act(async () => {
      setInputValue(hInput, '600');
    });
    const edited = kpi();
    expect(edited[0]).not.toBe(base[0]);
    expect(bUndo.disabled).toBe(false);

    await act(async () => {
      bUndo.click();
    });
    expect(kpi()).toEqual(base);
    expect(bUndo.disabled).toBe(true);
    expect(bRedo.disabled).toBe(false);
    expect(q('#bSave').getAttribute('data-dirty')).toBeNull();

    // Ctrl+Y làm lại, Ctrl+Z hoàn tác (khi không đứng trong ô nhập)
    await act(async () => {
      key({ key: 'y', ctrlKey: true });
    });
    expect(kpi()).toEqual(edited);
    await act(async () => {
      key({ key: 'z', ctrlKey: true });
    });
    expect(kpi()).toEqual(base);

    // Thay đổi mới xóa nhánh làm lại
    await act(async () => {
      key({ key: 'y', ctrlKey: true });
    });
    await flushUi(750);
    await act(async () => {
      setInputValue(hInput, '700');
    });
    expect(bRedo.disabled).toBe(true);
    await act(async () => {
      bUndo.click();
    });
    expect(kpi()).toEqual(edited);
  }, 30000);

  it('bảng lệnh Ctrl+K: lọc, chạy lệnh, phím số đổi tab; vẫn đúng 7 nút tab', async () => {
    await mountApp();
    const shell = q<HTMLElement>('.app-shell');
    expect(container.querySelector('.cmdk')).toBeNull();

    await act(async () => {
      key({ key: 'k', ctrlKey: true });
    });
    expect(container.querySelector('.cmdk')).not.toBeNull();
    const input = q<HTMLInputElement>('#cmdQ');
    await act(async () => {
      setInputValue(input, 'mo hinh 3d');
    });
    const items = Array.from(container.querySelectorAll('.cmdk-item')).map((e) => e.textContent);
    expect(items[0]).toContain('Mô hình 3D');
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(container.querySelector('.cmdk')).toBeNull();
    expect(shell.getAttribute('data-view')).toBe('3d');

    // Tìm thông số theo tên (không dấu): chỉ đúng ô "Bề dày bản đáy" đứng đầu
    await act(async () => {
      key({ key: '1' });
    });
    expect(shell.getAttribute('data-view')).toBe('2d');
    await act(async () => {
      q<HTMLButtonElement>('#bCmd').click();
    });
    await act(async () => {
      setInputValue(q<HTMLInputElement>('#cmdQ'), 'be day ban day');
    });
    const hits = Array.from(container.querySelectorAll('.cmdk-item .cmdk-l')).map((e) => e.textContent);
    expect(hits).toEqual(['Bề dày bản đáy']);
    await act(async () => {
      q<HTMLInputElement>('#cmdQ').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    });
    expect(container.querySelector('.cmdk')).toBeNull();

    await act(async () => {
      key({ key: '7' });
    });
    expect(shell.getAttribute('data-view')).toBe('calc');
    // Thẻ kiểm toán có thanh mức sử dụng nhưng textContent không đổi
    const ck = container.querySelector('#sum .card.ck') as HTMLElement;
    expect(ck.querySelector('.ub > i')).not.toBeNull();
    expect(ck.textContent).toMatch(/^[^\d]+[✓✗!] \d/);

    expect(container.querySelectorAll('#tabs > button').length).toBe(7);
  }, 30000);

  it('giao diện: mặc định sáng, đổi sang tối và ghi nhớ', async () => {
    await mountApp();
    const shell = q<HTMLElement>('.app-shell');
    expect(shell.getAttribute('data-theme')).toBe('light');
    expect(shell.getAttribute('data-view')).toBe('3d');
    await act(async () => {
      q<HTMLButtonElement>('#bTheme').click();
    });
    expect(shell.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');

    unmountApp();
    await mountApp();
    expect(q<HTMLElement>('.app-shell').getAttribute('data-theme')).toBe('dark');
  });

  it('bản nháp tự lưu: ghi khi có thay đổi, khôi phục ở phiên sau, bỏ được', async () => {
    await mountApp();
    expect(container.querySelector('#bRestore')).toBeNull();
    const base = kpi();
    await act(async () => {
      setInputValue(q<HTMLInputElement>('#panel input[data-path="H"]'), '600');
    });
    const edited = kpi();
    await flushUi(950);
    const raw = localStorage.getItem(DRAFT_KEY);
    expect(raw).not.toBeNull();
    const rec = JSON.parse(raw!) as { t: number; data: string };
    expect(JSON.parse(rec.data).app).toBe('tuong-chan-L');

    // Phiên mới: dự án mặc định + nút khôi phục
    unmountApp();
    await mountApp();
    expect(kpi()).toEqual(base);
    const bRestore = q<HTMLButtonElement>('#bRestore');
    expect(bRestore).not.toBeNull();
    await act(async () => {
      bRestore.click();
    });
    expect(kpi()).toEqual(edited);
    expect(container.querySelector('#bRestore')).toBeNull();
    expect(q('#bSave').getAttribute('data-dirty')).toBe('1');
    expect(container.querySelector('#toast')?.classList.contains('ok')).toBe(true);

    // Phiên thứ ba: bỏ bản nháp
    await flushUi(950);
    unmountApp();
    await mountApp();
    await act(async () => {
      q<HTMLButtonElement>('#bDraftX').click();
    });
    expect(container.querySelector('#bRestore')).toBeNull();
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(kpi()).toEqual(base);
  }, 30000);
  it('cừ tràm: bật ở mục 2d → thẻ khối lượng, 3 mục kiểm tra, tab con "Cừ tràm"; tắt thì trở lại như cũ', async () => {
    await mountApp();
    const shell = q<HTMLElement>('.app-shell');
    const base = kpi();
    expect(base.length).toBe(5);
    const sec = Array.from(container.querySelectorAll<HTMLDetailsElement>('#panel details')).find((d) =>
      d.querySelector('summary')?.textContent?.includes('2d. Móng cừ tràm'),
    )!;
    expect(sec).toBeDefined();
    const chk = sec.querySelector<HTMLInputElement>('input[data-path="cu.on"]')!;
    expect(chk.checked).toBe(false);
    await act(async () => {
      chk.click();
    });
    const withCu = kpi();
    expect(withCu.slice(0, 5)).toEqual(base);
    expect(withCu[5]).toBe('Cừ tràm375 cây');
    expect(withCu[6]).toBe('Tổng dài cừ1688 m');
    expect(sec.querySelector('#cuInfo')?.textContent).toContain('15 × 25 = 375 cây');

    await act(async () => {
      key({ key: '7' });
    });
    expect(shell.getAttribute('data-view')).toBe('calc');
    const cards = Array.from(container.querySelectorAll('#sum .card')).map((c) => c.textContent || '');
    expect(cards.filter((t) => t.startsWith('Cừ tràm')).length).toBe(3);
    const tab = Array.from(container.querySelectorAll<HTMLButtonElement>('#calcv .csub button')).find(
      (b) => b.textContent === 'Cừ tràm',
    )!;
    expect(tab).toBeDefined();
    await act(async () => {
      tab.click();
    });
    const sheet = container.querySelector('#calcv .csheet')?.textContent || '';
    expect(sheet).toContain('Móng cừ tràm gia cố nền dưới bản đáy');
    expect(sheet).toContain('Khả năng chịu tải của khối móng cừ tràm');
    expect(sheet).not.toContain('NaN');

    // tắt ở mục 13 của tab Tính toán: thẻ kiểm tra và tab con biến mất
    const sec13 = Array.from(container.querySelectorAll<HTMLDetailsElement>('#panel details')).find((d) =>
      d.querySelector('summary')?.textContent?.includes('13. Móng cừ tràm'),
    )!;
    await act(async () => {
      sec13.querySelector<HTMLInputElement>('input[data-path="cu.on"]')!.click();
    });
    expect(
      Array.from(container.querySelectorAll('#sum .card')).some((c) => (c.textContent || '').startsWith('Cừ tràm')),
    ).toBe(false);
    expect(
      Array.from(container.querySelectorAll('#calcv .csub button')).some((b) => b.textContent === 'Cừ tràm'),
    ).toBe(false);
    await act(async () => {
      key({ key: '1' });
    });
    expect(kpi()).toEqual(base);
  }, 30000);
  it('tính lún: bật ở mục 14 → thẻ "Độ lún cố kết", tab con "Lún", thêm / xóa lớp đất; tắt thì trở lại như cũ', async () => {
    await mountApp();
    await act(async () => {
      key({ key: '7' });
    });
    const cards = (): string[] => Array.from(container.querySelectorAll('#sum .card')).map((c) => c.textContent || '');
    const base = cards();
    const sec = Array.from(container.querySelectorAll<HTMLDetailsElement>('#panel details')).find((d) =>
      d.querySelector('summary')?.textContent?.includes('14. Độ lún cố kết của nền'),
    )!;
    expect(sec).toBeDefined();
    const chk = sec.querySelector<HTMLInputElement>('input[data-path="lun.on"]')!;
    await act(async () => {
      chk.click();
    });
    const withLun = cards();
    expect(withLun.slice(0, base.length)).toEqual(base);
    expect(withLun.length).toBe(base.length + 1);
    expect(withLun[withLun.length - 1].startsWith('Độ lún cố kết')).toBe(true);
    expect(sec.querySelector('#lunRes')?.textContent).toMatch(/Sc = [\d.,]+ cm · S = [\d.,]+ cm/);
    expect(sec.querySelectorAll('[data-lun-layer]').length).toBe(3);

    // thêm rồi xóa một lớp đất
    const addBtn = Array.from(sec.querySelectorAll<HTMLButtonElement>('button.wide')).find((b) =>
      (b.textContent || '').includes('Thêm lớp đất'),
    )!;
    await act(async () => {
      addBtn.click();
    });
    expect(sec.querySelectorAll('[data-lun-layer]').length).toBe(4);
    await act(async () => {
      sec.querySelectorAll<HTMLButtonElement>('[data-lun-layer] .pbtn')[3].click();
    });
    expect(sec.querySelectorAll('[data-lun-layer]').length).toBe(3);

    const tab = Array.from(container.querySelectorAll<HTMLButtonElement>('#calcv .csub button')).find(
      (b) => b.textContent === 'Lún',
    )!;
    expect(tab).toBeDefined();
    await act(async () => {
      tab.click();
    });
    const sheet = container.querySelector('#calcv .csheet')?.textContent || '';
    expect(sheet).toContain('Độ lún cố kết của nền dưới bản đáy');
    expect(sheet).toContain('Dự báo độ lún theo thời gian');
    expect(sheet).not.toContain('NaN');

    await act(async () => {
      chk.click();
    });
    expect(cards()).toEqual(base);
    expect(
      Array.from(container.querySelectorAll('#calcv .csub button')).some((b) => b.textContent === 'Lún'),
    ).toBe(false);
  }, 30000);
});
