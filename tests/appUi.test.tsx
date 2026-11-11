import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { resetEngineCaches, setCalcDec as setEngineCalcDec } from '../src/engine';
import { V3 } from '../src/model3d';
import { setCalcDec as setReportDec } from '../src/reports';

const appCssRaw = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/styles/app.css'),
  'utf8',
);

// Allow React act() in Vitest jsdom
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

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

function setCheckbox(el: HTMLInputElement, checked: boolean): void {
  if (el.checked !== checked) {
    el.click();
  }
}

async function flushUi(ms = 40): Promise<void> {
  await act(async () => {
    await new Promise<void>((r) => setTimeout(r, ms));
  });
}

async function waitForInAct(fn: () => void, timeoutMs = 15000, stepMs = 40): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown;
  while (Date.now() <= deadline) {
    try {
      fn();
      return;
    } catch (e) {
      lastErr = e;
    }
    await flushUi(stepMs);
  }
  fn();
  if (lastErr) throw lastErr;
}

function readBlobText(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') return blob.text();
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result ?? ''));
    fr.onerror = () => reject(fr.error || new Error('FileReader failed'));
    fr.readAsText(blob);
  });
}

function readBlobBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer().then((b) => new Uint8Array(b));
  }
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(new Uint8Array(fr.result as ArrayBuffer));
    fr.onerror = () => reject(fr.error || new Error('FileReader failed'));
    fr.readAsArrayBuffer(blob);
  });
}

describe('TuongChanL Web App UI integration (Easy -> Medium -> Hard -> Special)', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let urlToBlob: Map<string, Blob>;
  let capturedDownloads: Array<{ filename: string; blob: Blob }>;
  let activeFileList: File[] = [];
  let fileInputHooked: WeakSet<HTMLInputElement>;

  beforeEach(() => {
    resetEngineCaches();
    setEngineCalcDec('.');
    setReportDec('.');

    container = document.createElement('div');
    document.body.appendChild(container);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    urlToBlob = new Map();
    capturedDownloads = [];
    activeFileList = [];
    fileInputHooked = new WeakSet();

    if (typeof globalThis.ResizeObserver === 'undefined') {
      class MockResizeObserver {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      }
      (globalThis as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver =
        MockResizeObserver;
    }

    vi.stubGlobal(
      'URL',
      Object.assign(Object.create(URL), {
        createObjectURL: vi.fn((blob: Blob) => {
          const url = `blob:mock-${urlToBlob.size}`;
          urlToBlob.set(url, blob);
          return url;
        }),
        revokeObjectURL: vi.fn(),
      }),
    );

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      const blob = urlToBlob.get(this.href) ?? new Blob([]);
      capturedDownloads.push({ filename: this.download, blob });
    });
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
      root = null;
    }
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetEngineCaches();
    setEngineCalcDec('.');
    setReportDec('.');
  });

  async function mountApp(): Promise<void> {
    root = createRoot(container);
    await act(async () => {
      root!.render(<App />);
    });
  }

  function triggerOpenFile(fileInput: HTMLInputElement, file: File): void {
    activeFileList = [file];
    if (!fileInputHooked.has(fileInput)) {
      fileInputHooked.add(fileInput);
      Object.defineProperty(fileInput, 'files', {
        configurable: true,
        get: () => activeFileList,
      });
    }
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  }

  it('Easy: renders Mẫu 1 default KPIs, all 5 CAD sheets, header exports, dirty guard, and .tcl.json round-trip', async () => {
    await mountApp();

    const shell = container.querySelector('.app-shell') as HTMLElement | null;
    expect(shell).not.toBeNull();
    expect(shell?.getAttribute('data-tpl')).toBe('B');

    // Exact Mẫu 1 H=500 baseline KPIs & badge
    const cards = Array.from(container.querySelectorAll('#sum .card')).map((c) => c.textContent);
    expect(cards).toEqual([
      'Bê tông21,50 m³',
      'Ván khuôn64,64 m²',
      'Bê tông lót1,50 m³',
      'Cốt thép2370 kg',
      'Hàm lượng110,2 kg/m³',
    ]);
    expect(container.querySelector('#warn')?.textContent).toContain('✓ Không có cảnh báo');
    expect(container.querySelector('#calcBadge')?.textContent).toBe('✗ 3');
    expect(container.querySelector('#sinfo')?.textContent).toBe(
      'Cụm chi tiết · tỷ lệ 1/20 · rộng 766 × cao 419 mm trên giấy',
    );

    // Header buttons in 2D mode (zero licensing UI, LEDAT branding)
    expect(container.textContent).toContain('Tường chắn BTCT');
    expect(container.querySelector('header .brand small')?.textContent).toBe(
      'Bản vẽ 2D · mô hình 3D · kiểm toán TCVN 11823 · LEDAT',
    );
    expect(container.textContent).not.toContain('Thợ Vẽ');
    expect(container.querySelector('.licchip')).toBeNull();
    expect(container.querySelector('#licov')).toBeNull();

    const bOpen = container.querySelector('#bOpen') as HTMLButtonElement;
    const bSave = container.querySelector('#bSave') as HTMLButtonElement;
    const bDxf = container.querySelector('#bDxf') as HTMLButtonElement;
    const bPng = container.querySelector('#bPng') as HTMLButtonElement;
    const bDxfAll = container.querySelector('#bDxfAll') as HTMLButtonElement;
    const bSvg = container.querySelector('#bSvg') as HTMLButtonElement;
    const bPrint = container.querySelector('#bPrint') as HTMLButtonElement;
    const bPdf = container.querySelector('#bPdf') as HTMLButtonElement;
    const bDocx = container.querySelector('#bDocx') as HTMLButtonElement;
    const bCsv = container.querySelector('#bCsv') as HTMLButtonElement;

    expect(bOpen.textContent).toContain('Mở dự án');
    expect(bSave.textContent).toContain('Lưu dự án');
    expect(bSave.getAttribute('data-dirty')).toBeNull();
    expect(bDxf.hidden).toBe(false);
    expect(bDxfAll.hidden).toBe(false);
    expect(bSvg.hidden).toBe(false);
    expect(bPrint.hidden).toBe(false);
    expect(bPdf.hidden).toBe(false);
    expect(bCsv.hidden).toBe(false);
    expect(bPng.hidden).toBe(true);
    expect(bDocx.hidden).toBe(true);

    // Clean state does not trigger beforeunload
    const cleanUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(cleanUnload);
    expect(cleanUnload.defaultPrevented).toBe(false);

    // All 5 CAD sheets + 3D + Calc
    const tabBtns = Array.from(container.querySelectorAll<HTMLButtonElement>('#tabs > button'));
    expect(tabBtns).toHaveLength(7);
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        tabBtns[i].click();
      });
      expect(tabBtns[i].classList.contains('on')).toBe(true);
      expect(container.querySelector('#stage svg')).not.toBeNull();
    }
    expect(container.querySelector('#stage')?.textContent).toContain('KHỐI LƯỢNG TƯỜNG CHẮN');

    // Fit button & stage double-click
    await act(async () => {
      (container.querySelector('#bFit') as HTMLButtonElement).click();
      container.querySelector('#stage')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });

    // Header exports in 2D mode: DXF single, DXF all, SVG, CSV, CAD PDF
    await act(async () => {
      bDxf.click();
      bDxfAll.click();
      bSvg.click();
      bCsv.click();
      bPdf.click();
    });
    await flushUi(30);

    const names = capturedDownloads.map((d) => d.filename);
    expect(names.some((n) => n.endsWith('_to5.dxf'))).toBe(true);
    expect(names.some((n) => n.endsWith('_tat-ca.dxf'))).toBe(true);
    expect(names.some((n) => n.endsWith('_to5.svg'))).toBe(true);
    expect(names.some((n) => n.endsWith('_thong-ke-thep.csv'))).toBe(true);
    expect(names.some((n) => n.endsWith('_to5.pdf'))).toBe(true);

    const dxfBlob = capturedDownloads.find((d) => d.filename.endsWith('_tat-ca.dxf'))!.blob;
    expect(await readBlobText(dxfBlob)).toContain('AC1009');
    const pdfBlob = capturedDownloads.find((d) => d.filename.endsWith('_to5.pdf'))!.blob;
    const pdfBytes = await readBlobBytes(pdfBlob);
    expect(String.fromCharCode(...pdfBytes.slice(0, 5))).toBe('%PDF-');

    // Edit project -> dirty guard activates -> save clears dirty -> switch to Mẫu 3 -> open saved file restores Mẫu 1
    const hInput = container.querySelector('#panel input[data-path="H"]') as HTMLInputElement;
    await act(async () => {
      setInputValue(hInput, '600');
    });
    expect(bSave.getAttribute('data-dirty')).toBe('1');
    const dirtyUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirtyUnload);
    expect(dirtyUnload.defaultPrevented).toBe(true);

    await act(async () => {
      bSave.click();
    });
    expect(bSave.getAttribute('data-dirty')).toBeNull();
    const savedEntry = capturedDownloads.find((d) => d.filename.endsWith('.tcl.json'))!;
    expect(savedEntry).toBeDefined();
    const savedJsonText = await readBlobText(savedEntry.blob);

    // Switch to Mẫu 3, then reopen the saved Mẫu 1 project via #fOpen
    const tplCards = container.querySelectorAll<HTMLElement>('.tpl');
    await act(async () => {
      tplCards[2].click();
    });
    expect(shell?.getAttribute('data-tpl')).toBe('C');

    const fileInput = container.querySelector('#fOpen') as HTMLInputElement;
    await act(async () => {
      triggerOpenFile(
        fileInput,
        new File([savedJsonText], 'restored.tcl.json', { type: 'application/json' }),
      );
    });
    await flushUi(30);
    expect(shell?.getAttribute('data-tpl')).toBe('B');
    expect((container.querySelector('#panel input[data-path="H"]') as HTMLInputElement).value).toBe(
      '600',
    );
    expect(bSave.getAttribute('data-dirty')).toBeNull();
    expect(container.querySelector('#toast')?.classList.contains('ok')).toBe(true);

    // Flush any remaining debounced background timers cleanly before invalid open check
    await flushUi(100);
    expect(errorSpy).not.toHaveBeenCalled();

    // Invalid project file displays error toast
    await act(async () => {
      triggerOpenFile(fileInput, new File(['{"not":"valid"}'], 'bad.tcl.json'));
    });
    await flushUi(30);
    expect(container.querySelector('#toast')?.classList.contains('err')).toBe(true);
    expect(errorSpy).toHaveBeenCalledTimes(1); // expected error log from invalid open
  });

  it('Medium: drives all 4 templates, conditional accordions, integer rebar input, paper overflow warning, and 3D bar controls', async () => {
    await mountApp();
    const shell = container.querySelector('.app-shell') as HTMLElement;

    // 1. Mẫu 1 QuickHRow + #preH + segmented type
    await act(async () => {
      setSelectValue(container.querySelector('#preH') as HTMLSelectElement, '8');
    });
    expect((container.querySelector('#panel input[data-path="H"]') as HTMLInputElement).value).toBe(
      '800',
    );
    const ribSegBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('#panel .seg button'))[1];
    await act(async () => {
      ribSegBtn.click();
    });
    expect(container.querySelector('#calcR')?.textContent).toContain('Số sườn trên 1 đơn nguyên:');

    // 2. Mẫu 2 (A): beam vs key mutual exclusion + QuickHRow hint
    const tplCards = container.querySelectorAll<HTMLElement>('.tpl');
    await act(async () => {
      tplCards[1].click();
    });
    expect(shell.getAttribute('data-tpl')).toBe('A');
    expect(container.querySelector('#panel .qh')?.textContent).toContain('Mẫu 2 chỉ có một cỡ');

    const findChkByText = (needle: string): HTMLInputElement | undefined =>
      Array.from(container.querySelectorAll<HTMLLabelElement>('#panel label.chk'))
        .find((l) => l.textContent?.includes(needle))
        ?.querySelector('input[type="checkbox"]') as HTMLInputElement | undefined;

    const keyChkBlocked = findChkByText('dầm biên');
    expect(keyChkBlocked?.disabled).toBe(true);
    const beamChk = findChkByText('Có dầm biên ở 2 đầu bản đáy')!;
    await act(async () => {
      setCheckbox(beamChk, false);
    });
    expect(findChkByText('Có chân khóa chống cắt')?.disabled).toBe(false);

    // 3. Mẫu 3 (C): #preK selector, Kè extra fields, and DraftRebarNum integer coercion
    await act(async () => {
      container.querySelectorAll<HTMLElement>('.tpl')[2].click();
    });
    expect(shell.getAttribute('data-tpl')).toBe('C');
    await act(async () => {
      setSelectValue(
        container.querySelector('#preK') as HTMLSelectElement,
        (container.querySelector('#preK') as HTMLSelectElement).options[10].value,
      );
    });
    expect(container.querySelector('#panel input[data-path="toeFlat"]')).not.toBeNull();
    expect(container.querySelector('#panel input[data-path="rib.end"]')).not.toBeNull();

    // Update integer bar count in table.rb (c13: thanh/sườn) with "2.7" -> rounds to 3 on blur
    const intBarInput = Array.from(
      container.querySelectorAll<HTMLTableRowElement>('#rbtab tbody tr'),
    )
      .find((tr) => tr.textContent?.includes('thanh/sườn'))
      ?.querySelector('input[type="number"]') as HTMLInputElement;
    expect(intBarInput).toBeDefined();
    await act(async () => {
      intBarInput.focus();
      setInputValue(intBarInput, '2.7');
      intBarInput.blur();
    });
    expect(intBarInput.value).toBe('3');

    // 4. Mẫu 4 (D): #preD D80 -> D45, fillMode='1.5', blindOn=false -> 0,00 m³, A3 + 1/10 overflow
    await act(async () => {
      container.querySelectorAll<HTMLElement>('.tpl')[3].click();
    });
    expect(shell.getAttribute('data-tpl')).toBe('D');
    expect(container.querySelector('#panel summary')?.textContent).toBe('0. Chọn mẫu bản vẽ');
    expect(container.textContent).toContain('2b. Chi tiết Mẫu 4');

    // D65 (index 1) has ribH>0 so seg shows; D45 (index 4) has ribH=0 so seg hides
    expect(container.querySelector('#panel .seg')).not.toBeNull();
    await act(async () => {
      setSelectValue(container.querySelector('#preD') as HTMLSelectElement, '4');
    });
    expect(container.querySelector('#panel .seg')).toBeNull();

    await act(async () => {
      setSelectValue(
        container.querySelector('#panel select[data-path="fillMode"]') as HTMLSelectElement,
        '1.5',
      );
    });
    expect(container.querySelector('#panel input[data-path="fillH"]')).not.toBeNull();

    const blindChk = findChkByText('Có bê tông lót móng')!;
    await act(async () => {
      setCheckbox(blindChk, false);
    });
    expect(container.querySelector('#panel input[data-path="tBlind"]')).toBeNull();
    expect(container.querySelector('#sum')?.textContent).toContain('Bê tông lót0,00 m³');

    await act(async () => {
      setSelectValue(
        container.querySelector('#panel select[data-path="paper"]') as HTMLSelectElement,
        'A3',
      );
      setSelectValue(
        container.querySelector('#panel select[data-path="scale"]') as HTMLSelectElement,
        '10',
      );
    });
    expect(container.querySelector('#sinfo')?.textContent).toContain('⚠ vượt khổ A3');

    // 5. CAD section 6 starts collapsed and persists open state across 2d -> calc -> 2d
    const findDetailsBySummary = (needle: string): HTMLDetailsElement | undefined =>
      Array.from(container.querySelectorAll<HTMLDetailsElement>('#panel details')).find((d) =>
        d.querySelector('summary')?.textContent?.includes(needle),
      );
    const cadSec6 = findDetailsBySummary('6. Vật liệu & trình bày')!;
    expect(cadSec6).toBeDefined();
    expect(cadSec6.open).toBe(false);
    await act(async () => {
      (cadSec6.querySelector('summary') as HTMLElement).click();
    });
    await flushUi(20);
    expect(findDetailsBySummary('6. Vật liệu & trình bày')?.open).toBe(true);
    await act(async () => {
      (container.querySelector('#tabCalc') as HTMLButtonElement).click();
    });
    await act(async () => {
      container.querySelectorAll<HTMLButtonElement>('#tabs > button')[0].click();
    });
    expect(findDetailsBySummary('6. Vật liệu & trình bày')?.open).toBe(true);

    // 6. 3D tab controls, single V3.setModel on 2D->3D transition, legMin post-commit toggle & PNG fallback toast
    expect(appCssRaw).toMatch(/#v3foc\s+button\s*\{[^}]*pointer-events:\s*auto/);
    const setModelSpy = vi.spyOn(V3.prototype, 'setModel');
    const bPng = container.querySelector('#bPng') as HTMLButtonElement;
    await act(async () => {
      (container.querySelector('#tab3d') as HTMLButtonElement).click();
    });
    expect(setModelSpy).toHaveBeenCalledTimes(1);
    expect(bPng.hidden).toBe(false);
    expect(container.querySelector('#v3clipRow')?.classList.contains('off')).toBe(true);

    // Toggle leg minimize button & verify round-trip 3D->2D->3D does not duplicate setModel
    const minBtn = container.querySelector('#v3leg .v3h button:last-child') as HTMLButtonElement;
    await act(async () => {
      minBtn.click();
    });
    expect(container.querySelector('#v3leg')?.classList.contains('min')).toBe(true);
    await act(async () => {
      container.querySelectorAll<HTMLButtonElement>('#tabs > button')[0].click();
    });
    await act(async () => {
      (container.querySelector('#tab3d') as HTMLButtonElement).click();
    });
    expect(setModelSpy).toHaveBeenCalledTimes(1);
    setModelSpy.mockRestore();

    await act(async () => {
      setSelectValue(container.querySelector('#v3clipAxis') as HTMLSelectElement, 'z');
      setCheckbox(container.querySelector('#v3ortho') as HTMLInputElement, true);
    });
    expect(container.querySelector('#v3clipRow')?.classList.contains('off')).toBe(false);
    expect(container.querySelector('#v3leg')).not.toBeNull();
    expect(container.querySelector('#v3msg')?.textContent).toContain('WebGL');

    // No WebGL context in jsdom -> graceful error toast without uncaught throw
    await act(async () => {
      bPng.click();
    });
    expect(container.querySelector('#toast')?.classList.contains('err')).toBe(true);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('Hard: drives Calc accordions 0..10 (soil/water fd/seismic/Bishop/FE3D interactive contour & hover/FEM2D/rebar apply/heel hint)', async () => {
    await mountApp();

    // Switch to Tính toán tab
    await act(async () => {
      (container.querySelector('#tabCalc') as HTMLButtonElement).click();
    });
    expect(container.querySelector('#calcv .csheet')).not.toBeNull();

    // 0. Project metadata reflected in calc sheet
    await act(async () => {
      setInputValue(
        container.querySelector('#panel input[data-path="calc.pjName"]') as HTMLInputElement,
        'Cầu Vượt Quốc Lộ 1A',
      );
      setInputValue(
        container.querySelector('#panel input[data-path="calc.pjBy"]') as HTMLInputElement,
        'KS. Nguyễn Văn A',
      );
      setInputValue(
        container.querySelector('#panel input[data-path="calc.pjDate"]') as HTMLInputElement,
        '2026-11-11',
      );
    });
    const sheetTxt0 = container.querySelector('#calcv .csheet')?.textContent ?? '';
    expect(sheetTxt0).toContain('Cầu Vượt Quốc Lộ 1A');
    expect(sheetTxt0).toContain('KS. Nguyễn Văn A');

    // 1. Earth fill + !dvA -> exposes calc.dv; 2. LL -> exposes calc.dT
    await act(async () => {
      setSelectValue(
        container.querySelector('#panel select[data-path="fillMode"]') as HTMLSelectElement,
        '1',
      );
      setCheckbox(container.querySelector('#panel input[data-path="calc.dvA"]') as HTMLInputElement, false);
      setCheckbox(container.querySelector('#panel input[data-path="calc.LL"]') as HTMLInputElement, true);
    });
    expect(container.querySelector('#panel input[data-path="calc.dv"]')).not.toBeNull();
    expect(container.querySelector('#panel input[data-path="calc.dT"]')).not.toBeNull();

    // 3. Soil branches: cohesive 'd' (Su) + 'spt' -> rock 'a' + anchor fr/tay & dw -> back to 'r' auto-clears anchor
    await act(async () => {
      setSelectValue(
        container.querySelector('#panel select[data-path="calc.soil"]') as HTMLSelectElement,
        'd',
      );
      setSelectValue(
        container.querySelector('#panel select[data-path="calc.brm"]') as HTMLSelectElement,
        'spt',
      );
    });
    expect(container.querySelector('#panel input[data-path="calc.Su"]')).not.toBeNull();
    expect(container.querySelector('#panel input[data-path="calc.Nspt"]')).not.toBeNull();
    expect(container.querySelector('#panel input[data-path="calc.phibS"]')).not.toBeNull();

    await act(async () => {
      setSelectValue(
        container.querySelector('#panel select[data-path="calc.soil"]') as HTMLSelectElement,
        'a',
      );
    });
    const rockAncChk = Array.from(container.querySelectorAll<HTMLLabelElement>('#panel label.chk'))
      .find((l) => l.textContent?.includes('Có neo thép khoan vào đá'))
      ?.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(rockAncChk).toBeDefined();
    await act(async () => {
      setCheckbox(rockAncChk, true);
    });
    await act(async () => {
      setSelectValue(
        container.querySelector('#panel select[data-path="calc.aSl"]') as HTMLSelectElement,
        'fr',
      );
      setSelectValue(
        container.querySelector('#panel select[data-path="calc.tauA"]') as HTMLSelectElement,
        'tay',
      );
    });
    expect(container.querySelector('#panel input[data-path="calc.atau"]')).not.toBeNull();

    await act(async () => {
      setSelectValue(
        container.querySelector('#panel select[data-path="calc.aSl"]') as HTMLSelectElement,
        'dw',
      );
    });
    expect(container.querySelector('#panel input[data-path="calc.aTv"]')).not.toBeNull();

    // Back to 'r': wMode='fd' and SciField accepts comma scientific notation "2,5e-5"
    await act(async () => {
      setSelectValue(
        container.querySelector('#panel select[data-path="calc.soil"]') as HTMLSelectElement,
        'r',
      );
      setCheckbox(container.querySelector('#panel input[data-path="calc.wOn"]') as HTMLInputElement, true);
    });
    await act(async () => {
      setSelectValue(
        container.querySelector('#panel select[data-path="calc.wMode"]') as HTMLSelectElement,
        'fd',
      );
    });
    const kbxInput = container.querySelector('#panel input[data-path="calc.kbx"]') as HTMLInputElement;
    await act(async () => {
      kbxInput.focus();
      setInputValue(kbxInput, '2,5e-5');
      kbxInput.blur();
    });
    expect(kbxInput.value).toBe('2.5e-5');

    // 5. Seismic ON + eqKm='tay' exposes eqKh and fsSlE/fsOtE in §6
    await act(async () => {
      setCheckbox(container.querySelector('#panel input[data-path="calc.eqOn"]') as HTMLInputElement, true);
    });
    await act(async () => {
      setSelectValue(
        container.querySelector('#panel select[data-path="calc.eqKm"]') as HTMLSelectElement,
        'tay',
      );
    });
    expect(container.querySelector('#panel input[data-path="calc.eqKh"]')).not.toBeNull();
    expect(container.querySelector('#panel input[data-path="calc.fsSlE"]')).not.toBeNull();
    expect(container.querySelector('#calcv .csheet')?.textContent).toContain('Tổ hợp Đặc biệt');

    // 6. Bishop ON + coarse FEM2D setup -> click .gsRun -> .gsbox populates & auto-switches to 'gs'
    await act(async () => {
      setCheckbox(container.querySelector('#panel input[data-path="calc.bsOn"]') as HTMLInputElement, true);
      setCheckbox(container.querySelector('#panel input[data-path="calc.femOn"]') as HTMLInputElement, true);
      setSelectValue(
        container.querySelector('#panel select[data-path="calc.femMesh"]') as HTMLSelectElement,
        'c',
      );
      setInputValue(
        container.querySelector('#panel input[data-path="calc.femLifts"]') as HTMLInputElement,
        '2',
      );
    });
    expect(container.querySelector('#panel input[data-path="calc.bsPhiR"]')).not.toBeNull();

    await act(async () => {
      (container.querySelector('#panel button.gsRun') as HTMLButtonElement).click();
    });
    await waitForInAct(
      () => {
        expect(container.querySelectorAll('#panel .gsbox tbody tr').length).toBeGreaterThanOrEqual(4);
        expect(container.querySelector('#femStat')?.textContent).toContain('Kết quả (');
      },
      15000,
    );
    const activeSubBtn = container.querySelector('.csub button.on');
    expect(activeSubBtn?.textContent).toContain('Ổn định tổng thể');

    // Verify Sheet subtab contains FEM 2D section
    await act(async () => {
      (Array.from(container.querySelectorAll<HTMLButtonElement>('.csub button'))[0]).click();
    });
    expect(container.querySelector('#calcv .csheet')?.textContent).toContain('PHẦN TỬ HỮU HẠN 2D');

    // 7. Section 10 rebar fixes & heel hint on Cantilever (calc.ift visible; hidden on Ribbed)
    expect(container.querySelector('#panel select[data-path="calc.ift"]')).not.toBeNull();
    const s1Sel = container.querySelector('.cb[data-id="s1"] select') as HTMLSelectElement;
    const s1Space = container.querySelector('.cb[data-id="s1"] input[type="number"]') as HTMLInputElement;
    await act(async () => {
      setSelectValue(s1Sel, '12');
      setInputValue(s1Space, '30');
    });
    const s1Btn = container.querySelector('.cb[data-id="s1"] button.ap') as HTMLButtonElement;
    expect(s1Btn).not.toBeNull();
    await act(async () => {
      s1Btn.click();
    });
    expect(container.querySelector('.cb[data-id="s1"] .cbs')?.textContent).toBe('✓');

    const hintBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('#panel button')).find(
      (b) => b.textContent?.includes('Gợi ý kích thước ổn định'),
    )!;
    await act(async () => {
      hintBtn.click();
    });
    await flushUi(60);
    expect((container.querySelector('#calcHint')?.textContent ?? '').length).toBeGreaterThan(5);

    // 8. Return to CAD tab to switch to Mẫu 2 (A, ribbed), then back to Tính toán -> calc.ift hidden, enable FE3D feOn & feBasis='fe', inspect FE view + hover [data-e]
    await act(async () => {
      (container.querySelectorAll<HTMLButtonElement>('#tabs > button')[0]).click();
    });
    await act(async () => {
      container.querySelectorAll<HTMLElement>('.tpl')[1].click();
    });
    await act(async () => {
      (container.querySelector('#tabCalc') as HTMLButtonElement).click();
    });
    expect(container.querySelector('#panel select[data-path="calc.ift"]')).toBeNull();
    await act(async () => {
      setCheckbox(container.querySelector('#panel input[data-path="calc.feOn"]') as HTMLInputElement, true);
      setSelectValue(
        container.querySelector('#panel select[data-path="calc.feBasis"]') as HTMLSelectElement,
        'fe',
      );
    });
    await waitForInAct(
      () => {
        expect(container.querySelector('#feStat')?.textContent).toContain('Đã tính:');
      },
      10000,
    );

    const feSubBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('.csub button')).find(
      (b) => b.textContent?.includes('Nội lực mô hình tấm'),
    )!;
    expect(feSubBtn).toBeDefined();
    await act(async () => {
      feSubBtn.click();
    });

    const feToolSelects = container.querySelectorAll<HTMLSelectElement>('.feview .fetool select');
    expect(feToolSelects.length).toBe(3); // Đại lượng, Tổ hợp, Sườn
    await act(async () => {
      setSelectValue(feToolSelects[0], 'V');
      setSelectValue(feToolSelects[1], 'SD');
      setSelectValue(feToolSelects[2], 'color');
    });
    const frontViewBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('.feview .fetool button')).find(
      (b) => b.textContent?.includes('Mặt trước'),
    )!;
    await act(async () => {
      frontViewBtn.click();
    });

    const elemPoly = container.querySelector('.fefig svg [data-e]') as Element | null;
    expect(elemPoly).not.toBeNull();
    await act(async () => {
      elemPoly!.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    });
    expect(container.querySelector('.feview .feinfo')?.textContent).toContain('Phần tử');

    // Switch fe -> sheet -> fe: FeViewPanel { q, k, az, el, ribs } must persist!
    await act(async () => {
      container.querySelectorAll<HTMLButtonElement>('.csub button')[0].click();
    });
    expect(container.querySelector('#calcv .csheet')).not.toBeNull();
    await act(async () => {
      Array.from(container.querySelectorAll<HTMLButtonElement>('.csub button'))
        .find((b) => b.textContent?.includes('Nội lực mô hình tấm'))!
        .click();
    });
    const feSelectsAfter = container.querySelectorAll<HTMLSelectElement>('.feview .fetool select');
    expect(feSelectsAfter[0].value).toBe('V');
    expect(feSelectsAfter[1].value).toBe('SD');
    expect(feSelectsAfter[2].value).toBe('color');
    expect(container.querySelector('.feview .fe-c.sl i')?.textContent).toBe('204°');

    // Toggle Calc Section 8 (_femOpen) & Section 11 open, switch calc -> 2d -> calc and verify persisted!
    const findCalcDetails = (needle: string): HTMLDetailsElement | undefined =>
      Array.from(container.querySelectorAll<HTMLDetailsElement>('#panel details')).find((d) =>
        d.querySelector('summary')?.textContent?.includes(needle),
      );
    const sec8 = findCalcDetails('8. FEM 2D')!;
    const sec11 = findCalcDetails('11. Bảng tính')!;
    expect(sec8.open).toBe(true); // enabled earlier via femOn, wait: turn femOn off first to verify _femOpen memory!
    expect(sec11.open).toBe(false);
    await act(async () => {
      setCheckbox(container.querySelector('#panel input[data-path="calc.femOn"]') as HTMLInputElement, false);
      (sec11.querySelector('summary') as HTMLElement).click();
    });
    await flushUi(20);
    expect(findCalcDetails('8. FEM 2D')?.open).toBe(true);
    expect(findCalcDetails('11. Bảng tính')?.open).toBe(true);

    await act(async () => {
      container.querySelectorAll<HTMLButtonElement>('#tabs > button')[0].click();
    });
    await act(async () => {
      (container.querySelector('#tabCalc') as HTMLButtonElement).click();
    });
    expect(findCalcDetails('8. FEM 2D')?.open).toBe(true);
    expect(findCalcDetails('11. Bảng tính')?.open).toBe(true);

    await flushUi(150);
    expect(errorSpy).not.toHaveBeenCalled();
  }, 45000);

  it('Special: propagates live dec "." <-> "," to sheet, rb, fe contour/hover, and exports DOCX, Calc PDF & Print iframe', async () => {
    await mountApp();

    // Switch to Mẫu 2 ribbed + Calc mode + FE3D ON + coarse FEM2D ON so all exports execute fast and cleanly
    await act(async () => {
      container.querySelectorAll<HTMLElement>('.tpl')[1].click();
    });
    await act(async () => {
      (container.querySelector('#tabCalc') as HTMLButtonElement).click();
    });
    await act(async () => {
      setCheckbox(container.querySelector('#panel input[data-path="calc.feOn"]') as HTMLInputElement, true);
      setSelectValue(
        container.querySelector('#panel select[data-path="calc.femMesh"]') as HTMLSelectElement,
        'c',
      );
      setInputValue(
        container.querySelector('#panel input[data-path="calc.femLifts"]') as HTMLInputElement,
        '2',
      );
    });
    await flushUi(140);

    // Ensure coarse FEM & GS are cached before export clicks (run #femRun explicitly + wait for auto/manual GS)
    await act(async () => {
      (container.querySelector('#femRun') as HTMLButtonElement).click();
    });
    await waitForInAct(
      () => {
        expect(container.querySelector('#femStat')?.textContent).toContain('Kết quả (');
      },
      15000,
    );
    if (container.querySelectorAll('#panel .gsbox tbody tr').length < 2) {
      await waitForInAct(
        () => {
          const btn = container.querySelector('#panel button.gsRun') as HTMLButtonElement | null;
          expect(btn?.disabled).toBe(false);
        },
        5000,
      );
      if (container.querySelectorAll('#panel .gsbox tbody tr').length < 2) {
        await act(async () => {
          (container.querySelector('#panel button.gsRun') as HTMLButtonElement).click();
        });
      }
    }
    await waitForInAct(
      () => {
        expect(container.querySelectorAll('#panel .gsbox tbody tr').length).toBeGreaterThanOrEqual(2);
      },
      10000,
    );

    // Go back to Bảng tính subtab, test live dec "." -> "," propagation on sheet, rb, fe hover
    const decSelect = container.querySelector(
      '#panel select[data-path="calc.dec"]',
    ) as HTMLSelectElement;
    expect(decSelect).not.toBeNull();
    await act(async () => {
      setSelectValue(decSelect, ',');
    });

    await act(async () => {
      Array.from(container.querySelectorAll<HTMLButtonElement>('.csub button'))[0].click();
    });
    expect(container.querySelector('#calcv .csheet')?.textContent).toMatch(/\d+,\d{2}/);

    const rbBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('.csub button')).find(
      (b) => b.textContent?.includes('Bố trí thép'),
    )!;
    await act(async () => {
      rbBtn.click();
    });
    expect(container.querySelector('#calcv .csheet')?.textContent).toMatch(/\d+,\d{2}/);

    const feBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('.csub button')).find(
      (b) => b.textContent?.includes('Nội lực mô hình tấm'),
    )!;
    await act(async () => {
      feBtn.click();
    });
    const elemPolyComma = container.querySelector('.fefig svg [data-e]')!;
    await act(async () => {
      elemPolyComma.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    });
    expect(container.querySelector('.feview .feinfo')?.textContent).toMatch(/\d+,\d+/);

    // Export Word (.docx) + Calc PDF (.pdf) in Calc mode
    const bDocx = container.querySelector('#bDocx') as HTMLButtonElement;
    const bPdf = container.querySelector('#bPdf') as HTMLButtonElement;
    const bPrint = container.querySelector('#bPrint') as HTMLButtonElement;
    expect(bDocx.hidden).toBe(false);
    expect(bPdf.hidden).toBe(false);
    expect(bPrint.hidden).toBe(false);

    await act(async () => {
      bDocx.click();
    });
    await waitForInAct(
      () => {
        expect(capturedDownloads.find((d) => d.filename.endsWith('_tinh-toan.docx'))).toBeDefined();
      },
      10000,
    );
    const docxDl = capturedDownloads.find((d) => d.filename.endsWith('_tinh-toan.docx'))!;
    const docxBytes = await readBlobBytes(docxDl.blob);
    expect(docxBytes[0]).toBe(0x50); // 'P'
    expect(docxBytes[1]).toBe(0x4b); // 'K'
    expect(container.querySelector('#toast')?.classList.contains('ok')).toBe(true);

    await act(async () => {
      bPdf.click();
    });
    await waitForInAct(
      () => {
        expect(capturedDownloads.find((d) => d.filename.endsWith('_tinh-toan.pdf'))).toBeDefined();
      },
      10000,
    );
    const pdfDl = capturedDownloads.find((d) => d.filename.endsWith('_tinh-toan.pdf'))!;
    expect(pdfDl).toBeDefined();
    const calcPdfBytes = await readBlobBytes(pdfDl.blob);
    expect(String.fromCharCode(...calcPdfBytes.slice(0, 5))).toBe('%PDF-');
    expect(calcPdfBytes.length).toBeGreaterThan(2000);

    // Mock hidden iframe print so jsdom does not log Not implemented: window.print
    let printCalls = 0;
    const origAppend = document.body.append.bind(document.body);
    const appendSpy = vi.spyOn(document.body, 'append').mockImplementation(((...nodes: (Node | string)[]) => {
      origAppend(...nodes);
      for (const n of nodes) {
        if (n instanceof HTMLIFrameElement && n.contentWindow) {
          const w = n.contentWindow as Window & { print: () => void; focus: () => void };
          w.focus = vi.fn();
          w.print = vi.fn(() => {
            printCalls++;
          });
        }
      }
    }) as typeof document.body.append);

    await act(async () => {
      bPrint.click();
    });
    await flushUi(2600);
    appendSpy.mockRestore();
    expect(printCalls).toBe(1);

    // No uncaught runtime errors anywhere
    expect(errorSpy).not.toHaveBeenCalled();
  }, 45000);

  it('Móng cọc: bật/tắt mục 12, sửa địa tầng và bảng tra mà không ảnh hưởng kết quả tường', async () => {
    await mountApp();
    const kpi = () => Array.from(container.querySelectorAll('#sum .card')).map((c) => c.textContent);
    const kpi0 = kpi();

    await act(async () => {
      (container.querySelector('#tabCalc') as HTMLButtonElement).click();
    });
    const sec12 = Array.from(container.querySelectorAll<HTMLDetailsElement>('#panel details')).find(
      (d) => d.querySelector('summary')?.textContent?.includes('12. Móng cọc'),
    )!;
    expect(sec12).toBeTruthy();
    await act(async () => {
      (sec12.querySelector('summary') as HTMLElement).click();
    });
    await flushUi(20);
    expect(sec12.open).toBe(true);
    // chưa bật: chỉ có công tắc
    expect(container.querySelector('#panel [data-layer]')).toBeNull();

    const sw = container.querySelector('#panel input[data-path="pile.on"]') as HTMLInputElement;
    await act(async () => {
      setCheckbox(sw, true);
    });
    await flushUi(20);
    expect(container.querySelectorAll('#panel [data-layer]').length).toBe(3);
    expect(container.querySelector('#panel select[data-path="pile.type"]')).not.toBeNull();

    // thêm rồi xóa lớp đất
    const addBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('#panel button.wide')).find(
      (b) => b.textContent?.includes('Thêm lớp đất'),
    )!;
    await act(async () => {
      addBtn.click();
    });
    expect(container.querySelectorAll('#panel [data-layer]').length).toBe(4);
    await act(async () => {
      (container.querySelector('#panel [data-layer] button[aria-label="Xóa lớp đất"]') as HTMLButtonElement).click();
    });
    expect(container.querySelectorAll('#panel [data-layer]').length).toBe(3);

    // ô hệ số trống = null (chưa nhập), nhập được 0 và số thực
    const gk = container.querySelector('#panel input[data-path="pile.coef.gk"]') as HTMLInputElement;
    expect(gk.value).toBe('');
    await act(async () => {
      setInputValue(gk, '1.4');
    });
    expect((container.querySelector('#panel input[data-path="pile.coef.gk"]') as HTMLInputElement).value).toBe('1.4');

    // bảng tra fi: thêm hàng và cột
    const fiBox = container.querySelector('#panel [data-table="fi"]') as HTMLElement;
    const rows0 = fiBox.querySelectorAll('tbody tr').length;
    await act(async () => {
      Array.from(fiBox.querySelectorAll<HTMLButtonElement>('.prow2 button'))
        .find((b) => b.textContent?.includes('Hàng'))!
        .click();
    });
    expect((container.querySelector('#panel [data-table="fi"]') as HTMLElement).querySelectorAll('tbody tr').length).toBe(rows0 + 1);

    // tắt cọc: các lớp biến mất khỏi UI nhưng KPI tường không đổi
    await act(async () => {
      setCheckbox(container.querySelector('#panel input[data-path="pile.on"]') as HTMLInputElement, false);
    });
    await flushUi(20);
    expect(container.querySelector('#panel [data-layer]')).toBeNull();

    await act(async () => {
      container.querySelectorAll<HTMLButtonElement>('#tabs > button')[0].click();
    });
    expect(kpi()).toEqual(kpi0);
    expect(errorSpy).not.toHaveBeenCalled();
  }, 30000);

});
