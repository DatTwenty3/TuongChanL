/**
 * Trạng thái đạt / không đạt của từng mục (tab), đọc từ chính các ô kết quả mà engine đã vẽ vào pane:
 * `.ok` = đạt, `.bad` = không đạt (class do engine gắn khi dựng bảng kiểm toán). Không tính lại gì cả.
 * `null` = chưa có kết quả hiển thị (chưa tính / mục không có kiểm toán).
 */
export type TabState = 'ok' | 'bad' | null;

const NO_STATUS = new Set([7, 60]);

function shown(el: Element, pane: Element): boolean {
  for (let n: Element | null = el; n && n !== pane; n = n.parentElement) {
    const h = n as HTMLElement;
    if (h.hidden || h.style?.display === 'none') return false;
  }
  return true;
}

export function paneStatus(pane: HTMLElement): TabState {
  let ok = 0;
  let bad = 0;
  pane.querySelectorAll<HTMLElement>('.bad, .ok').forEach((e) => {
    if (!(e.textContent || '').trim() || !shown(e, pane)) return;
    if (e.classList.contains('bad')) bad += 1;
    else ok += 1;
  });
  return bad ? 'bad' : ok ? 'ok' : null;
}

/** Gộp nhiều tab: có một tab không đạt → không đạt; có kết quả và không tab nào hỏng → đạt. */
export function mergeStatus(list: readonly TabState[]): TabState {
  if (list.includes('bad')) return 'bad';
  return list.includes('ok') ? 'ok' : null;
}

export function computeTabStatuses(root: ParentNode = document): Map<number, TabState> {
  const out = new Map<number, TabState>();
  root.querySelectorAll<HTMLElement>('.pane[id^="tab"]').forEach((p) => {
    const n = Number(p.id.slice(3));
    if (!Number.isFinite(n) || NO_STATUS.has(n)) return;
    out.set(n, paneStatus(p));
  });
  return out;
}
