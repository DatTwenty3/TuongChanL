import React, { useEffect, useRef, useState } from 'react';
import { UI_ICONS } from '../assets/iconRegistry';
import type {
  DesignKindType,
  DesignParams,
  ForecastConfig,
  RehabStrategy,
  SurfaceGrade,
  TrafficSummary,
} from '../types/project';

export interface TabDesignParamsProps {
  forecast: ForecastConfig;
  traffic: TrafficSummary;
  designParams: DesignParams;
  loaiTK?: DesignKindType;
  echCu_MPa?: number | null;
  rehabStrategy?: RehabStrategy;
  onChangeGrade: (grade: SurfaceGrade) => void;
  onOpenThamKhao: () => void;
  onGoToKetCau: () => void;
}

export function TabDesignParams({
  forecast,
  traffic,
  designParams,
  loaiTK = 'TK_MOI',
  echCu_MPa = null,
  rehabStrategy,
  onChangeGrade,
  onOpenThamKhao,
  onGoToKetCau,
}: TabDesignParamsProps): React.ReactElement {
  const [ettPopupOpen, setEttPopupOpen] = useState(false);
  const ettWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ettPopupOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (ettWrapRef.current && !ettWrapRef.current.contains(e.target as Node)) {
        setEttPopupOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEttPopupOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [ettPopupOpen]);

  const isRehab = loaiTK === 'CAI_TAO';

  return (
    <div className="adm-tab-pad" data-testid="tab-thong-so">
      <fieldset className="adm-groupbox" style={{ maxWidth: 720 }}>
        <legend>
          {isRehab
            ? 'Thông số thiết kế áo đường sau tăng cường (Chương 10)'
            : 'Thông số thiết kế áo đường'}
        </legend>

        <div className="adm-form-row" style={{ gridTemplateColumns: '330px 140px auto' }}>
          <label htmlFor="ed_Ntk">
            Số trục xe tiêu chuẩn {forecast.tlTrucQuyDoi_kN} kN cho cả 2 chiều trong 1 ngày đêm:
          </label>
          <input
            id="ed_Ntk"
            type="text"
            readOnly
            className="adm-input adm-input-num"
            value={traffic.Ntk_trucNgDem.toFixed(2)}
          />
          <span className="adm-unit">(Trục/ngày đêm.2 chiều)</span>
        </div>

        <div className="adm-form-row" style={{ gridTemplateColumns: '330px 140px auto' }}>
          <label htmlFor="ed_Ntt">Số trục xe tính toán tiêu chuẩn trên 1 làn xe:</label>
          <input
            id="ed_Ntt"
            type="text"
            readOnly
            className="adm-input adm-input-num"
            value={traffic.Ntt_trucLanNgDem.toFixed(2)}
          />
          <span className="adm-unit">(Trục/làn.ngày đêm)</span>
        </div>

        <div className="adm-form-row" style={{ gridTemplateColumns: '330px 140px auto' }}>
          <label htmlFor="ed_Ne">Số trục xe tiêu chuẩn tích lũy trong thời hạn tính toán:</label>
          <input
            id="ed_Ne"
            type="text"
            readOnly
            className="adm-input adm-input-num"
            value={Math.round(traffic.Ne_truc).toLocaleString('en-US')}
          />
          <span className="adm-unit">
            = {(traffic.Ne_truc / 1e6).toFixed(2)} × 10⁶ (Trục)
          </span>
        </div>

        <div className="adm-form-row" style={{ gridTemplateColumns: '330px 140px auto' }}>
          <label htmlFor="cb_LoaiTangMat">
            {isRehab ? 'Loại tầng mặt sau tăng cường:' : 'Loại tầng mặt:'}
          </label>
          <select
            id="cb_LoaiTangMat"
            className="adm-select"
            value={designParams.loaiTangMat}
            onChange={(e) => onChangeGrade(e.target.value as SurfaceGrade)}
          >
            <option value="A1">Cấp cao A1</option>
            <option value="A2">Cấp cao A2</option>
            <option value="B1">Cấp thấp B1</option>
            <option value="B2">Cấp thấp B2</option>
          </select>
          <button type="button" className="adm-btn" onClick={onOpenThamKhao}>
            <img src={UI_ICONS.thamKhaoSmall} alt="" />
            <span>Tham khảo</span>
          </button>
        </div>

        <div className="adm-form-row" style={{ gridTemplateColumns: '330px 140px auto' }}>
          <label htmlFor="ed_Ett">
            {isRehab
              ? 'Module đàn hồi E tính toán (sau tăng cường):'
              : 'Module đàn hồi E tính toán:'}
          </label>
          <div className="adm-ett-wrap" ref={ettWrapRef}>
            <input
              id="ed_Ett"
              type="text"
              readOnly
              className="adm-input adm-input-num adm-input-accent"
              value={designParams.Ett_MPa.toFixed(2)}
            />
            <button
              type="button"
              className="adm-btn"
              style={{ height: 30, padding: '0 9px' }}
              title="Chi tiết Eyc (Bảng 9) và Emin (Bảng 10) — TCCS 38:2022/TCĐBVN"
              aria-expanded={ettPopupOpen}
              onClick={() => setEttPopupOpen((v) => !v)}
            >
              ...
            </button>

            {ettPopupOpen && (
              <div className="adm-ett-popup" role="dialog" aria-label="Chi tiết Eyc và Emin">
                <p>Giá trị này bằng max(Eyc, E tối thiểu)</p>
                <p>Eyc tra Bảng 9 tr. 23 (TCCS 38:2022)</p>
                <p style={{ marginBottom: 10 }}>
                  E tối thiểu tra Bảng 10 tr. 24 (TCCS 38:2022)
                </p>

                <div className="adm-form-row" style={{ gridTemplateColumns: '1fr 76px auto', marginBottom: 6 }}>
                  <label>Module đàn hồi yêu cầu Eyc</label>
                  <input
                    id="ed_Eyc"
                    type="text"
                    readOnly
                    className="adm-input adm-input-center"
                    value={designParams.Eyc_MPa.toFixed(2)}
                  />
                  <span className="adm-unit">(MPa)</span>
                </div>
                <div className="adm-form-row" style={{ gridTemplateColumns: '1fr 76px auto', marginBottom: 0 }}>
                  <label>Module đàn hồi tối thiểu Emin</label>
                  <input
                    id="ed_Emin"
                    type="text"
                    readOnly
                    className="adm-input adm-input-center"
                    value={designParams.Emin_MPa.toFixed(2)}
                  />
                  <span className="adm-unit">(MPa)</span>
                </div>
              </div>
            )}
          </div>
          <span className="adm-unit">(MPa)</span>
        </div>

        {isRehab && (
          <div className="adm-alert-info" data-testid="design-params-ch10-summary">
            {rehabStrategy === 'FULL_REBUILD' ? (
              <>
                <strong>Cải tạo toàn bộ từ nền trở lên (§10.1.4.3 Phương án 1)</strong>: Kết cấu thiết kế mới sau tăng cường đặt trực tiếp trên nền đất E₀.
              </>
            ) : (
              <>
                <strong>Mô đun đàn hồi chung áo đường cũ E<sub>ch,cũ</sub></strong> ={' '}
                <strong>{echCu_MPa !== null ? echCu_MPa.toFixed(2) : '—'} MPa</strong> (đóng vai trò nền tương đương E₀&apos; cho kết cấu sau tăng cường theo §10.4.2).
              </>
            )}
          </div>
        )}

        {designParams.loaiTangMat === 'B2' && (
          <div className="adm-alert-info" data-testid="note-b2-exempt">
            <strong>Tầng mặt cấp thấp B2 (Điều 3.12.4, Điều 9.1.4.3)</strong>: Bảng 9 &amp; Bảng 10 không quy định Eyc/Emin; miễn kiểm toán cắt trượt và kéo uốn.
          </div>
        )}

        <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="adm-btn adm-btn-primary" onClick={onGoToKetCau}>
            <img src={UI_ICONS.chonKcadSmall} alt="" />
            <span>
              {isRehab ? 'Chọn kết cấu tăng cường...' : 'Chọn kết cấu áo đường...'}
            </span>
          </button>
        </div>
      </fieldset>
    </div>
  );
}
