import React from 'react';
import { STEP_SHORT_LABEL, getInputSteps, type MainTabKey } from '../state/navigation';
import type { DesignKindType, PavementKind } from '../types/project';

/**
 * Thanh "‹ Trước | Tiếp theo ›" ở cuối các trang nhập liệu: dẫn người dùng đi hết quy trình
 * nhập → chạy kiểm toán mà không phải quay lại cây điều hướng / ribbon.
 */
export function StepNav({
  active,
  loaiTK,
  loaiMat,
  isRunning,
  onGo,
  onRun,
}: {
  active: MainTabKey;
  loaiTK: DesignKindType;
  loaiMat: PavementKind;
  isRunning: boolean;
  onGo: (tab: MainTabKey) => void;
  onRun: () => void;
}): React.ReactElement | null {
  const steps = getInputSteps(loaiTK, loaiMat);
  const idx = steps.indexOf(active);
  if (idx < 0) return null;
  const prev = idx > 0 ? steps[idx - 1] : null;
  const next = idx < steps.length - 1 ? steps[idx + 1] : null;

  return (
    <div className="adm-stepnav" data-testid="step-nav">
      <span className="adm-stepnav-count">
        Bước {idx + 1}/{steps.length}
      </span>
      <div className="adm-stepnav-btns">
        {prev && (
          <button
            type="button"
            className="adm-btn"
            data-testid="step-prev"
            onClick={() => onGo(prev)}
          >
            ‹ {STEP_SHORT_LABEL[prev] ?? 'Trước'}
          </button>
        )}
        {next ? (
          <button
            type="button"
            className="adm-btn adm-btn-primary"
            data-testid="step-next"
            onClick={() => onGo(next)}
          >
            Tiếp theo: {STEP_SHORT_LABEL[next] ?? 'Tiếp'} ›
          </button>
        ) : (
          <button
            type="button"
            className="adm-btn adm-btn-primary"
            data-testid="step-run"
            disabled={isRunning}
            onClick={onRun}
          >
            Chạy kiểm toán (F5) ›
          </button>
        )}
      </div>
    </div>
  );
}
