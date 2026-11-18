import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { act } from 'react';
import App from '../../src/toando/App';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function click(el: Element | null) {
  expect(el).not.toBeNull();
  act(() => {
    (el as HTMLElement).click();
  });
}

function clickTreeItem(host: HTMLElement, label: string) {
  const items = Array.from(host.querySelectorAll('[role="tree"] [role="treeitem"]'));
  const item =
    items.find((el) => el.querySelector('span:last-child')?.textContent?.trim() === label) ??
    items.find((el) => el.textContent?.includes(label));
  click(item ?? null);
}

function changeInput(el: HTMLInputElement | HTMLSelectElement, value: string) {
  act(() => {
    const proto =
      el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    setter?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('ToanDo-Web UI & State Integration', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.localStorage.clear();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
      flushSync(() => {
        root.render(<App />);
      });
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
  });

  it('renders LEDAT-BIM Ribbon, TreeView, single active workspace tab, and StatusBar', () => {
    expect(host.querySelector('[data-testid="window-title"]')?.textContent).toBe(
      'Áo đường mềm (TCCS 38:2022/TCĐBVN)',
    );
    const tabs = host.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(1);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].textContent).toContain('Thông tin dự án');
    expect(host.querySelector('[data-testid="status-bar"]')?.textContent).toContain('CAPS');
    expect(host.querySelector('[data-testid="status-message"]')?.textContent).toContain('TCCS 38:2022/TCĐBVN');
    expect(host.querySelector('[data-testid="tab-thong-tin"]')).not.toBeNull();
  });

  it('loads TCCS 38:2022 Appendix D.1 sample, updates window title, runs verification, and syncs TreeView + RichView tabs', () => {
    click(host.querySelector('[data-testid="btn-load-sample"]'));

    expect(host.querySelector('[data-testid="window-title"]')?.textContent).toContain(
      '*** Công trình: Ví dụ I — Phụ lục D.1 (TCCS 38:2022/TCĐBVN)',
    );

    // TreeView should now list Phương án 1 (Phụ lục D.1) and verification subnodes
    const treeText = host.querySelector('[role="tree"]')?.textContent ?? '';
    expect(treeText).toContain('Kết cấu áo đường - Phương án 1 (Phụ lục D.1)');
    expect(treeText).toContain('Độ võng đàn hồi');
    expect(treeText).toContain('Cắt trượt');
    expect(treeText).toContain('Kéo uốn');

    // Navigate via TreeView to Độ võng đàn hồi
    clickTreeItem(host, 'Độ võng đàn hồi');
    expect(host.querySelectorAll('[role="tab"]').length).toBe(1);
    expect(host.querySelector('[role="tab"]')?.textContent).toContain('Độ võng đàn hồi');
    expect(host.querySelector('[data-testid="tab-verify-vong"]')).not.toBeNull();
    expect(host.querySelector('[data-report="rv_Vong"]')).not.toBeNull();

    // Switch to Cắt trượt & Kéo uốn via TreeView
    clickTreeItem(host, 'Cắt trượt');
    expect(host.querySelectorAll('[role="tab"]').length).toBe(1);
    expect(host.querySelector('[role="tab"]')?.textContent).toContain('Cắt trượt');
    expect(host.querySelector('[data-report="rv_Truot"]')).not.toBeNull();

    clickTreeItem(host, 'Kéo uốn');
    expect(host.querySelectorAll('[role="tab"]').length).toBe(1);
    expect(host.querySelector('[role="tab"]')?.textContent).toContain('Kéo uốn');
    expect(host.querySelector('[data-report="rv_KeoUon"]')).not.toBeNull();
  });

  it('switches Ribbon tabs (HOME, CÔNG CỤ, GIÚP ĐỠ) and performs interactive Toán đồ 3-1..3-6 lookup including #N/A', () => {
    const toolsTab = Array.from(host.querySelectorAll('.adm-ribbon-tab')).find((b) =>
      b.textContent?.includes('CÔNG CỤ'),
    );
    click(toolsTab ?? null);

    const td31Btn = Array.from(host.querySelectorAll('.adm-rib-large-btn')).find((b) =>
      b.textContent?.includes('Toán đồ 3-1'),
    );
    click(td31Btn ?? null);
    expect(host.querySelector('[data-testid="tab-toando-3-1"]')).not.toBeNull();
    expect(host.querySelector('.adm-toando-badge')?.textContent).toContain(
      'TCCS 38:2022/TCĐBVN · Hình 2',
    );

    const outEl = host.querySelector('#td-3-1-out') as HTMLInputElement;
    expect(outEl.value).not.toBe('#N/A');

    // Out-of-domain input -> #N/A
    const xEl = host.querySelector('#td-3-1-x') as HTMLInputElement;
    changeInput(xEl, '9.5');
    expect((host.querySelector('#td-3-1-out') as HTMLInputElement).value).toBe('#N/A');

    // Switch to HELP tab, verify "Về chương trình" is removed, and open TCCS 38:2022 modal
    const helpTab = Array.from(host.querySelectorAll('.adm-ribbon-tab')).find((b) =>
      b.textContent?.includes('GIÚP ĐỠ'),
    );
    click(helpTab ?? null);
    const aboutBtn = Array.from(host.querySelectorAll('.adm-rib-large-btn')).find((b) =>
      b.textContent?.includes('Về chương trình'),
    );
    expect(aboutBtn).toBeUndefined();

    const tcBtn = Array.from(host.querySelectorAll('.adm-rib-large-btn')).find((b) =>
      b.textContent?.includes('TCCS 38:2022'),
    );
    click(tcBtn ?? null);
    expect(host.querySelector('[aria-label="Tiêu chuẩn TCCS 38:2022/TCĐBVN"]')).not.toBeNull();
    click(host.querySelector('.adm-modal-close'));
  });

  it('supports Tab 4 panel_Ett popup, Tham khảo Bảng 2 & Bảng F.1 modal, B2 option, Tab 5 layer add/save, and Export Excel modal', () => {
    click(host.querySelector('[data-testid="btn-load-sample"]'));

    clickTreeItem(host, 'Thông số thiết kế áo đường');
    expect(host.querySelectorAll('[role="tab"]').length).toBe(1);
    expect(host.querySelector('[role="tab"]')?.textContent).toContain('Thông số thiết kế áo đường');
    expect(host.querySelector('[data-testid="tab-thong-so"]')).not.toBeNull();

    // Verify B2 surface grade option
    const gradeSelect = host.querySelector('#cb_LoaiTangMat') as HTMLSelectElement;
    const gradeOpts = Array.from(gradeSelect.options).map((o) => o.value);
    expect(gradeOpts).toContain('B2');
    changeInput(gradeSelect, 'B2');
    expect(host.querySelector('[data-testid="note-b2-exempt"]')).not.toBeNull();
    changeInput(gradeSelect, 'A1');

    // Open panel_Ett popup and verify TCCS 38:2022 citations + Escape / outside click dismiss
    const ettBtn = host.querySelector('button[title*="Eyc"]') ?? null;
    click(ettBtn);
    expect(host.querySelector('#ed_Eyc')).not.toBeNull();
    expect(host.querySelector('#ed_Emin')).not.toBeNull();
    expect(host.querySelector('.adm-ett-popup')?.textContent).toContain('Bảng 9 tr. 23');
    expect(host.querySelector('.adm-ett-popup')?.textContent).toContain('Bảng 10 tr. 24');
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(host.querySelector('.adm-ett-popup')).toBeNull();

    click(ettBtn);
    expect(host.querySelector('.adm-ett-popup')).not.toBeNull();
    act(() => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(host.querySelector('.adm-ett-popup')).toBeNull();

    // Open Tham khảo modal (TCCS 38:2022 Bảng 2 & Bảng F.1 HTML tables)
    const tkBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Tham khảo'),
    );
    click(tkBtn ?? null);
    expect(host.querySelector('[aria-label="Chọn loại tầng mặt theo TCCS 38:2022"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="table-ref-bang2"]')?.textContent).toContain('Cấp thấp B2');
    expect(host.querySelector('[data-testid="table-ref-bangf1"]')?.textContent).toContain('12,5');
    click(host.querySelector('.adm-modal-close'));

    // Go to Kết cấu áo đường tab via CTA
    const ctaBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Chọn kết cấu áo đường'),
    );
    click(ctaBtn ?? null);
    expect(host.querySelector('[data-testid="tab-ket-cau"]')).not.toBeNull();

    // Add a base layer and save
    const addBaseBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Thêm lớp tầng móng'),
    );
    click(addBaseBtn ?? null);
    expect(host.querySelector('[data-testid="btn-save-kcad"]')?.textContent).toContain('*');
    click(host.querySelector('[data-testid="btn-save-kcad"]'));
    expect(host.querySelector('[data-testid="btn-save-kcad"]')?.textContent).not.toContain('*');

    // Open Export Excel modal
    click(host.querySelector('[data-testid="btn-export-excel"]'));
    const exportDialog = host.querySelector('[aria-label="Xuất kết quả sang Excel"]');
    expect(exportDialog).not.toBeNull();
    expect(exportDialog?.textContent).toContain('Phương án 1 (Phụ lục D.1)');
  });

  it('displays Bảng 7 reliability warning, LGC Điều 7.11/5.12.2 notes, and Subgrade K=0.98 + damNenCaiTien (+20% E0)', () => {
    // Switch to LGC in Project Info
    const lgcRadio = Array.from(host.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Kết cấu lề gia cố'),
    )?.querySelector('input');
    click(lgcRadio ?? null);

    // Go to Quy mô thiết kế
    clickTreeItem(host, 'Quy mô thiết kế');
    expect(host.querySelector('[role="tab"]')?.textContent).toContain('Quy mô thiết kế');
    expect(host.querySelector('[data-testid="note-lgc-dieu711"]')).not.toBeNull();

    // Check gpcBen -> Điều 5.12.2 note appears
    const gpcBenChk = Array.from(host.querySelectorAll('label')).find((l) =>
      l.textContent?.trim() === 'Bên',
    )?.querySelector('input');
    click(gpcBenChk ?? null);
    expect(host.querySelector('[data-testid="warn-lgc-dieu512"]')).not.toBeNull();

    // Select Đường cao tốc and set reliability below 0.90 -> Bảng 7 warning
    changeInput(host.querySelector('#cb_CapDuong') as HTMLSelectElement, 'Đường cao tốc');
    changeInput(host.querySelector('#cb_DoTinCayTK') as HTMLSelectElement, '0.80');
    const warn = host.querySelector('[data-testid="warn-bang7-reliability"]');
    expect(warn).not.toBeNull();
    expect(warn?.textContent).toContain('0.90');

    changeInput(host.querySelector('#cb_DoTinCayTK') as HTMLSelectElement, '0.95');
    expect(host.querySelector('[data-testid="warn-bang7-reliability"]')).toBeNull();

    // Go to Đất nền
    clickTreeItem(host, 'Đất nền');
    expect(host.querySelector('[role="tab"]')?.textContent).toContain('Đất nền');

    // Verify K=0.98 option
    const kSelect = host.querySelector('#cb_DoChatK') as HTMLSelectElement;
    expect(Array.from(kSelect.options).map((o) => o.value)).toContain('0.98');

    // Enable Xác định theo độ ẩm tương đối, verify Á cát bụi nặng, and toggle damNenCaiTien
    const moistureChk = Array.from(host.querySelectorAll('label')).find((l) =>
      l.textContent?.includes('Xác định theo độ ẩm tương đối'),
    )?.querySelector('input');
    click(moistureChk ?? null);

    const soilSelect = host.querySelector('#cb_LoaiDat') as HTMLSelectElement;
    const soilOpts = Array.from(soilSelect.options).map((o) => o.value);
    expect(soilOpts).toContain('Á cát bụi nặng');
    expect(soilOpts).not.toContain('Á sét bụi nặng');

    changeInput(soilSelect, 'Sét');
    changeInput(host.querySelector('#sp_DoAmTuongDoi') as HTMLInputElement, '0.55');
    expect((host.querySelector('#sp_Module_E') as HTMLInputElement).value).toBe('46');

    click(host.querySelector('#chk_DamNenCaiTien'));
    expect(parseFloat((host.querySelector('#sp_Module_E') as HTMLInputElement).value)).toBeCloseTo(
      55.2,
      2,
    );
  });

  it('enables CAI_TAO mode, renders Áo đường cũ (Chương 10) with Benkelman/FWD/LayerStack, Bù vênh, and F5 verification', () => {
    // Initially only active tab rendered and Áo đường cũ absent in TreeView in TK_MOI mode
    expect(host.querySelectorAll('[role="tab"]').length).toBe(1);
    expect(host.querySelector('[role="tree"]')?.textContent).not.toContain('Áo đường cũ (Chương 10)');

    // Enable "Cải tạo, nâng cấp"
    const rehabRadio = host.querySelector('[data-testid="radio-loai-cai-tao"]') as HTMLInputElement;
    expect(rehabRadio).not.toBeNull();
    expect(rehabRadio.disabled).toBe(false);
    click(rehabRadio);

    expect(host.querySelector('[data-testid="info-cai-tao"]')).not.toBeNull();
    // Single active tab still rendered; TreeView now includes Áo đường cũ (Chương 10)
    expect(host.querySelectorAll('[role="tab"]').length).toBe(1);
    expect(host.querySelector('[role="tree"]')?.textContent).toContain('Áo đường cũ (Chương 10)');

    // Check TabSubgrade banner
    clickTreeItem(host, 'Đất nền');
    expect(host.querySelector('[role="tab"]')?.textContent).toContain('Đất nền');
    expect(host.querySelector('[data-testid="banner-subgrade-ch10"]')?.textContent).toContain(
      'Thông số đất nền cũ (§9.2.5.5, §10.3.3)',
    );

    // Navigate to Áo đường cũ (Chương 10)
    clickTreeItem(host, 'Áo đường cũ (Chương 10)');
    expect(host.querySelector('[role="tab"]')?.textContent).toContain('Áo đường cũ (Chương 10)');
    expect(host.querySelector('[data-testid="tab-ao-duong-cu"]')).not.toBeNull();

    // Test segment length warning (> 1000 m) & Table 13 modal
    changeInput(host.querySelector('#ed_SegLen') as HTMLInputElement, '1200');
    expect(host.querySelector('[data-testid="warn-segment-length"]')).not.toBeNull();

    changeInput(host.querySelector('#ed_RutDepth') as HTMLInputElement, '28');
    expect(host.querySelector('[data-testid="badge-rut"]')?.textContent).toBe('Nặng');

    click(host.querySelector('[data-testid="btn-ref-bang13"]'));
    expect(host.querySelector('[data-testid="table-ref-bang13"]')?.textContent).toContain('Nứt thành lưới');
    click(host.querySelector('.adm-modal-close'));

    // Switch to BENKELMAN and enter 1.00 mm readings (Ech,cu = 180.18 MPa at p=0.6, D=33, mu=0.3)
    click(host.querySelector('[data-testid="radio-ech-BENKELMAN"]'));
    const ptsArea = host.querySelector('[data-testid="benkelman-points-input"]') as unknown as HTMLInputElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(ptsArea, '1.00, 1.00, 1.00');
      ptsArea.dispatchEvent(new Event('input', { bubbles: true }));
      ptsArea.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(host.querySelector('[data-testid="benkelman-ech-value"]')?.textContent).toContain('180.18 MPa');

    // Switch to DIRECT_FWD
    click(host.querySelector('[data-testid="radio-ech-DIRECT_FWD"]'));
    changeInput(host.querySelector('[data-testid="input-direct-ech"]') as HTMLInputElement, '140');
    changeInput(host.querySelector('[data-testid="input-direct-kdc"]') as HTMLInputElement, '0.9');
    expect(host.querySelector('[data-testid="fwd-effective-ech"]')?.textContent).toContain('126.00 MPa');

    // Switch to LAYER_STACK and add an existing layer + adjust K_hh
    click(host.querySelector('[data-testid="radio-ech-LAYER_STACK"]'));
    click(host.querySelector('[data-testid="btn-add-old-base"]'));
    expect(host.querySelector('[data-testid="table-existing-layers"]')).not.toBeNull();
    changeInput(host.querySelector('[data-testid="input-khh-0"]') as HTMLInputElement, '0.8');
    expect(parseFloat(host.querySelector('[data-testid="layer-stack-ech-value"]')?.textContent ?? '0')).toBeGreaterThan(0);

    // Check TabDesignParams displays Ech,cũ summary
    clickTreeItem(host, 'Thông số thiết kế áo đường');
    expect(host.querySelector('[role="tab"]')?.textContent).toContain('Thông số thiết kế áo đường');
    expect(host.querySelector('[data-testid="design-params-ch10-summary"]')?.textContent).toContain('Ech,cũ');

    // Check TabPavementStructure Bù vênh button, checkbox & §10.2.1.3 inorganic warning
    clickTreeItem(host, 'Kết cấu áo đường - Phương án 1');
    expect(host.querySelector('[role="tab"]')?.textContent).toContain('Kết cấu áo đường');
    click(host.querySelector('[data-testid="btn-add-bu-venh"]'));
    const buVenhChk = host.querySelector('[data-testid="chk-bu-venh-0"]') as HTMLInputElement;
    expect(buVenhChk.checked).toBe(true);
    const matInput = host.querySelector('[data-testid="table-kcad"] tbody tr td:nth-child(3) input') as HTMLInputElement;
    changeInput(matInput, 'Cấp phối đá gia cố xi măng');
    expect(host.querySelector('[data-testid="warn-bu-venh-inorganic"]')).not.toBeNull();

    // Load Chapter 10 sample via Ribbon and run F5 verification
    click(host.querySelector('[data-testid="btn-load-sample-ch10"]'));
    expect(host.querySelector('[data-testid="tab-ao-duong-cu"]')).not.toBeNull();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F5' }));
    });
    expect(host.querySelector('[data-report="rv_Vong"]')?.textContent).toContain('Chương 10');

    clickTreeItem(host, 'Cắt trượt');
    expect(host.querySelector('[role="tab"]')?.textContent).toContain('Cắt trượt');
    expect(host.querySelector('[data-report="rv_Truot"]')).not.toBeNull();

    clickTreeItem(host, 'Kéo uốn');
    expect(host.querySelector('[role="tab"]')?.textContent).toContain('Kéo uốn');
    expect(host.querySelector('[data-report="rv_KeoUon"]')).not.toBeNull();
  });
});
