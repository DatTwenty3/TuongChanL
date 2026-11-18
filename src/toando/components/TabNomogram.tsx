import React from 'react';
import { TOANDO_IMAGES } from '../assets/iconRegistry';
import { TOANDO_META } from '../data/toandoMeta';
import type { ToanDoId, ToanDoInputStrings, ToanDoLookupResult } from '../types/project';

export type { ToanDoInputStrings };

export interface TabNomogramProps {
  id: ToanDoId;
  inputs: ToanDoInputStrings;
  lookupResult: ToanDoLookupResult;
  onChange: (next: ToanDoInputStrings) => void;
}

interface CropBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface FieldSpec {
  xLabel: string;
  xHint: string;
  yLabel: string;
  yHint: string;
  rayLabel?: string;
  rayHint?: string;
  outputLabel: string;
  panelPosition: 'right' | 'bottom';
  crop: CropBox;
}

const PNG_WIDTH = 880;
const PNG_HEIGHT = 600;

const FIELD_SPECS: Record<ToanDoId, FieldSpec> = {
  '3-1': {
    xLabel: 'H/D',
    xHint: '0 – 2,0',
    yLabel: 'Eo/E1',
    yHint: '0 – 0,90',
    outputLabel: 'Echm/E1',
    panelPosition: 'right',
    crop: { x: 14, y: 0, w: 568, h: 515 },
  },
  '3-2': {
    xLabel: 'H/D',
    xHint: '0 – 2,0',
    yLabel: 'E1/E2',
    yHint: '2 – 50',
    rayLabel: 'φ (độ)',
    rayHint: '2 – 46',
    outputLabel: 'Tax/p',
    panelPosition: 'bottom',
    crop: { x: 20, y: 0, w: 726, h: 446 },
  },
  '3-3': {
    xLabel: 'H/D',
    xHint: '0 – 4,0',
    yLabel: 'E1/E2',
    yHint: '5 – 50',
    rayLabel: 'φ (độ)',
    rayHint: '2 – 46',
    outputLabel: 'Tax/p',
    panelPosition: 'bottom',
    crop: { x: 34, y: 0, w: 688, h: 456 },
  },
  '3-4': {
    xLabel: 'H (cm)',
    xHint: '0 – 100',
    yLabel: 'φ (độ)',
    yHint: '5 – 40',
    outputLabel: 'Tav (MPa)',
    panelPosition: 'right',
    crop: { x: 138, y: 0, w: 394, h: 522 },
  },
  '3-5': {
    xLabel: 'H/D',
    xHint: '0 – 1,0',
    yLabel: 'E1/Ech.m',
    yHint: '1,5 – 100',
    outputLabel: 'σ̄ku',
    panelPosition: 'right',
    crop: { x: 108, y: 0, w: 454, h: 522 },
  },
  '3-6': {
    xLabel: 'H/D',
    xHint: '0 – 2,0',
    yLabel: 'E1/E2',
    yHint: '1 – 25',
    rayLabel: 'E2/E3',
    rayHint: '2 – 25',
    outputLabel: 'σ̄ku',
    panelPosition: 'right',
    crop: { x: 124, y: 0, w: 430, h: 524 },
  },
};

function traceColor(c: 'red' | 'yellow' | 'cyan'): string {
  if (c === 'yellow') return '#facc15';
  if (c === 'cyan') return '#22d3ee';
  return '#ff3b30';
}

export function TabNomogram({
  id,
  inputs,
  lookupResult,
  onChange,
}: TabNomogramProps): React.ReactElement {
  const meta = TOANDO_META[id];
  const spec = FIELD_SPECS[id];
  const { crop } = spec;
  const isNa = !lookupResult.valid || lookupResult.displayValue === '#N/A';

  const frameStyle = {
    '--crop-w': String(crop.w),
    '--crop-h': String(crop.h),
    aspectRatio: `${crop.w} / ${crop.h}`,
  } as React.CSSProperties;

  const imgStyle: React.CSSProperties = {
    left: `${(-crop.x / crop.w) * 100}%`,
    top: `${(-crop.y / crop.h) * 100}%`,
    width: `${(PNG_WIDTH / crop.w) * 100}%`,
    height: `${(PNG_HEIGHT / crop.h) * 100}%`,
  };

  return (
    <div className="adm-toando-stage" data-testid={`tab-toando-${id}`}>
      <div className={`adm-toando-workspace ${spec.panelPosition}`}>
        <div className="adm-toando-header">
          <span className="adm-toando-title">{meta.title}</span>
          <span className="adm-toando-badge">TCCS 38:2022/TCĐBVN · {meta.tccs38Figure}</span>
        </div>

        <div className={`adm-toando-body ${spec.panelPosition}`}>
          <div className="adm-toando-chart-frame" style={frameStyle}>
            <img
              className="adm-toando-chart-img"
              src={TOANDO_IMAGES[id]}
              alt={meta.title}
              width={PNG_WIDTH}
              height={PNG_HEIGHT}
              style={imgStyle}
            />

            <svg
              className="adm-toando-svg"
              viewBox={`${crop.x} ${crop.y} ${crop.w} ${crop.h}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {lookupResult.segmentsPx.map((seg, i) => (
                <line
                  key={i}
                  x1={seg.x1Px}
                  y1={seg.y1Px}
                  x2={seg.x2Px}
                  y2={seg.y2Px}
                  stroke={traceColor(seg.color)}
                  strokeWidth={2}
                  strokeDasharray={seg.dashed ? '5 4' : undefined}
                />
              ))}
              {lookupResult.pointPx && (
                <g>
                  <circle
                    cx={lookupResult.pointPx.xPx}
                    cy={lookupResult.pointPx.yPx}
                    r={5}
                    fill="none"
                    stroke="#facc15"
                    strokeWidth={2}
                  />
                  <circle
                    cx={lookupResult.pointPx.xPx}
                    cy={lookupResult.pointPx.yPx}
                    r={2.2}
                    fill="#ff3b30"
                  />
                </g>
              )}
            </svg>
          </div>

          <div className={`adm-toando-panel ${spec.panelPosition}`}>
            <fieldset className="adm-dark-group adm-dark-inputs">
              <legend>Nhập số liệu</legend>

              <div className="adm-dark-fields">
                <div className="adm-dark-field">
                  <div className="adm-dark-label-row">
                    <label htmlFor={`td-${id}-x`}>{spec.xLabel}</label>
                    <span className="adm-dark-hint">{spec.xHint}</span>
                  </div>
                  <input
                    id={`td-${id}-x`}
                    type="text"
                    value={inputs.x}
                    onChange={(e) => onChange({ ...inputs, x: e.target.value })}
                  />
                </div>

                <div className="adm-dark-field">
                  <div className="adm-dark-label-row">
                    <label htmlFor={`td-${id}-y`}>{spec.yLabel}</label>
                    <span className="adm-dark-hint">{spec.yHint}</span>
                  </div>
                  <input
                    id={`td-${id}-y`}
                    type="text"
                    value={inputs.yOrCurve}
                    onChange={(e) => onChange({ ...inputs, yOrCurve: e.target.value })}
                  />
                </div>

                {spec.rayLabel && (
                  <div className="adm-dark-field">
                    <div className="adm-dark-label-row">
                      <label htmlFor={`td-${id}-ray`}>{spec.rayLabel}</label>
                      {spec.rayHint && <span className="adm-dark-hint">{spec.rayHint}</span>}
                    </div>
                    <input
                      id={`td-${id}-ray`}
                      type="text"
                      value={inputs.ray}
                      onChange={(e) => onChange({ ...inputs, ray: e.target.value })}
                    />
                  </div>
                )}
              </div>
            </fieldset>

            <fieldset className="adm-dark-group adm-dark-output">
              <legend>Kết quả</legend>
              <div className="adm-dark-field">
                <div className="adm-dark-label-row">
                  <label htmlFor={`td-${id}-out`}>{spec.outputLabel}</label>
                </div>
                <input
                  id={`td-${id}-out`}
                  type="text"
                  readOnly
                  className={isNa ? 'result-na' : 'result-ok'}
                  value={lookupResult.displayValue}
                  title={lookupResult.reason ?? meta.title}
                />
              </div>
              {isNa && lookupResult.reason && (
                <div className="adm-dark-reason" role="status">
                  {lookupResult.reason}
                </div>
              )}
            </fieldset>

            {spec.panelPosition === 'right' && (
              <div className="adm-toando-legend">
                <div className="adm-toando-legend-item">
                  <span className="adm-swatch red" />
                  <span>Đường gióng trục vào</span>
                </div>
                <div className="adm-toando-legend-item">
                  <span className="adm-swatch yellow" />
                  <span>Điểm &amp; tia tra kết quả</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
