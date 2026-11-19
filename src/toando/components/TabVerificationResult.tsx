import React, { useState } from 'react';
import { ResultSummaryBar, type ResultSummaryItem } from './ResultSummaryBar';
import {
  RvKeoUonAllReport,
  RvKeoUonReport,
  RvTruotAllReport,
  RvTruotReport,
  RvVongReport,
} from '../reports';
import type {
  AlternativeVerificationResult,
  ProjectState,
  TrafficSummary,
  TwoLayerReductionRow,
} from '../types/project';

export interface TabVerificationResultProps {
  mode: 'vong' | 'truot' | 'keo-uon';
  project: ProjectState;
  traffic: TrafficSummary;
  verification: AlternativeVerificationResult | null;
  selectedShearTargetId: string | null;
  selectedFlexuralLayerId: string | null;
  onRunVerification: () => void;
}

function fmt(val: number | null | undefined, digits = 2): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '';
  return val.toFixed(digits);
}

function ReductionTopGrid({
  rows,
  modulusHeader,
}: {
  rows: TwoLayerReductionRow[];
  modulusHeader: string;
}): React.ReactElement {
  return (
    <table className="adm-table">
      <thead>
        <tr>
          <th style={{ width: 220 }}>Lớp kết cấu (từ trên xuống)</th>
          <th style={{ width: 90 }}>{modulusHeader}</th>
          <th style={{ width: 85 }}>t = E1/E2</th>
          <th style={{ width: 75 }}>hi (cm)</th>
          <th style={{ width: 85 }}>k = h1/h2</th>
          <th style={{ width: 85 }}>Htb (cm)</th>
          <th style={{ width: 95 }}>E&apos;tb (MPa)</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={7} className="center adm-muted-dash">
              Chưa có dữ liệu tính đổi 2 lớp
            </td>
          </tr>
        ) : (
          rows.map((r) => (
            <tr key={`${r.layerOrder}-${r.tenVatLieu}`}>
              <td>{r.tenVatLieu}</td>
              <td className="num">{fmt(r.E_MPa, 2)}</td>
              <td className="num">{r.t_E1_E2 !== null ? fmt(r.t_E1_E2, 3) : '—'}</td>
              <td className="num">{fmt(r.h_cm, 2)}</td>
              <td className="num">{r.k_h1_h2 !== null ? fmt(r.k_h1_h2, 3) : '—'}</td>
              <td className="num">{fmt(r.Htb_cm, 2)}</td>
              <td className="num">{fmt(r.EtbPrime_MPa, 2)}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

export function TabVerificationResult({
  mode,
  project,
  traffic,
  verification,
  selectedShearTargetId,
  selectedFlexuralLayerId,
  onRunVerification,
}: TabVerificationResultProps): React.ReactElement {
  const [topHeight, setTopHeight] = useState(172);

  if (!verification) {
    return (
      <div className="adm-tab-pad" data-testid={`tab-empty-${mode}`}>
        <fieldset className="adm-groupbox">
          <legend>Kết quả kiểm toán</legend>
          <p style={{ margin: '0 0 12px 0' }}>
            Chưa có kết quả kiểm toán cho phương án đang chọn. Nhấn <strong>Chạy kiểm toán (F5)</strong> để tính toán.
          </p>
          <button type="button" className="adm-btn adm-btn-primary" onClick={onRunVerification}>
            Chạy kiểm toán (F5)
          </button>
        </fieldset>
      </div>
    );
  }

  let topRows: TwoLayerReductionRow[] = [];
  let modulusHeader = 'Ev (MPa)';

  if (mode === 'vong') {
    topRows = verification.deflection.reduction.rows;
    modulusHeader = 'Ev (MPa)';
  } else if (mode === 'truot') {
    const activeTarget =
      (selectedShearTargetId
        ? verification.shearTargets.find((t) => t.targetId === selectedShearTargetId)
        : undefined) ?? verification.shearTargets[0];
    topRows = activeTarget?.reductionAbove.rows ?? [];
    modulusHeader = 'Etr (MPa)';
  } else {
    const activeLayer =
      (selectedFlexuralLayerId
        ? verification.flexuralLayers.find((l) => l.layerId === selectedFlexuralLayerId)
        : undefined) ?? verification.flexuralLayers[0];
    topRows = activeLayer?.reductionBelow?.rows ?? [];
    modulusHeader = 'Eku (MPa)';
  }

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = topHeight;
    const onMove = (ev: MouseEvent) => {
      setTopHeight(Math.max(90, Math.min(360, startH + (ev.clientY - startY))));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const singleShearTarget =
    mode === 'truot' && selectedShearTargetId
      ? verification.shearTargets.find((t) => t.targetId === selectedShearTargetId)
      : undefined;

  const singleFlexLayer =
    mode === 'keo-uon' && selectedFlexuralLayerId
      ? verification.flexuralLayers.find((l) => l.layerId === selectedFlexuralLayerId)
      : undefined;

  const loaiTK = project.projectInfo.loaiTK;
  const rehabSummary = verification.rehabSummary;

  const summaryItems: ResultSummaryItem[] = [
    {
      label: 'Độ võng đàn hồi',
      value: `${fmt(verification.deflection.Ech_MPa, 1)} ≥ ${fmt(verification.deflection.Eyc_required_MPa, 1)} MPa`,
      passed: verification.deflection.passed,
    },
    {
      label: 'Cắt trượt',
      value: verification.shearApplicable ? undefined : 'miễn kiểm toán',
      passed: verification.shearApplicable ? verification.allShearPassed : null,
    },
    {
      label: 'Kéo uốn',
      value: verification.flexuralApplicable ? undefined : 'miễn kiểm toán',
      passed: verification.flexuralApplicable ? verification.allFlexuralPassed : null,
    },
  ];

  return (
    <div className="adm-verify-split" data-testid={`tab-verify-${mode}`}>
      <ResultSummaryBar
        title={`Phương án: ${verification.alternativeName}`}
        passed={verification.allPassed}
        items={summaryItems}
        testId="verify-summary"
      />
      <div className="adm-verify-top" style={{ height: `${topHeight}px` }}>
        <ReductionTopGrid rows={topRows} modulusHeader={modulusHeader} />
      </div>
      <div
        className="adm-splitter-h"
        title="Kéo để thay đổi chiều cao bảng"
        onMouseDown={startResize}
      />
      <div className="adm-verify-bottom adm-selectable">
        {mode === 'vong' && (
          <RvVongReport
            deflection={verification.deflection}
            roadScale={project.roadScale}
            subgradeE0={project.subgrade.E0_MPa}
            alternativeName={verification.alternativeName}
            loaiTK={loaiTK}
            rehabSummary={rehabSummary}
          />
        )}
        {mode === 'truot' &&
          (singleShearTarget ? (
            <RvTruotReport
              target={singleShearTarget}
              roadScale={project.roadScale}
              forecast={project.forecast}
              designObject={project.projectInfo.doiTuongTK}
              traffic={traffic}
              loaiTK={loaiTK}
              rehabSummary={rehabSummary}
            />
          ) : (
            <RvTruotAllReport
              verification={verification}
              project={project}
              traffic={traffic}
              loaiTK={loaiTK}
              rehabSummary={rehabSummary}
            />
          ))}
        {mode === 'keo-uon' &&
          (singleFlexLayer ? (
            <RvKeoUonReport
              layerResult={singleFlexLayer}
              roadScale={project.roadScale}
              forecast={project.forecast}
              traffic={traffic}
              loaiTK={loaiTK}
              rehabSummary={rehabSummary}
            />
          ) : (
            <RvKeoUonAllReport
              verification={verification}
              project={project}
              traffic={traffic}
              loaiTK={loaiTK}
              rehabSummary={rehabSummary}
            />
          ))}
      </div>
    </div>
  );
}
