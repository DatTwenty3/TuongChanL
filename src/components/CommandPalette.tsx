import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SHEET_DEFS } from '../cad';
import { D_TAB, appPresetKe, dIdxOf, fmt, pileOn, presetCanti, presetRib, presetWall4 } from '../engine';
import { useAppStore } from '../state/appStore';
import { KE_HS, keFirst } from './FieldControls';
import { Icon, type IconName } from './Icon';

interface Cmd {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: IconName;
  keys?: string;
  run: () => void;
}

/** Bỏ dấu tiếng Việt + chữ thường để tìm không cần gõ dấu. */
export function foldVi(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

/** Mọi từ trong truy vấn đều phải xuất hiện trong văn bản (đã bỏ dấu). */
export function matchQuery(text: string, query: string): boolean {
  const hay = foldVi(text);
  return foldVi(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
}

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag !== 'INPUT') return false;
  const type = (el as HTMLInputElement).type;
  return type !== 'checkbox' && type !== 'radio' && type !== 'range' && type !== 'button';
}

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');
const MOD = IS_MAC ? '⌘' : 'Ctrl';

interface FieldHit {
  label: string;
  section: string;
  el: HTMLElement;
}

/** Quét các ô nhập đang có trong bảng thông số (kể cả mục đang đóng) để tìm theo tên. */
function scanFields(): FieldHit[] {
  if (typeof document === 'undefined') return [];
  const out: FieldHit[] = [];
  document.querySelectorAll<HTMLElement>('#panel label.row, #panel label.chk').forEach((row) => {
    const lab = row.querySelector('.lab')?.textContent || row.textContent || '';
    const label = lab.replace(/\s+/g, ' ').trim();
    if (!label || label.length > 90) return;
    const section =
      row.closest('details')?.querySelector('summary')?.textContent?.replace(/\s+/g, ' ').trim() || '';
    out.push({ label, section, el: row });
  });
  return out;
}

function revealField(row: HTMLElement): void {
  let d = row.closest('details');
  while (d) {
    if (!d.open) d.open = true;
    d = d.parentElement?.closest('details') ?? null;
  }
  window.setTimeout(() => {
    row.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    row.classList.add('flash');
    window.setTimeout(() => row.classList.remove('flash'), 1600);
    const input = row.querySelector<HTMLElement>('input, select');
    input?.focus({ preventScroll: true });
    if (input instanceof HTMLInputElement && input.type !== 'checkbox') input.select?.();
  }, 60);
}

export interface CommandPaletteProps {
  sideOpen: boolean;
  setSideOpen: (open: boolean) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ sideOpen, setSideOpen }) => {
  const store = useAppStore();
  const {
    project,
    viewMode,
    cmdOpen,
    setCmdOpen,
    canUndo,
    canRedo,
    undo,
    redo,
    theme,
    toggleTheme,
    draft,
    restoreDraft,
    discardDraft,
    exportBusy,
  } = store;

  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const [fields, setFields] = useState<FieldHit[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Ref tới store mới nhất để bộ nghe phím chỉ gắn một lần.
  const live = useRef({ store, sideOpen, setSideOpen });
  live.current = { store, sideOpen, setSideOpen };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { store: s, sideOpen: so, setSideOpen: sso } = live.current;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && !e.altKey && k === 'k') {
        e.preventDefault();
        s.setCmdOpen(!s.cmdOpen);
        return;
      }
      if (s.cmdOpen) return;
      if (mod && !e.altKey && !e.shiftKey && k === 's') {
        e.preventDefault();
        s.saveProject();
        return;
      }
      if (mod && !e.altKey && !e.shiftKey && k === 'o') {
        e.preventDefault();
        document.getElementById('fOpen')?.click();
        return;
      }
      if (mod && !e.altKey && k === 'b') {
        e.preventDefault();
        sso(!so);
        return;
      }
      const editable = isEditable(e.target);
      if (mod && !e.altKey && k === 'z' && !editable) {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && !e.altKey && k === 'y' && !editable) {
        e.preventDefault();
        s.redo();
        return;
      }
      if (mod || e.altKey || editable) return;
      if (k >= '1' && k <= '5') {
        s.selectSheetTab(Number(k) - 1);
      } else if (k === '6') {
        s.setViewMode('3d');
      } else if (k === '7') {
        s.setViewMode('calc');
      } else if (k === 'f' && s.viewMode === '2d') {
        s.requestFit2d();
      } else if (e.key === '/' || e.key === '?') {
        e.preventDefault();
        s.setCmdOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!cmdOpen) return;
    setQuery('');
    setSel(0);
    setFields(scanFields());
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [cmdOpen]);

  const commands = useMemo<Cmd[]>(() => {
    if (!cmdOpen) return [];
    const s = store;
    const out: Cmd[] = [];
    const nav = 'Điều hướng';
    SHEET_DEFS.forEach((d, i) =>
      out.push({
        id: 'sheet' + i,
        group: nav,
        label: `Bản vẽ ${i + 1} · ${d.name[0] + d.name.slice(1).toLowerCase()}`,
        icon: 'ruler',
        keys: String(i + 1),
        run: () => s.selectSheetTab(i),
      }),
    );
    out.push(
      { id: 'v3d', group: nav, label: 'Mô hình 3D', icon: 'cube', keys: '6', run: () => s.setViewMode('3d') },
      {
        id: 'vcalc',
        group: nav,
        label: 'Tính toán · Bảng tính kiểm toán',
        icon: 'calc',
        keys: '7',
        run: () => {
          s.setViewMode('calc');
          s.setCalcSub('sheet');
        },
      },
      {
        id: 'vgs',
        group: nav,
        label: 'Tính toán · Ổn định tổng thể',
        icon: 'calc',
        run: () => {
          s.setViewMode('calc');
          s.setCalcSub('gs');
        },
      },
      {
        id: 'vrb',
        group: nav,
        label: 'Tính toán · Bố trí thép',
        icon: 'calc',
        run: () => {
          s.setViewMode('calc');
          s.setCalcSub('rb');
        },
      },
    );
    if (pileOn(project)) {
      out.push({
        id: 'vpile',
        group: nav,
        label: 'Tính toán · Móng cọc',
        icon: 'calc',
        run: () => {
          s.setViewMode('calc');
          s.setCalcSub('pile');
        },
      });
    }

    const prj = 'Dự án';
    out.push(
      {
        id: 'open',
        group: prj,
        label: 'Mở dự án (.tcl.json)…',
        icon: 'open',
        keys: `${MOD} O`,
        run: () => document.getElementById('fOpen')?.click(),
      },
      { id: 'save', group: prj, label: 'Lưu dự án', icon: 'save', keys: `${MOD} S`, run: s.saveProject },
    );
    if (canUndo) out.push({ id: 'undo', group: prj, label: 'Hoàn tác thay đổi gần nhất', icon: 'undo', keys: `${MOD} Z`, run: undo });
    if (canRedo) out.push({ id: 'redo', group: prj, label: 'Làm lại', icon: 'redo', keys: `${MOD} Y`, run: redo });
    if (draft) {
      out.push(
        { id: 'draftR', group: prj, label: 'Khôi phục phiên làm việc trước', icon: 'history', run: restoreDraft },
        { id: 'draftX', group: prj, label: 'Bỏ bản nháp của phiên trước', icon: 'close', run: discardDraft },
      );
    }

    const exp = 'Xuất';
    if (viewMode === '2d') {
      out.push(
        { id: 'dxf', group: exp, label: 'Xuất DXF (cụm đang xem)', icon: 'download', run: () => s.exportDxf(false) },
        { id: 'svg', group: exp, label: 'Xuất SVG', icon: 'code', run: s.exportSvg },
      );
    }
    if (viewMode === '3d') {
      out.push({ id: 'png', group: exp, label: 'Ảnh 3D (PNG)', icon: 'image', run: () => void s.export3dPng() });
    }
    if (viewMode !== 'calc') {
      out.push(
        { id: 'dxfAll', group: exp, label: 'Xuất DXF tất cả cụm', icon: 'layers', run: () => s.exportDxf(true) },
        { id: 'csv', group: exp, label: 'Bảng thép (CSV)', icon: 'table', run: s.exportCsv },
      );
    }
    if (viewMode === 'calc' && !exportBusy) {
      out.push({ id: 'docx', group: exp, label: 'Xuất Word (.docx)', icon: 'file', run: () => void s.exportDocx() });
    }
    if (viewMode !== '3d' && !exportBusy) {
      out.push(
        { id: 'pdf', group: exp, label: 'Xuất PDF', icon: 'file', run: () => void s.exportPdf() },
        { id: 'print', group: exp, label: 'In / PDF qua hộp thoại in', icon: 'printer', run: () => void s.printCurrent() },
      );
    }

    const tpl = 'Mẫu tường';
    out.push(
      {
        id: 'tplB',
        group: tpl,
        label: 'Mẫu 1 · Chữ T ngược',
        hint: 'H = 4÷13 m',
        icon: 'wall',
        run: () => s.setTemplatePreset((m) => presetCanti(s.lastH1 * 100, m), true),
      },
      { id: 'tplA', group: tpl, label: 'Mẫu 2 · Có sườn', hint: 'h = 8,2 m', icon: 'wall', run: () => s.setTemplatePreset((m) => presetRib(m), true) },
      {
        id: 'tplC',
        group: tpl,
        label: 'Mẫu 3 · Khối kè có sườn',
        icon: 'wall',
        run: () => s.setTemplatePreset((m) => appPresetKe(m, project.tpl === 'C' ? keFirst(project.keIdx) : KE_HS[0][1]), true),
      },
      {
        id: 'tplD',
        group: tpl,
        label: 'Mẫu 4 · Chữ T ngược neo đá',
        icon: 'wall',
        run: () => s.setTemplatePreset((m) => presetWall4(m, project.tpl === 'D' ? dIdxOf(project) : 1), true),
      },
    );
    const qh = 'Chiều cao nhanh';
    if (project.tpl === 'B') {
      [4, 5, 6, 7, 8, 9, 10, 11, 12, 13].forEach((h) =>
        out.push({
          id: 'hB' + h,
          group: qh,
          label: `Mẫu 1 · H = ${h} m`,
          icon: 'ruler',
          run: () => s.setTemplatePreset((m) => presetCanti(h * 100, m)),
        }),
      );
    } else if (project.tpl === 'C') {
      KE_HS.forEach(([H, i]) =>
        out.push({
          id: 'hC' + i,
          group: qh,
          label: `Mẫu 3 · H = ${fmt(H / 100, 2)} m`,
          icon: 'ruler',
          run: () => s.setTemplatePreset((m) => appPresetKe(m, i)),
        }),
      );
    } else if (project.tpl === 'D') {
      D_TAB.forEach((r, i) =>
        out.push({
          id: 'hD' + i,
          group: qh,
          label: `Mẫu 4 · H = ${fmt(r.H / 100, 2)} m (${r.id})`,
          icon: 'ruler',
          run: () => s.setTemplatePreset((m) => presetWall4(m, i)),
        }),
      );
    }

    const ui = 'Giao diện';
    out.push(
      {
        id: 'theme',
        group: ui,
        label: theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối',
        icon: theme === 'dark' ? 'sun' : 'moon',
        run: toggleTheme,
      },
      {
        id: 'side',
        group: ui,
        label: sideOpen ? 'Thu gọn bảng thông số' : 'Mở bảng thông số',
        icon: 'sidebar',
        keys: `${MOD} B`,
        run: () => setSideOpen(!sideOpen),
      },
    );
    if (viewMode === '2d') {
      out.push({ id: 'fit', group: ui, label: 'Vừa khung bản vẽ', icon: 'fit', keys: 'F', run: s.requestFit2d });
    }

    const fg = viewMode === 'calc' ? 'Thông số tính toán' : 'Thông số bản vẽ';
    fields.forEach((f, i) =>
      out.push({
        id: 'fld' + i,
        group: fg,
        label: f.label,
        hint: f.section,
        icon: 'sliders',
        run: () => {
          setSideOpen(true);
          revealField(f.el);
        },
      }),
    );
    return out;
    // store thay đổi liên tục; danh sách chỉ cần dựng lại theo các giá trị dưới đây
  }, [cmdOpen, viewMode, project, canUndo, canRedo, draft, theme, sideOpen, exportBusy, fields]);

  const shown = useMemo(() => {
    const q = query.trim();
    if (!q) return commands.filter((c) => !c.id.startsWith('fld') && !c.id.startsWith('h'));
    // Khớp ngay trong tên được xếp trước; sau đó mới tới khớp nhờ tên mục / tên nhóm.
    const inLabel: Cmd[] = [];
    const inRest: Cmd[] = [];
    commands.forEach((c) => {
      if (matchQuery(c.label, q)) inLabel.push(c);
      else if (matchQuery(`${c.label} ${c.hint ?? ''} ${c.id.startsWith('fld') ? '' : c.group}`, q)) inRest.push(c);
    });
    return inLabel.concat(inRest).slice(0, 60);
  }, [commands, query]);

  useEffect(() => {
    setSel(0);
  }, [query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('.cmdk-item.on')?.scrollIntoView?.({ block: 'nearest' });
  }, [sel, shown]);

  if (!cmdOpen) return null;

  const close = () => setCmdOpen(false);
  const exec = (c?: Cmd) => {
    if (!c) return;
    close();
    c.run();
  };

  let lastGroup = '';
  return (
    <div className="cmdk" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="cmdk-box" role="dialog" aria-modal="true" aria-label="Bảng lệnh">
        <div className="cmdk-in">
          <Icon name="search" size={17} />
          <input
            ref={inputRef}
            id="cmdQ"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="Gõ để tìm lệnh, bản vẽ, thông số… (không cần dấu)"
            aria-label="Tìm lệnh"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSel((i) => (shown.length ? (i + 1) % shown.length : 0));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSel((i) => (shown.length ? (i - 1 + shown.length) % shown.length : 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                exec(shown[sel]);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                close();
              }
            }}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="cmdk-list" ref={listRef} role="listbox">
          {shown.length === 0 ? (
            <div className="cmdk-empty">Không tìm thấy lệnh hay thông số nào khớp “{query}”.</div>
          ) : (
            shown.map((c, i) => {
              const head = c.group !== lastGroup ? c.group : null;
              lastGroup = c.group;
              return (
                <React.Fragment key={c.id}>
                  {head ? <div className="cmdk-grp">{head}</div> : null}
                  <div
                    role="option"
                    aria-selected={i === sel}
                    className={'cmdk-item' + (i === sel ? ' on' : '')}
                    onMouseMove={() => i !== sel && setSel(i)}
                    onClick={() => exec(c)}
                  >
                    <Icon name={c.icon} size={15} />
                    <span className="cmdk-l">{c.label}</span>
                    {c.hint ? <span className="cmdk-h">{c.hint}</span> : null}
                    {c.keys ? <kbd>{c.keys}</kbd> : null}
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>
        <div className="cmdk-foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> chọn
          </span>
          <span>
            <kbd>Enter</kbd> thực hiện
          </span>
          <span>
            <kbd>1</kbd>–<kbd>7</kbd> đổi tab nhanh
          </span>
          <span className="cmdk-tip">Gõ tên thông số (vd. “be day ban day”) để nhảy tới ô nhập</span>
        </div>
      </div>
    </div>
  );
};
