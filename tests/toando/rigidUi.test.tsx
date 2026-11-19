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

function changeInput(el: HTMLInputElement | HTMLSelectElement, value: string) {
  act(() => {
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('ToanDo-Web — mặt đường cứng BTXM (TCCS 39:2022)', () => {
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

  it('mặc định là mặt đường mềm: không có cây/tab mặt đường cứng', () => {
    expect(host.querySelector('[data-testid="tree-rigid"]')).toBeNull();
    expect(host.querySelector('[data-testid="rib-btn-cung-ket-cau"]')).toBeNull();
    expect(host.querySelector('[data-testid="btn-run-verification"]')).not.toBeNull();
  });

  it('chọn "Mặt đường cứng" ở Thông tin dự án: đổi cây điều hướng và các nút ribbon', () => {
    click(host.querySelector('[data-testid="radio-mat-cung"]'));
    expect(host.querySelector('[data-testid="tree-rigid"]')).not.toBeNull();
    for (const k of ['cung-giao-thong', 'cung-ket-cau', 'cung-khe-noi']) {
      expect(host.querySelector(`[data-testid="rib-btn-${k}"]`)).not.toBeNull();
    }
    // các nút chỉ của mặt đường mềm biến mất
    expect(host.textContent).not.toContain('Thêm phương án kết cấu');
    expect(host.textContent).not.toContain('Thành phần xe');
    // đổi lại mặt đường mềm
    click(host.querySelector('[data-testid="radio-mat-mem"]'));
    expect(host.querySelector('[data-testid="tree-rigid"]')).toBeNull();
    expect(host.textContent).toContain('Thêm phương án kết cấu');
  });

  it('đổi loại mặt đường trực tiếp trên thanh tiêu đề', () => {
    const title = host.querySelector('[data-testid="window-title"]');
    expect(title?.textContent).toBe('Áo đường mềm (TCCS 38:2022/TCĐBVN)');
    expect(host.querySelector('[data-testid="title-kind-menu"]')).toBeNull();
    click(title);
    expect(host.querySelector('[data-testid="title-kind-menu"]')).not.toBeNull();
    // thanh tiêu đề giữ nguyên chữ khi mở menu
    expect(title?.textContent).toBe('Áo đường mềm (TCCS 38:2022/TCĐBVN)');
    click(host.querySelector('[data-testid="title-kind-cung"]'));
    expect(host.querySelector('[data-testid="title-kind-menu"]')).toBeNull();
    expect(host.querySelector('[data-testid="tree-rigid"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="window-title"]')?.textContent).toContain(
      'Mặt đường cứng BTXM (TCCS 39:2022/TCĐBVN)',
    );
    click(host.querySelector('[data-testid="window-title"]'));
    click(host.querySelector('[data-testid="title-kind-mem"]'));
    expect(host.querySelector('[data-testid="tree-rigid"]')).toBeNull();
  });

  it('nạp ví dụ B.1: hiển thị kết quả ĐẠT, đủ công thức số hiệu, và sửa hc → KHÔNG ĐẠT', () => {
    click(host.querySelector('[data-testid="radio-mat-cung"]'));
    // mở menu ứng dụng và nạp ví dụ mặt đường cứng
    const appBtn = host.querySelector('button[aria-label="Menu ứng dụng"]');
    expect(appBtn).not.toBeNull();
    click(appBtn);
    click(host.querySelector('[data-testid="menu-sample-rigid"]'));

    const report = host.querySelector('[data-testid="rv-rigid-report"]');
    expect(report).not.toBeNull();
    expect(report!.textContent).toContain('Công thức (6) — Điều 8.2.2');
    expect(report!.textContent).toContain('Công thức (22) — Điều 8.3.6');
    expect(host.querySelector('[data-testid="rigid-overall"]')?.getAttribute('data-passed')).toBe('true');
    // Ví dụ B.1 ghi 3,889 và 4,121 (làm tròn trung gian); tính chính xác ra 3,892 và 4,122
    expect(report!.textContent).toContain('3,892');
    expect(report!.textContent).toContain('4,122');

    // sang tab kết cấu, giảm chiều dày tấm còn 0,15 m
    click(host.querySelector('[data-testid="rib-btn-cung-ket-cau"]'));
    const hc = host.querySelector('#rg_hc') as HTMLInputElement;
    expect(hc).not.toBeNull();
    changeInput(hc, '0.15');
    click(host.querySelector('[data-testid="tree-rigid-result"]'));
    expect(host.querySelector('[data-testid="rigid-overall"]')?.getAttribute('data-passed')).toBe('false');
    expect(host.querySelector('[data-testid="rigid-check-fatigue"]')?.textContent).toContain('KHÔNG đảm bảo');
  });

  it('nạp được cả hai ví dụ B.1 và B.2 của TCCS 39 (từ thanh trên và từ menu Tệp)', () => {
    // từ menu Tệp, ngay cả khi đang ở mặt đường mềm
    click(host.querySelector('button[aria-label="Menu ứng dụng"]'));
    click(host.querySelector('[data-testid="menu-sample-rigid-b2"]'));
    expect(host.querySelector('[data-testid="tree-rigid"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="window-title"]')?.textContent).toContain('Ví dụ B.2');
    expect(host.querySelector('[data-testid="rv-rigid-report"]')?.textContent).toContain('4,569'); // sách ghi 4,571 (làm tròn trung gian)
    // các nút nhanh trên thanh trên: B.1 / B.2 thay cho ví dụ TCCS 38
    expect(host.querySelector('[data-testid="btn-load-sample"]')).toBeNull();
    click(host.querySelector('[data-testid="btn-load-sample-b1"]'));
    expect(host.querySelector('[data-testid="window-title"]')?.textContent).toContain('Ví dụ B.1');
    expect(host.querySelector('[data-testid="rigid-overall"]')?.getAttribute('data-passed')).toBe('true');
    click(host.querySelector('[data-testid="btn-load-sample-b2"]'));
    expect(host.querySelector('[data-testid="window-title"]')?.textContent).toContain('Ví dụ B.2');
  });

  it('bật Ne tự tính và E0 từ Đất nền cập nhật kết quả', () => {
    click(host.querySelector('[data-testid="radio-mat-cung"]'));
    click(host.querySelector('[data-testid="rib-btn-cung-giao-thong"]'));
    const chk = host.querySelector('[data-testid="chk-ne-auto"]') as HTMLInputElement;
    click(chk);
    const summary = host.querySelector('[data-testid="rigid-ne-summary"]');
    expect(summary?.textContent).toMatch(/Ne\s*=\s*[\d,]+\s*lần/);
    click(host.querySelector('[data-testid="rib-btn-cung-ket-cau"]'));
    click(host.querySelector('[data-testid="chk-e0-subgrade"]'));
    expect((host.querySelector('#rg_E0') as HTMLInputElement).disabled).toBe(true);
  });
});
