// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Landing } from '../../src/landing/Landing';
import { ModuleSwitch, MODULES } from '../../src/shared/ModuleSwitch';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const text = (rel: string) => readFileSync(path.join(webRoot, rel), 'utf8');

let host: HTMLDivElement;
let r: Root;
beforeEach(() => {
  localStorage.clear();
  host = document.createElement('div');
  document.body.appendChild(host);
  r = createRoot(host);
});
afterEach(async () => {
  await act(async () => r.unmount());
  host.remove();
});

describe('Phân hệ Hố ga trong site LEDAT-BIM', () => {
  it('trang chủ có 5 thẻ phân hệ, thẻ Hố ga trỏ tới ho-ga/', async () => {
    await act(async () => r.render(<Landing />));
    const cards = [...host.querySelectorAll<HTMLAnchorElement>('.lp-card')];
    expect(cards.map((c) => c.dataset.mod)).toEqual(['walls', 'culvert', 'hoga', 'pavement', 'toando']);
    expect(cards[2].getAttribute('href')).toMatch(/ho-ga\/$/);
    expect(host.textContent).toContain('Năm phân hệ');
  });

  it('trang chủ gợi ý tiếp tục khi có bản nháp hố ga', async () => {
    localStorage.setItem('ledat-hoga:draft', JSON.stringify({ title: 'Đường A', rows: [{}, {}, {}] }));
    await act(async () => r.render(<Landing />));
    expect(host.querySelector('.lp-card[data-mod="hoga"] .lp-resume')!.textContent).toContain('3 ga');
  });

  it('thanh chuyển phân hệ có Hố ga và đánh dấu trang hiện tại', async () => {
    expect(MODULES.map((m) => m.id)).toEqual(['walls', 'culvert', 'hoga', 'pavement', 'toando']);
    await act(async () => r.render(<ModuleSwitch current="hoga" />));
    const links = [...host.querySelectorAll<HTMLAnchorElement>('.modsw a')];
    expect(links.map((a) => a.dataset.mod)).toEqual(['home', 'walls', 'culvert', 'hoga', 'pavement', 'toando']);
    expect(host.querySelector('a[data-mod="hoga"]')!.getAttribute('aria-current')).toBe('page');
    expect(host.querySelector('a[data-mod="walls"]')!.getAttribute('aria-current')).toBeNull();
  });

  it('trang, cấu hình build và Vercel đã nối đủ', () => {
    expect(text('ho-ga/index.html')).toContain('/src/hoga/main.tsx');
    const vite = text('vite.config.ts');
    expect(vite).toContain("hoga: page('./ho-ga/index.html')");
    expect(vite).toContain('ho-ga');
    expect(text('vercel.json')).toContain('"/ho-ga"');
  });
});
