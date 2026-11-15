import { useEffect } from 'react';
import { actions, redo, undo, useStore, type Tab } from './state/store';
import { useComputed } from './state/compute';
import { Header } from './components/Header';
import { GaTable, PipeDatalist, RowDetail } from './components/GaTable';
import { DrawView } from './components/DrawView';
import { QtyView, SteelView } from './components/QtyViews';
import { CatalogView, ConfigView } from './components/ConfigViews';
import { fmt } from './engine/summary';
import { GA_KINDS } from './engine/types';

const TABS: { id: Tab; label: string }[] = [
  { id: 'draw', label: 'Bản vẽ' },
  { id: 'qty', label: 'Khối lượng' },
  { id: 'steel', label: 'Chiết tính thép' },
  { id: 'config', label: 'Cấu hình' },
  { id: 'catalog', label: 'Danh mục cống' },
];

function Metrics() {
  const project = useStore((s) => s.project);
  const sel = useStore((s) => s.sel);
  const { results } = useComputed(project);
  const r = results[Math.min(sel, results.length - 1)];
  const q = r.qty;
  const conc = q.bottomConc + q.wallConc + q.roofConc + q.neckConc + (q.lid?.conc ?? 0) + (q.inlet?.conc ?? 0);
  const form = q.bottomForm + q.wallForm + q.roofForm + q.neckForm + (q.lid?.form ?? 0) + (q.inlet?.form ?? 0);
  return (
    <div className="metrics" id="sum" aria-label="Chỉ tiêu ga đang chọn">
      <div className="card">
        <span>Bê tông</span>
        <b>{fmt(conc)} m³</b>
      </div>
      <div className="card">
        <span>Ván khuôn</span>
        <b>{fmt(form)} m²</b>
      </div>
      <div className="card">
        <span>Bê tông lót</span>
        <b>{fmt(q.liner1)} m³</b>
      </div>
      <div className="card">
        <span>Cốt thép</span>
        <b>{fmt(r.rebar.totalKg, 0)} kg</b>
      </div>
      <div className="card">
        <span>Hàm lượng</span>
        <b>{conc > 0 ? fmt(r.rebar.totalKg / conc, 1) : '–'} kg/m³</b>
      </div>
      <div className="card">
        <span>Cao trình đỉnh</span>
        <b>{q.levelTop === null ? '–' : fmt(q.levelTop)}</b>
      </div>
    </div>
  );
}

function ToastBanner() {
  const t = useStore((s) => s.toast);
  return (
    <div id="toast" className={'toast' + (t ? ` show ${t.kind}` : '')} role="status" aria-live="polite">
      {t?.msg}
    </div>
  );
}

export function App() {
  const project = useStore((s) => s.project);
  const tab = useStore((s) => s.tab);
  const theme = useStore((s) => s.theme);
  const dirty = useStore((s) => s.dirty);
  const draft = useStore((s) => s.draftOffered);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ctrl+S lưu dự án, Ctrl+O mở / nhập (cùng phím tắt với phân hệ Tường chắn)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key.toLowerCase() === 's' || e.key.toLowerCase() === 'o')) {
        e.preventDefault();
        document.getElementById(e.key.toLowerCase() === 's' ? 'bSave' : 'bOpen')?.click();
        return;
      }
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
      if (typing) return;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  return (
    <div className="app" data-kind={project.kind} data-theme={theme}>
      <Header />
      {draft && (
        <div className="banner" role="alert">
          Có bản nháp chưa lưu từ lần làm việc trước.
          <button id="bRestore" className="btn sm" onClick={actions.restoreDraft}>
            Khôi phục
          </button>
          <button id="bDraftX" className="btn sm" onClick={actions.dismissDraft}>
            Bỏ qua
          </button>
        </div>
      )}
      <main className="main">
        <aside className="left">
          <Metrics />
          <GaTable />
          <RowDetail />
          <p className="kindnote">{GA_KINDS[project.kind].label}. Chỉnh trực tiếp trên bảng; mọi kết quả cập nhật ngay.</p>
        </aside>
        <section className="right">
          <nav className="maintabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} id={'tab_' + t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => actions.setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </nav>
          <div className="viewport">
            {tab === 'draw' && <DrawView />}
            {tab === 'qty' && <QtyView />}
            {tab === 'steel' && <SteelView />}
            {tab === 'config' && <ConfigView />}
            {tab === 'catalog' && <CatalogView />}
          </div>
        </section>
      </main>
      <PipeDatalist />
      <ToastBanner />
    </div>
  );
}
