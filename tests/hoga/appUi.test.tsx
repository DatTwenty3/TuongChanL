// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { App } from '../../src/hoga/App';
import { actions, getState } from '../../src/hoga/state/store';
import { GA_KIND_ORDER } from '../../src/hoga/engine/types';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

const $ = <T extends Element = HTMLElement>(sel: string) => host.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string) => [...host.querySelectorAll<T>(sel)];

async function setInput(el: HTMLInputElement | HTMLSelectElement, value: string) {
  await act(async () => {
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}
async function click(el: Element | null) {
  expect(el).not.toBeNull();
  await act(async () => {
    (el as HTMLElement).click();
  });
}

beforeEach(async () => {
  (window as unknown as { confirm: () => boolean }).confirm = () => true;
  localStorage.clear();
  actions.reset('lienKhoi');
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root.render(<App />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe('Giao diện LEDAT Hố Ga', () => {
  it('hiển thị bảng 20 ga, thẻ chỉ tiêu và bản vẽ SVG', () => {
    expect($$('tr[data-row]')).toHaveLength(20);
    expect($$('#sum .card')).toHaveLength(6);
    expect($('#stage svg')).not.toBeNull();
    expect($('#sinfo')!.textContent).toContain('G400-1');
    expect($('#selKind')).not.toBeNull();
  });

  it('sửa kích thước cập nhật chỉ tiêu, hoàn tác / làm lại hoạt động', async () => {
    const before = $('#sum')!.textContent;
    const inp = $$<HTMLInputElement>('input[aria-label="Dài"]')[0];
    expect($<HTMLButtonElement>('#bUndo')!.disabled).toBe(true);
    await setInput(inp, '2600');
    expect(getState().project.rows[0].L).toBe(2600);
    expect($('#sum')!.textContent).not.toBe(before);
    expect($<HTMLButtonElement>('#bUndo')!.disabled).toBe(false);
    expect($('#bSave')!.getAttribute('data-dirty')).toBe('1');
    await click($('#bUndo'));
    expect(getState().project.rows[0].L).toBe(2000);
    await click($('#bRedo'));
    expect(getState().project.rows[0].L).toBe(2600);
  });

  it('chuyển các tab chính và tab bản vẽ', async () => {
    await click($('#tab_qty'));
    expect($('#thkl')).not.toBeNull();
    expect($$('#thkl tbody tr').length).toBeGreaterThan(15);
    await click($('#tab_steel'));
    expect($('#bars')).not.toBeNull();
    await click($('#tab_config'));
    expect($('#cf_liner_l1T')).not.toBeNull();
    await click($('#tab_catalog'));
    expect($$('.catalogview table')).toHaveLength(4);
    await click($('#tab_draw'));
    const tabs = $$('#tabs button');
    expect(tabs).toHaveLength(6);
    for (const t of tabs) {
      await click(t);
      expect($('#stage')).not.toBeNull();
      // ga liền khối dùng nắp gang → tờ "Tấm nắp" chỉ có ghi chú
      if (t.textContent === 'Tấm nắp') expect($('#stage')!.textContent).toContain('nắp gang');
      else expect($('#stage svg')).not.toBeNull();
    }
    expect($('#sinfo')!.textContent).toContain('TỔNG HỢP');
  });

  it('tờ tấm nắp và lưới thép tường có bản vẽ với ga không cổ', async () => {
    await setInput($<HTMLSelectElement>('#selKind')!, 'khongCo');
    await click($$('#tabs button').find((t) => t.textContent === 'Tấm nắp')!);
    expect($('#stage svg')).not.toBeNull();
    expect($('#sinfo')!.textContent).toContain('Tấm nắp');
    await click($$('#tabs button').find((t) => t.textContent === 'Lưới thép tường')!);
    expect($('#stage svg')).not.toBeNull();
    expect($('#sinfo')!.textContent).toContain('Lưới thép tường');
  });

  it('đổi bố cục 2 cột / 3 cột', async () => {
    await click($$('#tabs button').find((t) => t.textContent === 'Cốt thép')!);
    const before = $('#stage')!.innerHTML;
    await setInput($<HTMLSelectElement>('#selCols')!, '2');
    expect(getState().cols).toBe(2);
    expect($('#stage')!.innerHTML).not.toBe(before);
  });

  it('đổi lớp bê tông bảo vệ làm đổi khối lượng thép', async () => {
    const steel = () => $$('#sum .card').find((c) => c.textContent?.includes('Cốt thép'))!.textContent;
    const before = steel();
    await click($('#tab_config'));
    await setInput($<HTMLInputElement>('#cf_cover_bottom')!, '40');
    expect(getState().project.config.cover.bottom).toBe(40);
    expect(steel()).not.toBe(before);
  });

  it('chọn từng loại ga: dựng lại bảng, không lỗi, có/không cột cổ ga', async () => {
    for (const k of GA_KIND_ORDER) {
      await setInput($<HTMLSelectElement>('#selKind')!, k);
      expect(getState().project.kind).toBe(k);
      expect($$('tr[data-row]')).toHaveLength(20);
      expect($('#stage svg')).not.toBeNull();
      expect($('#sinfo')!.textContent).not.toContain('NaN');
      const hasNeck = k !== 'khongCo';
      expect($$('th').some((th) => th.textContent === 'Cao cổ')).toBe(hasNeck);
    }
  });

  it('thêm, nhân bản và xoá ga', async () => {
    await click($('#bAdd'));
    expect($$('tr[data-row]')).toHaveLength(21);
    await click($('#bDup'));
    expect($$('tr[data-row]')).toHaveLength(22);
    await click($('#bDel'));
    await click($('#bDel'));
    expect($$('tr[data-row]')).toHaveLength(20);
  });

  it('cống sai định dạng hiện cảnh báo', async () => {
    const pipe = $$<HTMLInputElement>('input[aria-label="Cống T2"]')[0];
    await setInput(pipe, 'ABC');
    expect($('#warn')!.textContent).toContain('sai định dạng');
    expect(pipe.className).toContain('bad');
  });

  it('bản nháp: lưu cục bộ và khôi phục', async () => {
    await setInput($$<HTMLInputElement>('input[aria-label="Dài"]')[0], '2222');
    await new Promise((r) => setTimeout(r, 700));
    expect(localStorage.getItem('ledat-hoga:draft')).toContain('2222');
    await act(async () => actions.reset('lienKhoi'));
    expect(getState().project.rows[0].L).toBe(2000);
    await act(async () => actions.restoreDraft());
    expect(getState().project.rows[0].L).toBe(2222);
  });
});
