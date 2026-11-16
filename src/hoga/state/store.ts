import { useSyncExternalStore } from 'react';
import type { GaKind, GaRow, HoGaProject } from '../engine/types';
import { defaultProject, emptyRow } from '../engine/defaults';
import { parseProject } from '../export/projectIo';
import { readTheme, writeTheme } from '../../shared/theme';

export type Tab = 'draw' | 'qty' | 'steel' | 'config' | 'catalog';
export type SheetTab = 'vhg1' | 'vhg2' | 'vhg3' | 'vhg4' | 'vhg5' | 'lid' | 'summary';
export type Theme = 'light' | 'dark';

export interface Toast {
  msg: string;
  kind: 'ok' | 'err' | 'wait';
  id: number;
}

export interface UiState {
  project: HoGaProject;
  /** chỉ số ga đang chọn */
  sel: number;
  tab: Tab;
  sheet: SheetTab;
  theme: Theme;
  toast: Toast | null;
  dirty: boolean;
  /** tỷ lệ bản vẽ: 'auto' hoặc mẫu số */
  scale: 'auto' | number;
  /** số cột hình trên một tờ: tự động hoặc 2 / 3 (như "Nhóm 2 cột / 3 cột" của VHGpro) */
  cols: 'auto' | 2 | 3;
  past: HoGaProject[];
  future: HoGaProject[];
  draftOffered: boolean;
}

const DRAFT_KEY = 'ledat-hoga:draft';

function safeGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function safeSet(k: string, v: string): void {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* bỏ qua: chế độ riêng tư / hết dung lượng */
  }
}

/** Giao diện sáng/tối dùng chung với các phân hệ khác của site (cùng khoá localStorage). */
const initialTheme = (): Theme => readTheme();

let state: UiState = {
  project: defaultProject('lienKhoi'),
  sel: 0,
  tab: 'draw',
  sheet: 'vhg1',
  theme: initialTheme(),
  toast: null,
  dirty: false,
  scale: 'auto',
  cols: 'auto',
  past: [],
  future: [],
  draftOffered: safeGet(DRAFT_KEY) !== null,
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useStore<T>(sel: (s: UiState) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state));
}
export const getState = (): UiState => state;

function set(patch: Partial<UiState>): void {
  state = { ...state, ...patch };
  emit();
}

let draftTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleDraft(): void {
  if (draftTimer) clearTimeout(draftTimer);
  draftTimer = setTimeout(() => safeSet(DRAFT_KEY, JSON.stringify(state.project)), 600);
}

const HISTORY = 60;
let lastEdit = 0;

/** Ghi lại project mới; các lần sửa liên tiếp trong 700 ms gộp thành một bước hoàn tác. */
export function commit(next: HoGaProject, opts: { coalesce?: boolean } = {}): void {
  const now = Date.now();
  const merge = opts.coalesce && now - lastEdit < 700 && state.past.length > 0;
  lastEdit = now;
  const past = merge ? state.past : [...state.past, state.project].slice(-HISTORY);
  state = { ...state, project: next, past, future: [], dirty: true };
  emit();
  scheduleDraft();
}

export function undo(): void {
  if (!state.past.length) return;
  const prev = state.past[state.past.length - 1];
  state = { ...state, project: prev, past: state.past.slice(0, -1), future: [state.project, ...state.future], sel: Math.min(state.sel, prev.rows.length - 1) };
  emit();
  scheduleDraft();
}
export function redo(): void {
  if (!state.future.length) return;
  const nxt = state.future[0];
  state = { ...state, project: nxt, past: [...state.past, state.project], future: state.future.slice(1), sel: Math.min(state.sel, nxt.rows.length - 1) };
  emit();
  scheduleDraft();
}

export const actions = {
  setTab: (tab: Tab) => set({ tab }),
  setSheet: (sheet: SheetTab) => set({ sheet }),
  setScale: (scale: 'auto' | number) => set({ scale }),
  setCols: (cols: 'auto' | 2 | 3) => set({ cols }),
  select: (sel: number) => set({ sel: Math.max(0, Math.min(sel, state.project.rows.length - 1)) }),
  setTheme(theme: Theme) {
    writeTheme(theme);
    set({ theme });
  },
  toast(msg: string, kind: Toast['kind'] = 'ok', ms = 4200) {
    const id = Date.now();
    set({ toast: { msg, kind, id } });
    if (ms > 0) setTimeout(() => state.toast?.id === id && set({ toast: null }), ms);
  },
  /** Chọn loại ga mới: nạp dữ liệu mẫu và cấu hình mặc định của loại đó. */
  newProject(kind: GaKind) {
    commit(defaultProject(kind));
    set({ sel: 0, dirty: false });
  },
  load(p: HoGaProject) {
    commit(p);
    set({ sel: 0, dirty: false });
  },
  markClean: () => set({ dirty: false }),
  /** Đặt lại toàn bộ trạng thái làm việc (dùng khi khởi động lại và trong kiểm thử). */
  reset(kind: GaKind = 'lienKhoi') {
    state = { ...state, project: defaultProject(kind), sel: 0, tab: 'draw', sheet: 'vhg1', scale: 'auto', cols: 'auto', toast: null, dirty: false, past: [], future: [], draftOffered: false };
    emit();
  },
  updateRow(i: number, patch: (r: GaRow) => GaRow, coalesce = true) {
    const rows = state.project.rows.map((r, k) => (k === i ? patch(structuredClone(r)) : r));
    commit({ ...state.project, rows }, { coalesce });
  },
  addRow() {
    const base = state.project.rows[state.sel] ?? emptyRow();
    const r = structuredClone(base);
    r.name = `${base.name}-copy`;
    const rows = [...state.project.rows, r];
    commit({ ...state.project, rows });
    set({ sel: rows.length - 1 });
  },
  addBlank() {
    const rows = [...state.project.rows, emptyRow(`G${state.project.rows.length + 1}`)];
    commit({ ...state.project, rows });
    set({ sel: rows.length - 1 });
  },
  deleteRow(i: number) {
    if (state.project.rows.length <= 1) return;
    const rows = state.project.rows.filter((_, k) => k !== i);
    commit({ ...state.project, rows });
    set({ sel: Math.min(state.sel, rows.length - 1) });
  },
  updateProject(patch: (p: HoGaProject) => HoGaProject, coalesce = true) {
    commit(patch(structuredClone(state.project)), { coalesce });
  },
  dismissDraft: () => set({ draftOffered: false }),
  restoreDraft() {
    const t = safeGet(DRAFT_KEY);
    if (!t) return;
    try {
      commit(parseProject(t));
      set({ sel: 0, draftOffered: false });
    } catch {
      set({ draftOffered: false });
    }
  },
};
