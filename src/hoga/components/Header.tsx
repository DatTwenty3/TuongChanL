import { useRef, useState } from 'react';
import { actions, getState, redo, undo, useStore } from '../state/store';
import { compute, useComputed } from '../state/compute';
import { GA_KINDS, GA_KIND_ORDER, type GaKind } from '../engine/types';
import { baseName, parseProject, PROJECT_EXT, serializeProject } from '../export/projectIo';
import { barTable, buildXlsx, qtyTable, steelTable, toCsv } from '../export/exportXlsx';
import { buildLidSheet, buildSummarySheets, type Sheet } from '../cad/sheets';
import { buildVhgSet } from '../cad/vhgSheets';
import { layoutSheets, toDXF } from '../cad/dxf';
import { sheetToSvg } from '../cad/svg';
import { download } from './download';
import { Icon } from './Icon';
import { BrandMark } from '../../components/Icon';
import { ModuleSwitch } from '../../shared/ModuleSwitch';

/** Dựng toàn bộ các tờ bản vẽ của một ga: bộ 5 tờ theo bản mẫu VHGpro (tờ 4 có thể nhiều trang) và tờ tấm nắp BTCT nếu có. */
export function sheetsOfGa(idx: number, scale: 'auto' | number): Sheet[] {
  const { project } = getState();
  const c = compute(project);
  const info = GA_KINDS[project.kind];
  const res = c.results[idx];
  const lid = buildLidSheet(res, project.config, project.catalog, info);
  return [...buildVhgSet(res, project.config, project.catalog, info, { scale }), ...(lid ? [lid] : [])];
}

export function Header() {
  const project = useStore((s) => s.project);
  const dirty = useStore((s) => s.dirty);
  const theme = useStore((s) => s.theme);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const sel = useStore((s) => s.sel);
  const scale = useStore((s) => s.scale);
  const fileRef = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState(false);
  const computed = useComputed(project);
  const name = baseName(project.title);

  const run = async (label: string, fn: () => Promise<void> | void) => {
    actions.toast(`${label}…`, 'wait', 0);
    try {
      await fn();
      actions.toast(`${label}: xong`, 'ok');
    } catch (e) {
      actions.toast(`${label} thất bại: ${(e as Error).message}`, 'err', 7000);
    }
  };

  const onFile = async (f: File) => {
    await run(`Nhập ${f.name}`, async () => {
      if (/\.xlsx$/i.test(f.name)) {
        const { importXlsxFile } = await import('../export/importXlsx');
        const r = await importXlsxFile(await f.arrayBuffer(), f.name.replace(/\.xlsx$/i, ''));
        actions.load(r.project);
        if (r.warnings.length) actions.toast(r.warnings.join(' '), 'ok', 7000);
      } else {
        actions.load(parseProject(await f.text()));
      }
    });
  };

  const exportDxf = (all: boolean, version: 'R2000' | 'R12' = 'R2000') =>
    run('Xuất DXF', () => {
      const idxs = all ? project.rows.map((_, i) => i) : [sel];
      const groups = idxs.map((i) => sheetsOfGa(i, scale));
      if (all) groups.push(buildSummarySheets(project, computed.items));
      download(`${name}${all ? '' : '_' + baseName(project.rows[sel].name)}${version === 'R12' ? '_r12' : ''}.dxf`, toDXF(layoutSheets(groups), version), 'application/dxf');
    });

  return (
    <header className="hdr">
      <div className="brand">
        <span className="logo" aria-hidden>
          <BrandMark />
        </span>
        <div>
          <b>LEDAT-<span className="wm-g">BIM</span></b>
          <small>Hố ga BTCT</small>
        </div>
      </div>
      <ModuleSwitch current="hoga" />
      <label className="field inline">
        <span>Loại ga</span>
        <select
          id="selKind"
          value={project.kind}
          onChange={(e) => {
            if (dirty && !confirm('Đổi loại ga sẽ nạp lại dữ liệu mẫu và bỏ các thay đổi chưa lưu. Tiếp tục?')) return;
            actions.newProject(e.target.value as GaKind);
          }}
        >
          {GA_KIND_ORDER.map((k) => (
            <option key={k} value={k}>
              {GA_KINDS[k].label}
            </option>
          ))}
        </select>
      </label>
      <label className="field inline grow">
        <span>Dự án</span>
        <input id="inTitle" value={project.title} onChange={(e) => actions.updateProject((p) => ({ ...p, title: e.target.value }))} />
      </label>
      <div className="btns">
        <button id="bUndo" className="ibtn" title="Hoàn tác (Ctrl+Z)" disabled={!canUndo} onClick={undo}>
          <Icon name="undo" />
        </button>
        <button id="bRedo" className="ibtn" title="Làm lại (Ctrl+Y)" disabled={!canRedo} onClick={redo}>
          <Icon name="redo" />
        </button>
        <button id="bOpen" className="btn" title="Mở / nhập dự án hoặc tệp Excel (Ctrl+O)" onClick={() => fileRef.current?.click()}>
          <Icon name="open" /> Mở / nhập
        </button>
        <input
          id="fOpen"
          ref={fileRef}
          type="file"
          accept=".xlsx,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void onFile(f);
          }}
        />
        <button
          id="bSave"
          title="Lưu dự án .hoga.json (Ctrl+S)"
          className="btn"
          data-dirty={dirty ? '1' : '0'}
          onClick={() =>
            run('Lưu dự án', () => {
              download(`${name}${PROJECT_EXT}`, serializeProject(project), 'application/json');
              actions.markClean();
            })
          }
        >
          <Icon name="save" /> Lưu{dirty ? ' •' : ''}
        </button>
        <div className="menuwrap">
          <button id="bExport" className="btn primary" aria-expanded={menu} onClick={() => setMenu(!menu)}>
            <Icon name="export" /> Xuất ▾
          </button>
          {menu && (
            <div className="menu" role="menu" onClick={() => setMenu(false)}>
              <button id="bDxf" onClick={() => exportDxf(false)}>
                DXF (AutoCAD 2000+, có hatch + dimension) – ga đang chọn
              </button>
              <button id="bDxfAll" onClick={() => exportDxf(true)}>
                DXF (AutoCAD 2000+) – tất cả ga + tổng hợp
              </button>
              <button id="bDxf12" onClick={() => exportDxf(false, 'R12')}>
                DXF R12 (bản cũ, đoạn thẳng) – ga đang chọn
              </button>
              <button
                id="bSvg"
                onClick={() =>
                  run('Xuất SVG', () => {
                    const sheets = sheetsOfGa(sel, scale);
                    sheets.forEach((s, i) => download(`${name}_${baseName(project.rows[sel].name)}_${i + 1}.svg`, sheetToSvg(s, 'light'), 'image/svg+xml'));
                  })
                }
              >
                SVG – các tờ của ga đang chọn
              </button>
              <button id="bXlsx" onClick={() => run('Xuất Excel', async () => download(`${name}.xlsx`, await buildXlsx(project, computed.results), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'))}>
                Excel – THKL, KL HG, Thép, chiết tính
              </button>
              <button id="bCsv" onClick={() => run('Xuất CSV', () => download(`${name}_chiet_tinh_thep.csv`, toCsv(barTable(computed.results)), 'text/csv'))}>
                CSV – chiết tính thép từng thanh
              </button>
              <button
                id="bCsvQ"
                onClick={() =>
                  run('Xuất CSV', () => {
                    download(`${name}_khoi_luong.csv`, toCsv(qtyTable(project, computed.results)), 'text/csv');
                    download(`${name}_thep_theo_ket_cau.csv`, toCsv(steelTable(computed.results)), 'text/csv');
                  })
                }
              >
                CSV – khối lượng & thép theo kết cấu
              </button>
              <button id="bPrint" onClick={() => window.print()}>
                In bản vẽ đang xem
              </button>
            </div>
          )}
        </div>
        <button id="bTheme" className="ibtn" title="Đổi giao diện sáng/tối" onClick={() => actions.setTheme(theme === 'dark' ? 'light' : 'dark')}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
      </div>
    </header>
  );
}
