import { useMemo, useState } from 'react';
import { actions, useStore, type SheetTab } from '../state/store';
import { compute } from '../state/compute';
import { GA_KINDS } from '../engine/types';
import { buildLidSheet, buildSummarySheets, SCALES, type Sheet } from '../cad/sheets';
import { buildVhgSet } from '../cad/vhgSheets';
import { sheetToSvg } from '../cad/svg';
import { Icon } from './Icon';

/** Các tờ của một ga theo bố cục bản vẽ mẫu VHGpro (xem cad/vhgSheets.ts), cộng chi tiết tấm nắp và bảng tổng hợp. */
const TABS: { id: SheetTab; label: string; hint: string }[] = [
  { id: 'vhg1', label: 'Tờ 1', hint: 'Mặt bằng, mặt cắt, lưới thép tường' },
  { id: 'vhg2', label: 'Tờ 2', hint: 'Thép bản đáy, tường T1 – T2' },
  { id: 'vhg3', label: 'Tờ 3', hint: 'Thép tường T3 – T4, trần' },
  { id: 'vhg4', label: 'Tờ 4', hint: 'Thép cổ ga, bảng thống kê thép' },
  { id: 'vhg5', label: 'Tờ 5', hint: 'Hình dạng các thanh thép' },
  { id: 'lid', label: 'Tấm nắp', hint: 'Chi tiết tấm nắp đúc sẵn' },
  { id: 'summary', label: 'Tổng hợp khối lượng', hint: 'Bảng tổng hợp toàn dự án' },
];

export function DrawView() {
  const project = useStore((s) => s.project);
  const sel = useStore((s) => s.sel);
  const sheetTab = useStore((s) => s.sheet);
  const scale = useStore((s) => s.scale);
  const theme = useStore((s) => s.theme);
  const [zoom, setZoom] = useState(1);
  const [page, setPage] = useState(0);

  const sheets: Sheet[] = useMemo(() => {
    const c = compute(project);
    const res = c.results[Math.min(sel, c.results.length - 1)];
    const info = GA_KINDS[project.kind];
    if (sheetTab === 'lid') {
      const l = buildLidSheet(res, project.config, project.catalog, info);
      return l ? [l] : [];
    }
    if (sheetTab === 'summary') return buildSummarySheets(project, c.items);
    const set = buildVhgSet(res, project.config, project.catalog, info, { scale });
    const kind = sheetTab;
    return set.filter((x) => x.kind === kind);
  }, [project, sel, sheetTab, scale]);

  const cur = sheets[Math.min(page, sheets.length - 1)];
  const svg = useMemo(() => (cur ? sheetToSvg(cur, theme, { responsive: true }) : ''), [cur, theme]);
  const isView = sheetTab.startsWith('vhg');

  return (
    <div className="drawview">
      <div className="toolbar">
        <div className="tabs" role="tablist" id="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={sheetTab === t.id}
              title={t.hint}
              className={sheetTab === t.id ? 'on' : ''}
              onClick={() => {
                actions.setSheet(t.id);
                setPage(0);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="tools">
          {isView && (
            <label className="field inline">
              <span>Tỷ lệ</span>
              <select id="selScale" value={String(scale)} onChange={(e) => actions.setScale(e.target.value === 'auto' ? 'auto' : Number(e.target.value))}>
                <option value="auto">Tự động</option>
                {SCALES.map((s) => (
                  <option key={s} value={s}>{`1/${s}`}</option>
                ))}
              </select>
            </label>
          )}
          {sheets.length > 1 && (
            <span className="pager">
              {sheets.map((_, i) => (
                <button key={i} className={'ibtn sm' + (i === page ? ' on' : '')} onClick={() => setPage(i)}>
                  {i + 1}
                </button>
              ))}
            </span>
          )}
          <button className="ibtn" title="Thu nhỏ" onClick={() => setZoom((z) => Math.max(0.5, z / 1.25))}>
            <Icon name="zoomOut" />
          </button>
          <button id="bFit" className="ibtn" title="Vừa khung nhìn" onClick={() => setZoom(1)}>
            <Icon name="fit" />
          </button>
          <button className="ibtn" title="Phóng to" onClick={() => setZoom((z) => Math.min(5, z * 1.25))}>
            <Icon name="zoomIn" />
          </button>
        </div>
      </div>
      {cur ? (
        <>
          <div className="stage" id="stage">
            <div className="sheetwrap" style={{ width: `${zoom * 100}%`, aspectRatio: `${cur.w} / ${cur.h}` }} dangerouslySetInnerHTML={{ __html: svg }} />
          </div>
          <div id="sinfo" className="sinfo">
            {cur.title} · khổ A3 · {isView || sheetTab === 'lid' ? `tỷ lệ 1/${cur.scale} · ` : ''}
            {cur.ents.length} thực thể
            {sheetTab === 'summary' ? ` · ${project.rows.length} ga` : ''}
          </div>
        </>
      ) : (
        <div className="note" id="stage">
          Ga này dùng nắp gang nên không có tờ tấm nắp BTCT. Chọn "Loại nắp = BTCT" trong tab Cấu hình để có chi tiết tấm nắp đúc sẵn.
        </div>
      )}
    </div>
  );
}
