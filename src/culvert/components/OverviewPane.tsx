/**
 * BangTinhCauCong Web App — Overview Pane (`#tab7`)
 *
 * Renders:
 * - Summary dashboard cards (mode, substructure, superstructure, foundation, calculation status)
 * - Quick tab navigation buttons to jump directly to key calculation tabs
 * - Verification / Export readiness indicators
 * - Complete verified `#tab7` HTML containing `#tqToc`, `#tqcfg`, structure inputs, and TCVN errata
 *
 * Clean-room standalone implementation with zero external CDN URLs.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  APPMODE_LABELS,
  type AppMode,
  type TabId,
} from '../types/project.ts';
import { trOn } from '../engine/bridge/pierFlex.ts';
import { dcOn } from '../engine/bridge/pierSolid.ts';
import { sfmOn } from '../engine/foundations/shallowFdn.ts';
import { tqItBind, tqItRender, tqStep } from '../engine/orchestrator.ts';
import { computeTabStatuses, mergeStatus, type TabState } from './tabStatus.ts';
import panesData from '../assets/panes.json';

export interface OverviewPaneProps {
  activeTab: TabId;
  mode: AppMode;
  onSelectTab: (tabId: TabId) => void;
}

interface ComponentStatus {
  name: string;
  tabId: TabId;
  ok: boolean | null;
  detail?: string;
}

export function OverviewPane({ activeTab, mode, onSelectTab }: OverviewPaneProps) {
  const tab7Html = useMemo(() => {
    const entry = panesData.find((p) => p.tabId === 7);
    return entry ? entry.html : '';
  }, []);

  const [statuses, setStatuses] = useState<ComponentStatus[]>([]);

  useEffect(() => {
    if (activeTab === 7 && typeof document !== 'undefined') {
      try {
        tqStep();
        tqItBind();
        tqItRender();
      } catch (err) {
        console.error('[OverviewPane] tqStep/tqItRender error:', err);
      }
    }
  }, [activeTab]);

  // Tổng hợp trạng thái: đọc từ chính các ô kết quả (`.ok` / `.bad`) đã vẽ trong từng mục, không suy diễn thêm.
  // (Bản trước chỉ coi "đã có kết quả" của khung trụ dẻo là đạt/không đạt, không phản ánh kiểm toán.)
  useEffect(() => {
    if (mode !== 'cau') {
      setStatuses([]);
      return;
    }

    const read = () => {
      const st = computeTabStatuses();
      const pick = (...ids: number[]) => mergeStatus(ids.map((i) => st.get(i) ?? null));
      const row = (name: string, tabId: TabId, s: TabState): ComponentStatus => ({
        name,
        tabId,
        ok: s === 'ok' ? true : s === 'bad' ? false : null,
        detail: s === 'ok' ? 'Đạt' : s === 'bad' ? 'Không đạt' : 'Chưa có kết quả',
      });
      const items: ComponentStatus[] = [
        row('Mặt cắt mố (Mục 9)', 5, pick(5)),
        row('Bệ mố (Mục 11)', 6, pick(6)),
      ];
      if (sfmOn()) items.push(row('Móng nông mố (Mục 10)', 52, pick(52)));
      if (trOn()) items.push(row('Khung trụ dẻo (Mục 15-17)', 21, pick(21, 22, 26)));
      else if (dcOn()) items.push(row('Trụ đặc (Mục 15-18)', 46, pick(46, 47, 48)));
      setStatuses(items);
    };

    // Kết quả được dựng bất đồng bộ sau `run()`: đọc ngay và đọc lại sau khi tính xong
    read();
    const timer = setTimeout(read, 700);
    return () => clearTimeout(timer);
  }, [activeTab, mode]);

  const allPassed = statuses.length > 0 && statuses.every((s) => s.ok === true);
  const anyFailed = statuses.some((s) => s.ok === false);

  return (
    <div className="pane" id="tab7" hidden={activeTab !== 7}>
      {/* Quick Summary & Navigation Header Dashboard */}
      <div
        className="noprint"
        style={{
          background: 'linear-gradient(180deg, #f4f7fb 0%, #eef3f8 100%)',
          border: '1px solid #1f4e79',
          borderRadius: 6,
          padding: '12px 16px',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 16, color: '#1f4e79', fontWeight: 'bold' }}>
            TỔNG QUAN & KIỂM TRA KẾT CẤU BẢNG TÍNH
          </h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span
              style={{
                display: 'inline-block',
                padding: '3px 10px',
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 'bold',
                color: '#fff',
                background: allPassed ? '#006b2d' : anyFailed ? '#c00000' : '#1f4e79',
              }}
            >
              {allPassed ? '✓ TẤT CẢ ĐẠT' : anyFailed ? '✗ CÓ MỤC CHƯA ĐẠT' : 'ĐANG THIẾT KẾ'}
            </span>
            <span style={{ fontSize: 13, color: '#555b60' }}>
              Chế độ: <b>{APPMODE_LABELS[mode]}</b>
            </span>
          </div>
        </div>

        {/* Quick Tab Navigation Shortcuts */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 'bold', color: '#1f4e79', alignSelf: 'center', marginRight: 4 }}>
            Chuyển nhanh:
          </span>
          <button type="button" className="btn2" onClick={() => onSelectTab(8)}>
            1. Dầm giữa
          </button>
          <button type="button" className="btn2" onClick={() => onSelectTab(4)}>
            8. Tải trọng mố
          </button>
          <button type="button" className="btn2" onClick={() => onSelectTab(5)}>
            9. Mặt cắt mố
          </button>
          <button type="button" className="btn2" onClick={() => onSelectTab(2)}>
            12. SCT cọc mố
          </button>
          <button type="button" className="btn2" onClick={() => onSelectTab(20)}>
            14. Tải trọng trụ
          </button>
          <button type="button" className="btn2" onClick={() => onSelectTab(60)}>
            Kiểm chứng phần mềm (tab 60)
          </button>
        </div>

        {/* Component Pass/Fail Status List */}
        {statuses.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, fontSize: 13 }}>
            {statuses.map((st) => (
              <div
                key={st.name}
                style={{
                  background: '#ffffff',
                  border: `1px solid ${st.ok === true ? '#006b2d' : st.ok === false ? '#c00000' : '#9aa3a9'}`,
                  borderRadius: 4,
                  padding: '6px 10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span
                  style={{ cursor: 'pointer', color: '#1f4e79', textDecoration: 'underline' }}
                  onClick={() => onSelectTab(st.tabId)}
                >
                  {st.name}
                </span>
                <span
                  style={{
                    fontWeight: 'bold',
                    color: st.ok === true ? '#006b2d' : st.ok === false ? '#c00000' : '#555b60',
                  }}
                >
                  {st.ok === true ? '✓ Đạt' : st.ok === false ? '✗ K.Đạt' : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Complete Verified Tab 7 HTML (TOC, Structure Configurations, Errata Table) */}
      <div dangerouslySetInnerHTML={{ __html: tab7Html }} />
    </div>
  );
}
