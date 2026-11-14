/**
 * BangTinhCauCong Web App — Verification Test Suite Pane (`#tab60`)
 *
 * Renders:
 * - `#tab60` pane matching `shell.html:55-60` exact DOM structure:
 *   - `<h1 class="ttl">KIỂM CHỨNG PHẦN MỀM</h1>`
 *   - `<button type="button" class="btn2" id="vt_run">Chạy kiểm chứng</button>`
 *   - `<span id="vt_sum" class="small"></span>`
 *   - `<table class="t dt" id="vt_tb"></table>`
 * - Filter controls by test group (`G1..G9` + `Live`)
 * - Pass/Fail badge indicators
 *
 * Clean-room standalone implementation with zero external CDN URLs.
 */

import React, { useCallback, useEffect, useState } from 'react';
import type { TabId } from '../types/project.ts';
import {
  runSuite,
  vtRender,
  getLatestVtResult,
} from '../engine/verification/verificationSuite.ts';

export interface VerificationPaneProps {
  activeTab: TabId;
}

const GROUPS = [
  { key: 'all', label: 'Tất cả nhóm' },
  { key: 'G1', label: 'G1 (Móng nông Nc, Nq, Nγ)' },
  { key: 'G2', label: 'G2 (Áp lực đất ka)' },
  { key: 'G3', label: 'G3 (Pearson III Φ)' },
  { key: 'G4', label: 'G4 (Mặt cắt BTCT)' },
  { key: 'G5', label: 'G5 (SCT cọc nhồi)' },
  { key: 'G6', label: 'G6 (Biểu đồ tương tác P-M)' },
  { key: 'G7', label: 'G7 (Khung lò xo RCM)' },
  { key: 'G8', label: 'G8 (Cọc ngang & nhóm cọc)' },
  { key: 'G9', label: 'G9 (Lăng thể trượt TC)' },
  { key: 'live', label: 'Live (Dự án đang mở)' },
];

export function VerificationPane({ activeTab }: VerificationPaneProps) {
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [summary, setSummary] = useState<{ total: number; passed: number; failed: number } | null>(null);

  const handleRun = useCallback(() => {
    try {
      const suite = vtRender();
      setSummary({
        total: suite.totalCount,
        passed: suite.passedCount,
        failed: suite.failedCount,
      });
    } catch (err) {
      console.error('[VerificationPane] vtRender error:', err);
    }
  }, []);

  // Filter table rows when selectedGroup changes
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const tb = document.getElementById('vt_tb');
    if (!tb) return;

    const rows = Array.from(tb.querySelectorAll('tr'));
    if (!rows.length) return;

    if (selectedGroup === 'all') {
      rows.forEach((r) => {
        r.style.display = '';
      });
      return;
    }

    let inMatchingGroup = false;
    rows.forEach((r) => {
      if (r.classList.contains('grp')) {
        const text = r.textContent ?? '';
        if (selectedGroup === 'live') {
          inMatchingGroup = !text.startsWith('G1') &&
            !text.startsWith('G2') &&
            !text.startsWith('G3') &&
            !text.startsWith('G4') &&
            !text.startsWith('G5') &&
            !text.startsWith('G6') &&
            !text.startsWith('G7') &&
            !text.startsWith('G8') &&
            !text.startsWith('G9') &&
            !text.includes('Nc, Nq') &&
            !text.includes('Coulomb') &&
            !text.includes('Pearson');
        } else {
          inMatchingGroup = text.includes(selectedGroup);
        }
        r.style.display = inMatchingGroup ? '' : 'none';
      } else {
        r.style.display = inMatchingGroup ? '' : 'none';
      }
    });
  }, [selectedGroup]);

  // Initial check run if tab is shown
  useEffect(() => {
    if (activeTab === 60) {
      const res = getLatestVtResult();
      if (!res) {
        handleRun();
      } else {
        setSummary({
          total: res.totalCount,
          passed: res.passedCount,
          failed: res.failedCount,
        });
      }
    }
  }, [activeTab, handleRun]);

  return (
    <div className="pane" id="tab60" hidden={activeTab !== 60}>
      <h1 className="ttl">KIỂM CHỨNG PHẦN MỀM</h1>
      <p className="small">
        Các ví dụ dưới đây có đầu vào cố định và đáp án lấy từ bảng tra công bố hoặc tính tay độc lập theo công thức của tiêu chuẩn. Phần mềm tính lại từng ví dụ bằng chính các hàm dùng trong bảng tính; kết quả lệch quá sai số cho phép được đánh dấu "Không đạt". Nhóm cuối kiểm tra lại số liệu dự án đang mở.
      </p>

      {/* Visual group filter and run button toolbar */}
      <div
        className="noprint"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#f4f7fb',
          border: '1px solid #1f4e79',
          borderRadius: 4,
          padding: '8px 12px',
          margin: '10px 0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn2" id="vt_run" onClick={handleRun}>
            Chạy kiểm chứng
          </button>
          <span id="vt_sum" className="small" />
        </div>

        {summary && (
          <div style={{ display: 'flex', gap: 6 }}>
            <span
              style={{
                fontSize: 12,
                padding: '2px 8px',
                borderRadius: 3,
                fontWeight: 'bold',
                background: '#1f4e79',
                color: '#fff',
              }}
            >
              Tổng: {summary.total}
            </span>
            <span
              style={{
                fontSize: 12,
                padding: '2px 8px',
                borderRadius: 3,
                fontWeight: 'bold',
                background: '#006b2d',
                color: '#fff',
              }}
            >
              Đạt: {summary.passed}
            </span>
            {summary.failed > 0 && (
              <span
                style={{
                  fontSize: 12,
                  padding: '2px 8px',
                  borderRadius: 3,
                  fontWeight: 'bold',
                  background: '#c00000',
                  color: '#fff',
                }}
              >
                Không đạt: {summary.failed}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Group filter pills */}
      <div
        className="noprint"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          margin: '6px 0 12px',
        }}
      >
        {GROUPS.map((g) => (
          <button
            key={g.key}
            type="button"
            style={{
              font: '12px var(--f-sheet)',
              padding: '2px 8px',
              borderRadius: 3,
              border: '1px solid #1f4e79',
              background: selectedGroup === g.key ? '#1f4e79' : '#fff',
              color: selectedGroup === g.key ? '#fff' : '#1f4e79',
              cursor: 'pointer',
            }}
            onClick={() => setSelectedGroup(g.key)}
          >
            {g.label}
          </button>
        ))}
      </div>

      <table className="t dt" id="vt_tb" />
    </div>
  );
}
