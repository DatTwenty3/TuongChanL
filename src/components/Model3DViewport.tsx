import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  V3,
  V3_VIEWS,
  v3Diff,
  v3Drawn,
  v3FormatTip,
  v3GroupColor,
} from '../model3d';
import type {
  QuantitiesResult,
  V3ClipState,
  V3ColorMode,
  V3HoverHit,
  V3ViewPresetId,
  V3Visibility,
} from '../types/project';
import { fmt, type EngineBarsResult, type EngineProject } from '../engine';
import { useAppStore } from '../state/appStore';
import { Icon } from './Icon';

interface TipState {
  title: string;
  subtitle: string;
  summary: string;
  is2dOnly: boolean;
  mx: number;
  my: number;
}

export const Model3DViewport: React.FC = () => {
  const {
    project,
    barsRes,
    quantitiesRes,
    viewMode,
    v3Ref,
    v3Rev,
    bumpV3Rev,
    export3dPng,
  } = useAppStore();

  void v3Rev;

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const glCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const axCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const legRef = useRef<HTMLDivElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);

  const isMobile = () =>
    typeof window !== 'undefined' && !!window.matchMedia?.('(max-width: 900px)').matches;
  const [legMin, setLegMin] = useState(isMobile);
  const [barMin, setBarMin] = useState(false);
  const [tip, setTip] = useState<TipState | null>(null);
  const [tipPos, setTipPos] = useState<{ left: number; top: number }>({ left: 8, top: 8 });

  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;
  const lastUploadedRef = useRef<{
    project: EngineProject;
    barsRes: EngineBarsResult;
    quantitiesRes: QuantitiesResult;
  } | null>(null);
  const legMountedRef = useRef(false);

  useEffect(() => {
    const cv = glCanvasRef.current;
    if (!cv) return;

    const v3 = new V3({
      axisCanvas: axCanvasRef.current,
      getLegOffsetPx: () => {
        const leg = legRef.current;
        if (!leg || leg.hidden || leg.classList.contains('min')) return 0;
        // điện thoại: bảng chú giải nằm phía dưới, không chiếm bề ngang
        if (window.matchMedia?.('(max-width: 900px)').matches) return 0;
        return leg.offsetWidth ? leg.offsetWidth + 14 : 0;
      },
      isHidden: () => viewModeRef.current !== '3d',
      onChange: () => {
        bumpV3Rev();
      },
      onHover: (hit: V3HoverHit | null, mouse: { x: number; y: number } | null) => {
        if (!hit || !mouse) {
          setTip(null);
          return;
        }
        const formatted = v3FormatTip(hit.gr);
        setTip({ ...formatted, mx: mouse.x, my: mouse.y });
      },
    });

    v3Ref.current = v3;
    v3.attach(cv, { axisCanvas: axCanvasRef.current });

    return () => {
      if (v3Ref.current === v3) v3Ref.current = null;
      lastUploadedRef.current = null;
      v3.dispose();
    };
  }, [bumpV3Rev, v3Ref]);

  useEffect(() => {
    const v3 = v3Ref.current;
    if (!v3) return;
    const prev = lastUploadedRef.current;
    const modelChanged =
      !prev ||
      prev.project !== project ||
      prev.barsRes !== barsRes ||
      prev.quantitiesRes !== quantitiesRes;
    if (viewMode !== '3d') {
      if (modelChanged) v3.stale = true;
      return;
    }
    if (v3.stale || (!v3.model && v3.ok) || modelChanged) {
      lastUploadedRef.current = { project, barsRes, quantitiesRes };
      v3.setModel(project, barsRes, quantitiesRes);
    } else {
      v3.redraw();
    }
  }, [viewMode, project, barsRes, quantitiesRes, v3Ref]);

  useEffect(() => {
    if (!legMountedRef.current) {
      legMountedRef.current = true;
      return;
    }
    const v3 = v3Ref.current;
    if (v3 && v3.model && viewModeRef.current === '3d') {
      v3.fit(true);
      v3.redraw();
    }
  }, [legMin, v3Ref]);

  useLayoutEffect(() => {
    if (!tip || !wrapRef.current) return;
    const wrap = wrapRef.current;
    const r = wrap.getBoundingClientRect();
    const W = wrap.clientWidth || r.width;
    const H = wrap.clientHeight || r.height;
    const tw = tipRef.current?.offsetWidth || 200;
    const th = tipRef.current?.offsetHeight || 60;
    setTipPos({
      left: Math.max(6, Math.min(W - tw - 8, tip.mx + 16)),
      top: Math.max(6, Math.min(H - th - 6, tip.my - th - 12)),
    });
  }, [tip]);

  const v3 = v3Ref.current;
  const vis: V3Visibility = v3?.vis ?? {
    conc: true,
    edges: true,
    blind: true,
    soil: true,
    strata: true,
    grid: true,
    rebar: true,
  };
  const ortho = v3?.cam.ortho ?? false;
  const surf = v3?.surf ?? 0.5;
  const kd = v3?.kd ?? 1;
  const colorMode: V3ColorMode = v3?.colorMode ?? 'mark';
  const clip = v3?.clip ?? { axis: '', t: 1, flip: false };
  const model = v3?.model ?? null;
  const focus = v3?.focus ?? null;
  const focusGroup = focus && model ? model.groups.find((g) => g.id === focus) ?? null : null;

  const visItems: Array<[string, keyof V3Visibility]> = [
    ['Bê tông', 'conc'],
    ['Nét viền', 'edges'],
    ['Bê tông lót', 'blind'],
    ['Đất đắp', 'soil'],
    ['Đất nền', 'strata'],
    ['Cốt thép', 'rebar'],
    ['Lưới nền', 'grid'],
  ];

  const totBars = model
    ? model.groups.reduce((s, g) => s + (g.bs && g.bs.length ? g.count : 0), 0)
    : 0;
  const totKg = model ? model.groups.reduce((s, g) => s + (g.kg ?? 0), 0) : 0;
  const diffCount = model ? model.groups.filter((g) => v3Diff(g)).length : 0;

  return (
    <div id="v3d" hidden={viewMode !== '3d'}>
      <div id="v3bar">
        <div className="v3g">
          <span className="v3t">Góc nhìn</span>
          {(Object.keys(V3_VIEWS) as V3ViewPresetId[]).map((id) => (
            <button
              key={id}
              type="button"
              className="v3b"
              onClick={() => v3?.setView(id)}
            >
              {V3_VIEWS[id][0]}
            </button>
          ))}
          <button
            type="button"
            className="v3b"
            onClick={() => {
              if (v3) v3.go(v3.cam.yaw, v3.cam.pitch, true);
            }}
          >
            Vừa khung
          </button>
          <button
            type="button"
            id="v3barToggle"
            className={'v3b sm v3tog' + (barMin ? ' min' : '')}
            aria-expanded={!barMin}
            title={barMin ? 'Hiện các tùy chọn hiển thị' : 'Thu gọn thanh công cụ'}
            onClick={() => setBarMin((m) => !m)}
          >
            <Icon name="chevron" size={13} />
            Tùy chọn
          </button>
        </div>

        <div className="v3more" hidden={barMin}>

        <div className="v3g">
          <span className="v3t">Hiển thị</span>
          {visItems.map(([label, key]) => (
            <label key={key} className="v3c">
              <input
                type="checkbox"
                checked={vis[key]}
                onChange={(e) => v3?.setVis(key, e.target.checked)}
              />{' '}
              {label}
            </label>
          ))}
          <label className="v3c">
            <input
              type="checkbox"
              id="v3ortho"
              checked={ortho}
              onChange={(e) => {
                if (!v3) return;
                v3.setOrtho(e.target.checked);
                v3.go(v3.cam.yaw, v3.cam.pitch, true);
              }}
            />{' '}
            Trực giao
          </label>
        </div>

        <div className="v3g">
          <span className="v3t">Độ hiển thị</span>
          <label className="v3s">
            <span>Độ mờ bề mặt</span>
            <input
              type="range"
              id="v3surf"
              min={0}
              max={1}
              step={0.01}
              value={surf}
              onChange={(e) => v3?.setSurf(parseFloat(e.target.value))}
            />
            <b>{Math.round(surf * 100)}%</b>
          </label>
          <label className="v3s">
            <span>Phóng to đường kính thép</span>
            <input
              type="range"
              min={1}
              max={8}
              step={0.5}
              value={kd}
              onChange={(e) => v3?.setKd(parseFloat(e.target.value))}
            />
            <b>×{fmt(kd)}</b>
          </label>
          <select
            value={colorMode}
            onChange={(e) => v3?.setColorMode(e.target.value as V3ColorMode)}
          >
            <option value="mark">Màu thép: theo mác</option>
            <option value="cad">Màu thép: đỏ như CAD</option>
          </select>
        </div>

        <div className="v3g">
          <span className="v3t">Mặt cắt lát</span>
          <select
            id="v3clipAxis"
            value={clip.axis}
            onChange={(e) => v3?.setClip({ axis: e.target.value as V3ClipState['axis'] })}
          >
            <option value="">Không cắt</option>
            <option value="z">Cắt ngang tường (theo chiều dài L)</option>
            <option value="x">Cắt dọc (từ mũi → gót)</option>
            <option value="y">Cắt nằm ngang (theo độ cao)</option>
          </select>
          <span className={'v3r' + (clip.axis ? '' : ' off')} id="v3clipRow">
            <input
              type="range"
              id="v3clipT"
              min={0}
              max={1}
              step={0.005}
              value={clip.t}
              onChange={(e) => v3?.setClip({ t: parseFloat(e.target.value) })}
            />
            <label className="v3c">
              <input
                type="checkbox"
                checked={clip.flip}
                onChange={(e) => v3?.setClip({ flip: e.target.checked })}
              />{' '}
              đảo phía
            </label>
          </span>
        </div>

        <button type="button" className="v3b pri" onClick={() => void export3dPng()}>
          Ảnh PNG
        </button>
        </div>
      </div>

      <div id="v3wrap" ref={wrapRef}>
        <canvas ref={glCanvasRef} id="gl" />

        <div ref={legRef} id="v3leg" className={'pn' + (legMin ? ' min' : '')}>
          <div className="v3h">
            <b>Cốt thép</b>
            <span>
              <button
                type="button"
                className="v3b sm"
                onClick={() => v3?.setAllVisible(true)}
              >
                Tất cả
              </button>{' '}
              <button
                type="button"
                className="v3b sm"
                onClick={() => v3?.setAllVisible(false)}
              >
                Không
              </button>{' '}
              <button
                type="button"
                className="v3b sm"
                onClick={() => setLegMin((m) => !m)}
              >
                <Icon name="chevron" size={13} />
              </button>
            </span>
          </div>

          <div id="v3list">
            {model?.groups.map((gr, gi) => {
              const id = gr.id || String(gi);
              const col = v3GroupColor(gr, colorMode, gi).map((v) => Math.round(v * 255));
              const diff = v3Diff(gr);
              return (
                <div
                  key={id}
                  className={'lg' + (focus === id ? ' sel' : '')}
                  data-id={id}
                  title={gr.name}
                  onClick={() => v3?.toggleFocus(id)}
                >
                  <input
                    type="checkbox"
                    checked={!v3?.hidden.has(id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => v3?.setGroupVisible(id, e.target.checked)}
                  />
                  <i className="sw" style={{ background: `rgb(${col[0]},${col[1]},${col[2]})` }} />
                  <b className="mk">{gr.mark}</b>
                  <span className="nm">{gr.name}</span>
                  <em
                    title={
                      diff
                        ? `Bảng thống kê: ${gr.count} thanh · mô hình 3D vẽ ${v3Drawn(gr)} thanh (theo đúng hình bản vẽ 2D)`
                        : undefined
                    }
                  >
                    {`Ø${gr.d} · ${gr.count}${diff ? '*' : ''}`}
                  </em>
                </div>
              );
            })}
          </div>

          <div id="v3sum">
            {model
              ? `${model.groups.length} nhóm · ${totBars} thanh · ${fmt(totKg, 0)} kg thép${
                  diffCount ? ` · * ${diffCount} nhóm vẽ lệch số thanh so với bảng (di chuột để xem)` : ''
                }`
              : ''}
          </div>

          {model?.ground && model.ground.length > 0 && vis.strata ? (
            <div id="v3soil">
              <b>Địa tầng</b>
              {model.ground.map((gp) => (
                <div key={gp.id} className="sl" title={gp.name}>
                  <i
                    className="sw"
                    style={{
                      background: `rgb(${gp.color.map((v) => Math.round(v * 255)).join(',')})`,
                    }}
                  />
                  <span className="nm">{gp.name}</span>
                  <em>
                    {gp.kind === 'cover'
                      ? `+${fmt(gp.y1 / 100, 1)} m`
                      : `${fmt(-gp.y1 / 100, 1)} → ${fmt(-gp.y0 / 100, 1)} m`}
                  </em>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div
          ref={tipRef}
          id="v3tip"
          className="pn"
          hidden={!tip}
          style={tip ? { left: `${tipPos.left}px`, top: `${tipPos.top}px` } : undefined}
        >
          {tip ? (
            <>
              <b>{tip.title}</b>
              <span>{tip.subtitle}</span>
              <em>{tip.summary}</em>
              {tip.is2dOnly ? (
                <i>Thanh cấu tạo trên mặt cắt, không tách dòng riêng trong bảng thống kê.</i>
              ) : null}
            </>
          ) : null}
        </div>

        <canvas ref={axCanvasRef} id="v3ax" width={84} height={84} />

        <div id="v3foc">
          {focusGroup ? (
            <>
              {'Cô lập mác '}
              <b>{focusGroup.mark}</b>
              {` (${focusGroup.name}) `}
              <button type="button" className="v3b sm" onClick={() => v3?.setFocus(null)}>
                Hiện tất cả (Esc)
              </button>
            </>
          ) : null}
        </div>

        <div id="v3st">
          <span id="v3info">{v3?.infoText ?? ''}</span>
          <span className="v3hint v3hint-touch">
            1 ngón: xoay · 2 ngón: thu phóng / di chuyển · chạm thanh thép: tô sáng
          </span>
          <span className="v3hint v3hint-mouse">
            Kéo: xoay · Shift hoặc chuột phải + kéo: di chuyển · Lăn: phóng to/thu nhỏ · Nhấp vào
            thanh thép: tô sáng cả nhóm · Nhấp đúp: vừa khung
          </span>
        </div>

        <div id="v3msg" hidden={!v3?.errMsg}>
          {v3?.errMsg ?? ''}
        </div>
      </div>
    </div>
  );
};
