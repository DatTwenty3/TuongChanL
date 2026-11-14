/**
 * Cột "Mục tính toán" của phân hệ Cầu cống: ô tìm mục, danh sách mục theo nhóm (TabStrip) và
 * chấm trạng thái ✓ / ✗ cạnh mỗi mục (đọc từ kết quả đã vẽ trong pane, xem tabStatus.ts).
 */

import { useEffect, useRef, useState } from 'react';
import type { AppMode, ItemKey, TabId } from '../types/project.ts';
import { TabStrip } from './TabStrip.tsx';
import { computeTabStatuses } from './tabStatus.ts';

export interface CvNavProps {
  mode: AppMode;
  activeTab: TabId;
  onSelectTab: (tabId: TabId) => void;
  disabledItems?: readonly ItemKey[];
}

/** Bỏ dấu tiếng Việt, hạ chữ thường để tìm không dấu. */
export function foldVi(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export function CvNav(props: CvNavProps) {
  const [q, setQ] = useState('');
  const navRef = useRef<HTMLElement | null>(null);

  // Lọc theo ô tìm: ẩn tab không khớp và tiêu đề nhóm không còn tab nào
  useEffect(() => {
    const root = navRef.current;
    if (!root) return;
    const key = foldVi(q.trim());
    const items = [...root.querySelectorAll<HTMLElement>('.tabs > .tgrp, .tabs > .tab')];
    let group: HTMLElement | null = null;
    let groupHit = false;
    const flush = () => {
      if (group) group.toggleAttribute('data-qhide', !!key && !groupHit);
    };
    for (const el of items) {
      if (el.classList.contains('tgrp')) {
        flush();
        group = el;
        groupHit = false;
        continue;
      }
      const hit = !key || foldVi(el.textContent || '').includes(key);
      el.toggleAttribute('data-qhide', !hit);
      if (hit && !el.hidden) groupHit = true;
    }
    flush();
  });

  // Chấm trạng thái: tính lại (gộp 250 ms) mỗi khi nội dung bảng tính thay đổi
  useEffect(() => {
    if (typeof document === 'undefined') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const paint = () => {
      const st = computeTabStatuses();
      navRef.current?.querySelectorAll<HTMLElement>('.tabs .tab[data-t]').forEach((b) => {
        const s = st.get(Number(b.dataset.t)) ?? null;
        if (s) {
          b.dataset.st = s;
          b.title = s === 'ok' ? 'Các hạng mục đã kiểm đều đạt' : 'Có hạng mục không đạt hoặc cảnh báo — mở mục để xem';
        } else {
          delete b.dataset.st;
          b.removeAttribute('title');
        }
      });
    };
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(paint, 250);
    };
    const sheet = document.getElementById('sheet');
    const mo = new MutationObserver(schedule);
    if (sheet) {
      mo.observe(sheet, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['class', 'hidden'],
      });
    }
    schedule();
    return () => {
      mo.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [props.mode]);

  return (
    <aside className="cv-nav noprint" aria-label="Mục tính toán" ref={navRef}>
      <div className="cv-nav-ttl">Mục tính toán</div>
      <input
        id="cvNavQ"
        className="cv-nav-q"
        type="search"
        placeholder="Tìm mục… (vd: cọc, mố, thủy văn)"
        aria-label="Tìm mục tính toán"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoComplete="off"
      />
      <TabStrip {...props} />
    </aside>
  );
}
