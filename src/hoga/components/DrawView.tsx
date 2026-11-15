import { useMemo, useState } from 'react';
import { actions, useStore, type SheetTab } from '../state/store';
import { compute } from '../state/compute';
import { GA_KINDS } from '../engine/types';
import { buildLidSheet, buildScheduleSheets, buildSummarySheets, buildViewSheet, buildWallSheet, SCALES, type Sheet } from '../cad/sheets';
import { sheetToSvg } from '../cad/svg';
import { Icon } from './Icon';

const TABS: { id: SheetTab; label: string }[] = [
  { id: 'struct', label: 'Kết cấu' },
  { id: 'rebar', label: 'Cốt thép' },
  { id: 'wall', label: 'Lưới thép tường' },
  { id: 'lid', label: 'Tấm nắp' },
  { id: 'schedule', label: 'Thống kê thép' },
  { id: 'summary', label: 'Tổng hợp khối lượng' },
];

export function DrawView() {
  const project = useStore((s) => s.project);
  const sel = useStore((s) => s.sel);
  const sheetTab = useStore((s) => s.sheet);
  const scale = useStore((s) => s.scale);
  const cols = useStore((s) => s.cols);
  const theme = useStore((s) => s.theme);
  const [zoom, setZoom] = useState(1);
  const [page, setPage] = useState(0);

  const sheets: Sheet[] = useMemo(() => {
    const c = compute(project);
    const res = c.results[Math.min(sel, c.results.length - 1)];
    const info = GA_KINDS[project.kind];
    const sc = scale === 'auto' ? undefined : scale;
    const colOpt = cols === 'auto' ? undefined : cols;
    if (sheetTab === 'struct' || sheetTab === 'rebar') return [buildViewSheet(res, project.config, project.catalog, info, sheetTab, { scale: sc, cols: colOpt })];
    if (sheetTab === 'wall') return [buildWallSheet(res, project.config, project.catalog, info, { scale: sc })];
    if (sheetTab === 'lid') {
      const l = buildLidSheet(res, project.config, project.catalog, info);
      return l ? [l] : [];
    }
    if (sheetTab === 'schedule') return buildScheduleSheets(res, project.config);
    return buildSummarySheets(project, c.items);
  }, [project, sel, sheetTab, scale, cols]);

  const cur = sheets[Math.min(page, sheets.length - 1)];
  const svg = useMemo(() => (cur ? sheetToSvg(cur, theme, { responsive: true }) : ''), [cur, theme]);
  const isView = sheetTab === 'struct' || sheetTab === 'rebar' || sheetTab === 'wall';

  return (
    <div className="drawview">
      <div className="toolbar">
        <div className="tabs" role="tablist" id="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={sheetTab === t.id}
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
          {(sheetTab === 'struct' || sheetTab === 'rebar') && (
            <label className="field inline">
              <span>Bố cục</span>
              <select id="selCols" value={String(cols)} onChange={(e) => actions.setCols(e.target.value === 'auto' ? 'auto' : (Number(e.target.value) as 2 | 3))}>
                <option value="auto">Tự động</option>
                <option value="2">Nhóm 2 cột</option>
                <option value="3">Nhóm 3 cột</option>
              </select>
            </label>
          )}
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
