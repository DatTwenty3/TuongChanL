import React, { useEffect, useState } from 'react';
import { computeNe } from '../../pavement/engine/tccs39';
import {
  ALPHA_C_BY_AGGREGATE,
  FR_BY_CLASS,
  GAMMA_R_BY_CLASS,
  KC_BY_CLASS,
  KR_BY_SHOULDER,
  RIGID_AGGREGATE_OPTIONS,
  RIGID_REGION_OPTIONS,
  RIGID_ROAD_CLASS_OPTIONS,
  RIGID_SHOULDER_OPTIONS,
  TG_BY_REGION,
  ecFromFr,
  suggestGammaR,
  type RigidVerification,
} from '../engine';
import { RvRigidReport } from '../reports/rigidReports';
import type {
  ProjectState,
  RigidAggregate,
  RigidProjectData,
  RigidRegion,
  RigidRoadClass,
  RigidShoulder,
} from '../types/project';

type RigidUpdater = (fn: (prev: RigidProjectData) => RigidProjectData) => void;

const MAT_BOUND_OPTIONS = ['CPĐD gia cố xi măng', 'Bê tông đầm lăn', 'Bê tông nghèo', 'Đất gia cố xi măng'];

function fmtNum(n: number, d = 2): string {
  return Number.isFinite(n) ? n.toLocaleString('vi-VN', { maximumFractionDigits: d, minimumFractionDigits: 0 }) : '—';
}

/** Ô số giữ chuỗi đang gõ (cho phép "0," dở dang) và chỉ cập nhật khi giá trị hợp lệ. */
function NumInput({
  id,
  value,
  onChange,
  step,
  disabled,
  className = 'adm-input adm-input-num',
}: {
  id?: string;
  value: number;
  onChange: (n: number) => void;
  step?: number | string;
  disabled?: boolean;
  className?: string;
}): React.ReactElement {
  const [text, setText] = useState<string>(String(value));
  useEffect(() => {
    setText((cur) => (parseFloat(cur.replace(',', '.')) === value ? cur : String(value)));
  }, [value]);
  return (
    <input
      id={id}
      type="number"
      className={className}
      step={step}
      disabled={disabled}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseFloat(e.target.value);
        if (Number.isFinite(n)) onChange(n);
      }}
    />
  );
}

function Row({
  label,
  unit,
  note,
  children,
  htmlFor,
}: {
  label: React.ReactNode;
  unit?: React.ReactNode;
  note?: React.ReactNode;
  children: React.ReactNode;
  htmlFor?: string;
}): React.ReactElement {
  return (
    <div className="adm-form-row" style={{ gridTemplateColumns: '300px minmax(200px, 340px) 1fr' }}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      <span className="adm-unit">
        {unit}
        {note ? <em style={{ marginLeft: 8, opacity: 0.8 }}>{note}</em> : null}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tải trọng trục và Ne (Điều 8.2.6, Phụ lục A)
// ---------------------------------------------------------------------------
export function TabRigidTraffic({
  rigid,
  onChange,
}: {
  rigid: RigidProjectData;
  onChange: RigidUpdater;
}): React.ReactElement {
  const T = rigid.traffic;
  const ne = computeNe(T, rigid.input.Ps);
  const setT = (patch: Partial<typeof T>) => onChange((p) => ({ ...p, traffic: { ...p.traffic, ...patch } }));
  return (
    <div className="adm-tab-pad" data-testid="tab-cung-giao-thong">
      <fieldset className="adm-groupbox" style={{ maxWidth: 860 }}>
        <legend>Trục tính mỏi và trục đơn nặng nhất (Điều 8.2.6, 8.2.7)</legend>
        <Row label="Trục đơn tính mỏi tiêu chuẩn Ps:" unit="(kN)" note="Điều 8.2.6: Ps = 100 kN" htmlFor="rg_Ps">
          <NumInput
            id="rg_Ps"
            value={rigid.input.Ps}
            step={5}
            onChange={(n) => onChange((p) => ({ ...p, input: { ...p.input, Ps: n } }))}
          />
        </Row>
        <Row label="Trục đơn nặng nhất thiết kế Pm:" unit="(kN)" note="150, 180 hoặc 240 kN (Điều A.5)" htmlFor="rg_Pm">
          <NumInput
            id="rg_Pm"
            value={rigid.input.Pmax}
            step={5}
            onChange={(n) => onChange((p) => ({ ...p, input: { ...p.input, Pmax: n } }))}
          />
        </Row>
      </fieldset>

      <fieldset className="adm-groupbox" style={{ maxWidth: 860, marginTop: 14 }}>
        <legend>Số lần tác dụng tích lũy Ne trên làn xe thiết kế (Phụ lục A)</legend>
        <label className="adm-check-row" style={{ marginBottom: 10 }}>
          <input
            type="checkbox"
            data-testid="chk-ne-auto"
            checked={rigid.neAuto}
            onChange={(e) => onChange((p) => ({ ...p, neAuto: e.target.checked }))}
          />
          <span>Tính Ne từ phổ tải trọng trục bên dưới (nếu bỏ chọn: nhập trực tiếp Ne ở tab Kết cấu tấm BTXM)</span>
        </label>
        <Row label="ADTT hai chiều (xe 2 trục, 6 bánh trở lên):" unit="(xe/ngày)" htmlFor="rg_adtt">
          <NumInput id="rg_adtt" value={T.adtt} onChange={(n) => setT({ adtt: n })} />
        </Row>
        <Row label="Hệ số phân phối theo chiều xe chạy:" note="Điều A.2" htmlFor="rg_fh">
          <NumInput id="rg_fh" value={T.fhuong} step={0.05} onChange={(n) => setT({ fhuong: n })} />
        </Row>
        <Row label="Hệ số phân phối theo làn:" note="Điều A.3" htmlFor="rg_fl">
          <NumInput id="rg_fl" value={T.flan} step={0.05} onChange={(n) => setT({ flan: n })} />
        </Row>
        <Row label="Số trục đơn trong 3000 xe điều tra n:" unit="(trục)" note="Công thức (A.2)" htmlFor="rg_n">
          <NumInput id="rg_n" value={T.naxle} onChange={(n) => setT({ naxle: n })} />
        </Row>
        <Row label="Tốc độ tăng trưởng trung bình năm gr:" unit="(%)" htmlFor="rg_g">
          <NumInput id="rg_g" value={T.grow} step={0.5} onChange={(n) => setT({ grow: n })} />
        </Row>
        <Row label="Thời hạn phục vụ thiết kế t:" unit="(năm)" note="Bảng 9" htmlFor="rg_t">
          <NumInput id="rg_t" value={T.tyear} onChange={(n) => setT({ tyear: n })} />
        </Row>
        <Row label="Hệ số phân bố ngang vệt bánh xe η:" note="Bảng A.2: 0,17–0,22 / 0,34–0,39 / 0,54–0,62" htmlFor="rg_eta">
          <NumInput id="rg_eta" value={T.eta} step={0.01} onChange={(n) => setT({ eta: n })} />
        </Row>

        <table className="adm-table" style={{ maxWidth: 560, marginTop: 6 }}>
          <thead>
            <tr>
              <th style={{ width: 40 }}>STT</th>
              <th>Pi (kN)</th>
              <th>pi (%)</th>
              <th>kpi = (Pi/Ps)¹⁶</th>
              <th style={{ width: 44 }} />
            </tr>
          </thead>
          <tbody>
            {T.spec.map((s, i) => (
              <tr key={i}>
                <td className="center">{i + 1}</td>
                <td>
                  <NumInput
                    className="num"
                    value={s.P}
                    onChange={(n) =>
                      setT({ spec: T.spec.map((x, j) => (j === i ? { ...x, P: n } : x)) })
                    }
                  />
                </td>
                <td>
                  <NumInput
                    className="num"
                    value={s.p}
                    onChange={(n) =>
                      setT({ spec: T.spec.map((x, j) => (j === i ? { ...x, p: n } : x)) })
                    }
                  />
                </td>
                <td className="num">{fmtNum(Math.pow(s.P / (rigid.input.Ps || 100), 16), 4)}</td>
                <td className="center">
                  <button
                    type="button"
                    className="adm-btn"
                    aria-label={`Xóa dòng ${i + 1}`}
                    disabled={T.spec.length <= 1}
                    onClick={() => setT({ spec: T.spec.filter((_, j) => j !== i) })}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 8 }}>
          <button
            type="button"
            className="adm-btn"
            data-testid="btn-add-axle-row"
            onClick={() => setT({ spec: [...T.spec, { P: 100, p: 0 }] })}
          >
            + Thêm nhóm trục
          </button>
          <span className="adm-unit" style={{ marginLeft: 12 }}>
            Tổng pi = {fmtNum(ne.ptot, 1)}%
          </span>
        </div>

        <div className="adm-alert-info" style={{ marginTop: 14 }} data-testid="rigid-ne-summary">
          <div>
            N<sub>s1</sub> = {fmtNum(ne.Ns1, 4)} lần/ngày.làn (Công thức A.2) &nbsp;→&nbsp; N<sub>e</sub> ={' '}
            <strong>{Math.round(ne.Ne).toLocaleString('en-US')}</strong> lần (Công thức A.3)
          </div>
        </div>
      </fieldset>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Kết cấu tấm BTXM (Điều 5, 8)
// ---------------------------------------------------------------------------
export function TabRigidStructure({
  rigid,
  subgradeE0,
  onChange,
}: {
  rigid: RigidProjectData;
  subgradeE0: number;
  onChange: RigidUpdater;
}): React.ReactElement {
  const I = rigid.input;
  const setI = (patch: Partial<typeof I>) => onChange((p) => ({ ...p, input: { ...p.input, ...patch } }));
  const gr = GAMMA_R_BY_CLASS[rigid.roadClass];

  const applyRoadClass = (roadClass: RigidRoadClass) =>
    onChange((p) => {
      const fr = FR_BY_CLASS[roadClass];
      const label = RIGID_ROAD_CLASS_OPTIONS.find((o) => o.value === roadClass)?.label ?? p.input.cap;
      return {
        ...p,
        roadClass,
        input: {
          ...p.input,
          cap: label,
          kc: KC_BY_CLASS[roadClass],
          gr: suggestGammaR(roadClass),
          fr,
          Ec: ecFromFr(fr),
        },
      };
    });
  const applyRegion = (region: RigidRegion) =>
    onChange((p) => ({ ...p, region, input: { ...p.input, Tg: TG_BY_REGION[region] } }));
  const applyAggregate = (aggregate: RigidAggregate) =>
    onChange((p) => ({ ...p, aggregate, input: { ...p.input, ac: ALPHA_C_BY_AGGREGATE[aggregate] } }));
  const applyShoulder = (shoulder: RigidShoulder) =>
    onChange((p) => ({ ...p, shoulder, input: { ...p.input, kr: KR_BY_SHOULDER[shoulder] } }));

  return (
    <div className="adm-tab-pad" data-testid="tab-cung-ket-cau">
      <fieldset className="adm-groupbox" style={{ maxWidth: 900 }}>
        <legend>Cấp hạng đường và các hệ số tra theo TCCS 39:2022/TCĐBVN</legend>
        <Row label="Cấp hạng đường:" note={`Bảng 9: độ tin cậy ${gr.reliability}%, thời hạn ${gr.years} năm`} htmlFor="rg_class">
          <select
            id="rg_class"
            className="adm-select"
            value={rigid.roadClass}
            onChange={(e) => applyRoadClass(e.target.value as RigidRoadClass)}
          >
            {RIGID_ROAD_CLASS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Vùng khí hậu (gradien nhiệt Tg):" note="Điều 8.2.8" htmlFor="rg_region">
          <select
            id="rg_region"
            className="adm-select"
            value={rigid.region}
            onChange={(e) => applyRegion(e.target.value as RigidRegion)}
          >
            {RIGID_REGION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Loại đá cốt liệu thô (αc):" note="Bảng 10" htmlFor="rg_agg">
          <select
            id="rg_agg"
            className="adm-select"
            value={rigid.aggregate}
            onChange={(e) => applyAggregate(e.target.value as RigidAggregate)}
          >
            {RIGID_AGGREGATE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Kết cấu lề (kr):" note="Điều 8.3.1" htmlFor="rg_shoulder">
          <select
            id="rg_shoulder"
            className="adm-select"
            value={rigid.shoulder}
            onChange={(e) => applyShoulder(e.target.value as RigidShoulder)}
          >
            {RIGID_SHOULDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Row>
      </fieldset>

      <fieldset className="adm-groupbox" style={{ maxWidth: 900, marginTop: 14 }}>
        <legend>Mô hình tính và tấm BTXM</legend>
        <Row label="Mô hình tính:" note="Điều 8.2.1" htmlFor="rg_model">
          <select
            id="rg_model"
            className="adm-select"
            value={String(I.model)}
            onChange={(e) => setI({ model: e.target.value === '2' ? 2 : 1 })}
          >
            <option value="1">Mô hình 1 — tấm 1 lớp, móng vật liệu hạt (Điều 8.3)</option>
            <option value="2">Mô hình 2 — tấm 2 lớp, móng gia cố (Điều 8.4)</option>
          </select>
        </Row>
        <Row label="Chiều dày tấm hc:" unit="(m)" htmlFor="rg_hc">
          <NumInput id="rg_hc" value={I.hc} step={0.01} onChange={(n) => setI({ hc: n })} />
        </Row>
        <Row label="Chiều dài tấm L:" unit="(m)" htmlFor="rg_L">
          <NumInput id="rg_L" value={I.L} step={0.1} onChange={(n) => setI({ L: n })} />
        </Row>
        <Row label="Chiều rộng tấm B:" unit="(m)" htmlFor="rg_B">
          <NumInput id="rg_B" value={I.B} step={0.1} onChange={(n) => setI({ B: n })} />
        </Row>
        <Row label="Cường độ kéo uốn thiết kế fr:" unit="(MPa)" note="Điều 8.2.3" htmlFor="rg_fr">
          <NumInput id="rg_fr" value={I.fr} step={0.1} onChange={(n) => setI({ fr: n })} />
        </Row>
        <Row
          label="Mô đun đàn hồi Ec:"
          unit={
            <>
              (MPa){' '}
              <button
                type="button"
                className="adm-btn"
                data-testid="btn-ec-from-fr"
                onClick={() => setI({ Ec: ecFromFr(I.fr) })}
              >
                Tra Bảng 11 theo fr
              </button>
            </>
          }
          htmlFor="rg_Ec"
        >
          <NumInput id="rg_Ec" value={I.Ec} step={500} onChange={(n) => setI({ Ec: n })} />
        </Row>
        <Row label="Hệ số Poisson μc:" htmlFor="rg_muc">
          <NumInput id="rg_muc" value={I.muc} step={0.01} onChange={(n) => setI({ muc: n })} />
        </Row>
        <Row label="Hệ số dãn nở nhiệt αc:" unit="(1/°C)" htmlFor="rg_ac">
          <NumInput id="rg_ac" value={I.ac} step={0.000001} onChange={(n) => setI({ ac: n })} />
        </Row>
        <Row label="Gradien nhiệt độ lớn nhất Tg:" unit="(°C/m)" htmlFor="rg_Tg">
          <NumInput id="rg_Tg" value={I.Tg} onChange={(n) => setI({ Tg: n })} />
        </Row>
      </fieldset>

      <fieldset className="adm-groupbox" style={{ maxWidth: 900, marginTop: 14 }}>
        <legend>Hệ số tính toán</legend>
        <Row label="Hệ số triết giảm ứng suất kr:" note="Điều 8.3.1: 0,87 / 0,92 / 1,00" htmlFor="rg_kr">
          <NumInput id="rg_kr" value={I.kr} step={0.01} onChange={(n) => setI({ kr: n })} />
        </Row>
        <Row label="Hệ số tổng hợp kc:" note="Điều 8.3.1: 1,15 / 1,10 / 1,05 / 1,00" htmlFor="rg_kc">
          <NumInput id="rg_kc" value={I.kc} step={0.01} onChange={(n) => setI({ kc: n })} />
        </Row>
        <Row label="Hệ số độ tin cậy thiết kế γr:" note={`Bảng 9: ${gr.min}–${gr.max}`} htmlFor="rg_gr">
          <NumInput id="rg_gr" value={I.gr} step={0.01} onChange={(n) => setI({ gr: n })} />
        </Row>
        <Row
          label="Số trục tích lũy Ne (nhập tay):"
          unit="(lần)"
          note={rigid.neAuto ? 'Đang tính từ phổ tải ở tab Tải trọng trục' : undefined}
          htmlFor="rg_Ne"
        >
          <NumInput id="rg_Ne" value={I.Ne} step={1000} disabled={rigid.neAuto} onChange={(n) => setI({ Ne: n })} />
        </Row>
      </fieldset>

      <fieldset className="adm-groupbox" style={{ maxWidth: 900, marginTop: 14 }}>
        <legend>Nền đất và các lớp móng</legend>
        <label className="adm-check-row" style={{ marginBottom: 10 }}>
          <input
            type="checkbox"
            data-testid="chk-e0-subgrade"
            checked={rigid.e0FromSubgrade}
            onChange={(e) => onChange((p) => ({ ...p, e0FromSubgrade: e.target.checked }))}
          />
          <span>Lấy E0 từ mục Đất nền ({fmtNum(subgradeE0, 2)} MPa)</span>
        </label>
        <Row label="Mô đun đàn hồi chung của nền đất E0:" unit="(MPa)" htmlFor="rg_E0">
          <NumInput
            id="rg_E0"
            value={rigid.e0FromSubgrade ? subgradeE0 : I.E0}
            disabled={rigid.e0FromSubgrade}
            onChange={(n) => setI({ E0: n })}
          />
        </Row>

        <table className="adm-table" style={{ maxWidth: 620, marginTop: 6 }}>
          <thead>
            <tr>
              <th style={{ width: 40 }}>STT</th>
              <th>Lớp vật liệu hạt (từ trên xuống)</th>
              <th style={{ width: 100 }}>Ei (MPa)</th>
              <th style={{ width: 90 }}>hi (m)</th>
              <th style={{ width: 44 }} />
            </tr>
          </thead>
          <tbody>
            {I.layers.map((l, i) => (
              <tr key={i}>
                <td className="center">{i + 1}</td>
                <td>
                  <input
                    type="text"
                    value={l.name}
                    onChange={(e) =>
                      setI({ layers: I.layers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })
                    }
                  />
                </td>
                <td>
                  <NumInput
                    className="num"
                    value={l.E}
                    onChange={(n) => setI({ layers: I.layers.map((x, j) => (j === i ? { ...x, E: n } : x)) })}
                  />
                </td>
                <td>
                  <NumInput
                    className="num"
                    value={l.h}
                    step={0.01}
                    onChange={(n) => setI({ layers: I.layers.map((x, j) => (j === i ? { ...x, h: n } : x)) })}
                  />
                </td>
                <td className="center">
                  <button
                    type="button"
                    className="adm-btn"
                    aria-label={`Xóa lớp ${i + 1}`}
                    onClick={() => setI({ layers: I.layers.filter((_, j) => j !== i) })}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 8 }}>
          <button
            type="button"
            className="adm-btn"
            data-testid="btn-add-gran-layer"
            onClick={() => setI({ layers: [...I.layers, { name: 'Lớp vật liệu hạt', E: 200, h: 0.15 }] })}
          >
            + Thêm lớp
          </button>
        </div>

        {I.model === 2 && (
          <div style={{ marginTop: 16 }}>
            <Row label="Vật liệu lớp móng trên gia cố:" htmlFor="rg_mat">
              <select
                id="rg_mat"
                className="adm-select"
                value={I.matBound}
                onChange={(e) => setI({ matBound: e.target.value })}
              >
                {MAT_BOUND_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="Mô đun đàn hồi Eb:" unit="(MPa)" htmlFor="rg_Eb">
              <NumInput id="rg_Eb" value={I.Eb} step={50} onChange={(n) => setI({ Eb: n })} />
            </Row>
            <Row label="Chiều dày hb:" unit="(m)" htmlFor="rg_hb">
              <NumInput id="rg_hb" value={I.hb} step={0.01} onChange={(n) => setI({ hb: n })} />
            </Row>
            <Row label="Hệ số Poisson μb:" note="Điều 8.4.1" htmlFor="rg_mub">
              <NumInput id="rg_mub" value={I.mub} step={0.01} onChange={(n) => setI({ mub: n })} />
            </Row>
            <Row label="Cường độ kéo uốn yêu cầu fbr:" unit="(MPa)" note="Bảng 3; 0 = không kiểm điều kiện (8)" htmlFor="rg_fbr">
              <NumInput id="rg_fbr" value={I.fbr} step={0.1} onChange={(n) => setI({ fbr: n })} />
            </Row>
            <Row label="Lớp cách ly bê tông nhựa giữa tấm và móng:" note="Điều 8.4.5" htmlFor="rg_caly">
              <select
                id="rg_caly"
                className="adm-select"
                value={String(I.caly)}
                onChange={(e) => setI({ caly: e.target.value === '1' ? 1 : 0 })}
              >
                <option value="0">Không có (tính kn từ tiếp xúc)</option>
                <option value="1">Có (kn = 3000 MPa/m)</option>
              </select>
            </Row>
          </div>
        )}
      </fieldset>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Khe nối (Điều 6)
// ---------------------------------------------------------------------------
export function TabRigidJoint({
  rigid,
  verification,
  onChange,
}: {
  rigid: RigidProjectData;
  verification: RigidVerification;
  onChange: RigidUpdater;
}): React.ReactElement {
  const J = rigid.joint;
  const res = verification.joint;
  const setJ = (patch: Partial<typeof J>) => onChange((p) => ({ ...p, joint: { ...p.joint, ...patch } }));
  return (
    <div className="adm-tab-pad" data-testid="tab-cung-khe-noi">
      <fieldset className="adm-groupbox" style={{ maxWidth: 860 }}>
        <legend>Cấu tạo khe nối tấm BTXM (Điều 6)</legend>
        <Row label="Chiều dày tấm (lấy theo kết cấu tấm):" unit="(cm)" note={`L = ${fmtNum(verification.input.L, 2)} m`}>
          <input className="adm-input adm-input-num" readOnly value={fmtNum(res.h, 1)} />
        </Row>
        <Row label="Chiều rộng làn xe (tra thanh liên kết khe dọc):" unit="(m)" note="Bảng 5" htmlFor="rg_lane">
          <select
            id="rg_lane"
            className="adm-select"
            value={J.kc}
            onChange={(e) => setJ({ kc: e.target.value as typeof J.kc })}
          >
            <option value="3.00">3,00</option>
            <option value="3.50">3,50</option>
            <option value="3.75">3,75</option>
            <option value="4.50">4,50</option>
          </select>
        </Row>
        <Row label="Lớp móng trên:" note="Điều 6.2.4" htmlFor="rg_mong">
          <select
            id="rg_mong"
            className="adm-select"
            value={J.mong}
            onChange={(e) => setJ({ mong: e.target.value as typeof J.mong })}
          >
            <option value="hat">Vật liệu hạt</option>
            <option value="gc">Gia cố chất liên kết</option>
          </select>
        </Row>
        <Row label="Cấp hạng đường (số lần cắt khe):" htmlFor="rg_capcat">
          <select
            id="rg_capcat"
            className="adm-select"
            value={J.cap}
            onChange={(e) => setJ({ cap: e.target.value as typeof J.cap })}
          >
            <option value="thap">Cấp thấp (cấp III trở xuống)</option>
            <option value="cao">Cấp cao (cao tốc, cấp I, II)</option>
          </select>
        </Row>

        <table className="adm-table" style={{ maxWidth: 760, marginTop: 10 }} data-testid="rigid-joint-table">
          <thead>
            <tr>
              <th>Hạng mục</th>
              <th>Kết quả</th>
              <th style={{ width: 120 }}>Căn cứ</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Thanh liên kết khe dọc (đường kính × dài × cách, mm)</td>
              <td>{res.tie}</td>
              <td className="center">Bảng 5</td>
            </tr>
            <tr>
              <td>Thanh truyền lực khe ngang: đường kính / dài / cách (mm)</td>
              <td>
                Ø{res.d[1]} / {res.d[2]} / {res.d[3]}
              </td>
              <td className="center">Điều 6.2.6</td>
            </tr>
            <tr>
              <td>Chiều sâu cắt khe co giả</td>
              <td>{res.doc_gia}</td>
              <td className="center">Điều 6.2.4</td>
            </tr>
            <tr>
              <td>Khe co có thanh truyền lực</td>
              <td>{res.co_thanh}</td>
              <td className="center">Điều 6.2.4</td>
            </tr>
            <tr>
              <td>Khe co không có thanh truyền lực</td>
              <td>{res.co_khong}</td>
              <td className="center">Điều 6.2.4</td>
            </tr>
            <tr>
              <td>Số lần cắt khe</td>
              <td>{res.catlan}</td>
              <td className="center">Điều 6.2.4</td>
            </tr>
            <tr>
              <td>Chiều dài dải đoạn dãn</td>
              <td>{res.dan_kc}</td>
              <td className="center">Điều 6.2.5</td>
            </tr>
          </tbody>
        </table>
      </fieldset>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Kết quả kiểm toán (Điều 8)
// ---------------------------------------------------------------------------
export function TabRigidResult({
  project,
  verification,
  onRun,
}: {
  project: ProjectState;
  verification: RigidVerification;
  onRun: () => void;
}): React.ReactElement {
  return (
    <div className="adm-verify-bottom adm-selectable" data-testid="tab-cung-kiem-toan" style={{ height: '100%' }}>
      <div style={{ padding: '8px 12px' }}>
        <button type="button" className="adm-btn adm-btn-primary" onClick={onRun}>
          Chạy kiểm toán (F5)
        </button>
      </div>
      <RvRigidReport project={project} verification={verification} />
    </div>
  );
}
