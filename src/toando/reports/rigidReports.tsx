import React from 'react';
import type { RigidVerification } from '../engine';
import {
  GAMMA_R_BY_CLASS,
  RIGID_AGGREGATE_OPTIONS,
  RIGID_REGION_OPTIONS,
  RIGID_ROAD_CLASS_OPTIONS,
} from '../engine/rigid';
import type { ProjectState } from '../types/project';

function fmt(n: number | null | undefined, d = 3): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return n.toFixed(d).replace('.', ',');
}

const container: React.CSSProperties = {
  fontFamily: '"Segoe UI", Tahoma, Arial, sans-serif',
  fontSize: '13.5px',
  lineHeight: 1.7,
  color: '#1e293b',
  backgroundColor: '#ffffff',
  padding: '14px 18px',
};
const h2: React.CSSProperties = { margin: '16px 0 6px', fontSize: '15px', fontWeight: 700 };
const h3: React.CSSProperties = { margin: '12px 0 4px', fontSize: '13.5px', fontWeight: 700, textDecoration: 'underline' };
const th: React.CSSProperties = {
  border: '1px solid #cbd5e1',
  padding: '4px 8px',
  background: '#eef2f7',
  textAlign: 'center',
  fontWeight: 700,
};
const tdL: React.CSSProperties = { border: '1px solid #cbd5e1', padding: '3px 8px', textAlign: 'left' };
const tdR: React.CSSProperties = {
  border: '1px solid #cbd5e1',
  padding: '3px 8px',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
};
const tdRef: React.CSSProperties = { ...tdL, color: '#475569', fontSize: '12px', whiteSpace: 'nowrap' };

interface Item {
  label: React.ReactNode;
  sym: React.ReactNode;
  value: string;
  unit?: string;
  ref?: string;
  bold?: boolean;
}

function Table({ items }: { items: Item[] }): React.ReactElement {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', margin: '4px 0 8px', fontSize: '13px' }}>
      <thead>
        <tr>
          <th style={th}>Đại lượng</th>
          <th style={{ ...th, width: 90 }}>Ký hiệu</th>
          <th style={{ ...th, width: 130 }}>Giá trị</th>
          <th style={{ ...th, width: 90 }}>Đơn vị</th>
          <th style={{ ...th, width: 200 }}>Căn cứ</th>
        </tr>
      </thead>
      <tbody>
        {items.map((it, i) => (
          <tr key={i}>
            <td style={tdL}>{it.label}</td>
            <td style={{ ...tdL, textAlign: 'center' }}>{it.sym}</td>
            <td style={{ ...tdR, fontWeight: it.bold ? 700 : 400 }}>{it.value}</td>
            <td style={{ ...tdL, textAlign: 'center' }}>{it.unit ?? ''}</td>
            <td style={tdRef}>{it.ref ?? ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Check({
  title,
  lhsLabel,
  lhs,
  rhsLabel,
  rhs,
  passed,
  passText,
  failText,
  refText,
  testId,
}: {
  title: string;
  lhsLabel: React.ReactNode;
  lhs: number;
  rhsLabel: React.ReactNode;
  rhs: number;
  passed: boolean;
  passText: string;
  failText: string;
  refText: string;
  testId: string;
}): React.ReactElement {
  return (
    <div style={{ margin: '6px 0 10px' }}>
      <div style={{ fontWeight: 600 }}>
        {title} <span style={{ color: '#475569', fontWeight: 400 }}>({refText})</span>
      </div>
      <div style={{ padding: '4px 0 4px 14px', fontFamily: 'Cambria, "Times New Roman", serif', fontSize: '14.5px' }}>
        {lhsLabel} = <strong>{fmt(lhs, 3)}</strong> MPa&nbsp;&nbsp;{passed ? '≤' : '>'}&nbsp;&nbsp;{rhsLabel} ={' '}
        <strong>{fmt(rhs, 3)}</strong> MPa
      </div>
      <div
        data-testid={testId}
        data-passed={passed ? 'true' : 'false'}
        style={{
          display: 'inline-block',
          padding: '6px 12px',
          borderRadius: 6,
          border: `1.5px solid ${passed ? '#16a34a' : '#dc2626'}`,
          background: passed ? '#f0fdf4' : '#fef2f2',
          color: passed ? '#14532d' : '#7f1d1d',
          fontWeight: 700,
        }}
      >
        {passed ? '✓ ' : '✗ '}
        {passed ? passText : failText}
      </div>
    </div>
  );
}

export function RvRigidReport({
  project,
  verification: v,
}: {
  project: ProjectState;
  verification: RigidVerification;
}): React.ReactElement {
  const data = project.rigid;
  const I = v.input;
  const R = v.res;
  const hasBase = I.model === 2 && I.Eb > 0 && I.hb > 0;
  const roadLbl = RIGID_ROAD_CLASS_OPTIONS.find((o) => o.value === data?.roadClass)?.label ?? '';
  const regionLbl = RIGID_REGION_OPTIONS.find((o) => o.value === data?.region)?.label ?? '';
  const aggLbl = RIGID_AGGREGATE_OPTIONS.find((o) => o.value === data?.aggregate)?.label ?? '';
  const gr = data ? GAMMA_R_BY_CLASS[data.roadClass] : undefined;
  const [c1, c2, c3] = v.checks;

  const inputs: Item[] = [
    { label: 'Chiều dày tấm BTXM', sym: <>h<sub>c</sub></>, value: fmt(I.hc, 3), unit: 'm' },
    { label: 'Chiều dài tấm', sym: 'L', value: fmt(I.L, 2), unit: 'm' },
    { label: 'Cường độ kéo uốn thiết kế yêu cầu', sym: <>f<sub>r</sub></>, value: fmt(I.fr, 2), unit: 'MPa', ref: 'Điều 8.2.3' },
    { label: 'Mô đun đàn hồi tấm BTXM', sym: <>E<sub>c</sub></>, value: fmt(I.Ec, 0), unit: 'MPa', ref: 'Bảng 11' },
    { label: 'Hệ số dãn nở nhiệt', sym: <>α<sub>c</sub></>, value: I.ac.toExponential(2).replace('.', ','), unit: '1/°C', ref: 'Bảng 10' },
    { label: 'Gradien nhiệt độ lớn nhất', sym: <>T<sub>g</sub></>, value: fmt(I.Tg, 0), unit: '°C/m', ref: 'Điều 8.2.8' },
    { label: 'Trục tính mỏi tiêu chuẩn', sym: <>P<sub>s</sub></>, value: fmt(I.Ps, 0), unit: 'kN', ref: 'Điều 8.2.6' },
    { label: 'Trục đơn nặng nhất', sym: <>P<sub>m</sub></>, value: fmt(I.Pmax, 0), unit: 'kN', ref: 'Điều 8.2.7' },
    { label: 'Số lần trục tích lũy trên làn xe', sym: <>N<sub>e</sub></>, value: Math.round(I.Ne).toLocaleString('en-US'), unit: 'lần', ref: data?.neAuto ? 'Phụ lục A' : 'Nhập trực tiếp' },
    { label: 'Hệ số triết giảm ứng suất', sym: <>k<sub>r</sub></>, value: fmt(I.kr, 2), ref: 'Điều 8.3.1' },
    { label: 'Hệ số tổng hợp', sym: <>k<sub>c</sub></>, value: fmt(I.kc, 2), ref: 'Điều 8.3.1' },
    { label: 'Hệ số độ tin cậy thiết kế', sym: <>γ<sub>r</sub></>, value: fmt(I.gr, 2), ref: gr ? `Bảng 9 (${gr.min}–${gr.max})` : 'Bảng 9' },
    { label: 'Mô đun đàn hồi chung của nền đất', sym: <>E<sub>0</sub></>, value: fmt(I.E0, 2), unit: 'MPa', ref: data?.e0FromSubgrade ? 'Mục Đất nền' : 'Nhập trực tiếp' },
  ];

  const stress: Item[] = [
    ...(I.layers.some((l) => l.h > 0)
      ? [
          { label: 'Tổng chiều dày các lớp vật liệu hạt', sym: <>h<sub>x</sub></>, value: fmt(R.hx, 3), unit: 'm', ref: 'Công thức (15) — Điều 8.3.2' },
          { label: 'Mô đun đàn hồi tương đương các lớp hạt', sym: <>E<sub>x</sub></>, value: fmt(R.Ex, 2), unit: 'MPa', ref: 'Công thức (13) — Điều 8.3.2' },
          { label: 'Hệ số hồi quy', sym: 'α', value: fmt(R.alpha, 4), ref: 'Công thức (14) — Điều 8.3.2' },
        ]
      : []),
    { label: 'Mô đun đàn hồi tương đương của nền (từ đáy tấm)', sym: <>E<sub>t</sub></>, value: fmt(R.Et, 2), unit: 'MPa', ref: 'Công thức (12) — Điều 8.3.2' },
    { label: 'Độ cứng chịu uốn của tấm BTXM', sym: <>D<sub>c</sub></>, value: fmt(R.Dc, 3), unit: 'MN.m', ref: 'Công thức (11) — Điều 8.3.2' },
    ...(hasBase
      ? [
          { label: 'Độ cứng chịu uốn của lớp móng trên', sym: <>D<sub>b</sub></>, value: fmt(R.Db, 3), unit: 'MN.m', ref: 'Công thức (25) — Điều 8.4.1' },
          { label: 'Bán kính độ cứng tương đối của cả kết cấu', sym: <>r<sub>g</sub></>, value: fmt(R.rg, 4), unit: 'm', ref: 'Công thức (25) — Điều 8.4.1' },
        ]
      : [{ label: 'Bán kính độ cứng tương đối của tấm', sym: 'r', value: fmt(R.r, 4), unit: 'm', ref: 'Công thức (11) — Điều 8.3.2' }]),
    { label: 'Hệ số mỏi', sym: <>k<sub>f</sub></>, value: fmt(R.kf, 4), ref: 'Công thức (16) — Điều 8.3.3' },
    { label: 'Ứng suất do trục tính mỏi Ps (tấm không liên kết 4 cạnh)', sym: <>σ<sub>ps</sub></>, value: fmt(R.sps, 3), unit: 'MPa', ref: hasBase ? 'Công thức (25) — Điều 8.4.1' : 'Công thức (11) — Điều 8.3.2' },
    { label: 'Ứng suất kéo uốn gây mỏi do tải trọng', sym: <>σ<sub>pr</sub></>, value: fmt(R.spr, 3), unit: 'MPa', ref: 'Công thức (10) — Điều 8.3.1', bold: true },
    { label: 'Ứng suất do trục nặng nhất Pm', sym: <>σ<sub>pm</sub></>, value: fmt(R.spm, 3), unit: 'MPa', ref: hasBase ? 'Công thức (25) — Điều 8.4.1' : 'Công thức (11) — Điều 8.3.2' },
    { label: 'Ứng suất kéo uốn lớn nhất do trục nặng nhất', sym: <>σ<sub>pmax</sub></>, value: fmt(R.spmax, 3), unit: 'MPa', ref: 'Công thức (20) — Điều 8.3.5', bold: true },
  ];

  const thermal: Item[] = [
    { label: 'Tham số t = L/(3r)', sym: 't', value: fmt(R.t, 4), ref: 'Công thức (23) — Điều 8.3.6' },
    ...(hasBase
      ? [
          { label: 'Độ cứng tiếp xúc giữa tấm và móng', sym: <>k<sub>n</sub></>, value: fmt(R.kn, 2), unit: 'MPa/m', ref: 'Công thức (28) — Điều 8.4.5' },
          { label: 'Hệ số xét trạng thái tiếp xúc giữa các lớp', sym: <>r<sub>β</sub></>, value: fmt(R.rb, 4), unit: 'm', ref: 'Công thức (28) — Điều 8.4.5' },
          { label: 'Hệ số liên quan đến kết cấu tấm hai lớp', sym: 'ζ', value: fmt(R.zeta, 4), ref: 'Công thức (28) — Điều 8.4.5' },
        ]
      : []),
    { label: 'Hệ số ứng suất uốn vồng', sym: <>C<sub>L</sub></>, value: fmt(R.CL, 4), ref: hasBase ? 'Công thức (28) — Điều 8.4.5' : 'Công thức (23) — Điều 8.3.6' },
    { label: 'Hệ số ứng suất nhiệt độ tổng hợp', sym: <>B<sub>L</sub></>, value: fmt(R.BL, 4), ref: 'Công thức (23) — Điều 8.3.6' },
    { label: 'Ứng suất kéo uốn lớn nhất do gradien nhiệt độ', sym: <>σ<sub>tmax</sub></>, value: fmt(R.stmax, 3), unit: 'MPa', ref: 'Công thức (22) — Điều 8.3.6', bold: true },
    { label: 'Hệ số mỏi nhiệt (lấy giá trị lớn của hai bộ hệ số a, b, c)', sym: <>k<sub>t</sub></>, value: fmt(R.kt, 4), ref: 'Công thức (24) — Điều 8.3.7' },
    { label: 'Ứng suất kéo uốn gây mỏi do gradien nhiệt độ', sym: <>σ<sub>tr</sub></>, value: fmt(R.str, 3), unit: 'MPa', ref: 'Công thức (21) — Điều 8.3.6', bold: true },
    ...(hasBase
      ? [
          { label: 'Ứng suất ở đáy lớp móng trên do trục Ps', sym: <>σ<sub>bps</sub></>, value: fmt(R.sbps, 3), unit: 'MPa', ref: 'Công thức (27) — Điều 8.4.2' },
          { label: 'Ứng suất kéo uốn gây mỏi trong lớp móng trên', sym: <>σ<sub>bpr</sub></>, value: fmt(R.sbpr, 3), unit: 'MPa', ref: 'Công thức (26) — Điều 8.4.2', bold: true },
        ]
      : []),
  ];

  return (
    <div style={container} data-testid="rv-rigid-report">
      <h2 style={{ ...h2, textAlign: 'center', fontSize: '16px' }}>
        KIỂM TOÁN KẾT CẤU MẶT ĐƯỜNG BÊ TÔNG XI MĂNG THÔNG THƯỜNG
        <div style={{ fontSize: '13px', fontWeight: 400 }}>Theo tiêu chuẩn TCCS 39:2022/TCĐBVN</div>
      </h2>
      <div>
        <strong>Công trình:</strong> {project.projectInfo.congTrinh || '—'}
        {project.projectInfo.diaDiem ? ` — ${project.projectInfo.diaDiem}` : ''}
      </div>
      <div>
        <strong>Cấp hạng đường:</strong> {roadLbl} &nbsp;|&nbsp; <strong>Vùng:</strong> {regionLbl} &nbsp;|&nbsp;{' '}
        <strong>Đá cốt liệu:</strong> {aggLbl} &nbsp;|&nbsp; <strong>Mô hình tính:</strong>{' '}
        {I.model === 2 ? 'Mô hình 2 (tấm 2 lớp, Điều 8.4)' : 'Mô hình 1 (tấm 1 lớp, Điều 8.3)'}
      </div>

      <h2 style={h2}>I. Số liệu đầu vào</h2>
      <Table items={inputs} />
      {I.layers.filter((l) => l.h > 0).length > 0 && (
        <table style={{ borderCollapse: 'collapse', margin: '0 0 8px', fontSize: '13px' }}>
          <thead>
            <tr>
              <th style={th}>Lớp vật liệu hạt</th>
              <th style={th}>E<sub>i</sub> (MPa)</th>
              <th style={th}>h<sub>i</sub> (m)</th>
            </tr>
          </thead>
          <tbody>
            {I.layers
              .filter((l) => l.h > 0)
              .map((l, i) => (
                <tr key={i}>
                  <td style={tdL}>{l.name}</td>
                  <td style={tdR}>{fmt(l.E, 0)}</td>
                  <td style={tdR}>{fmt(l.h, 3)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
      {hasBase && (
        <div>
          Lớp móng trên gia cố ({data?.input.matBound}): E<sub>b</sub> = {fmt(I.Eb, 0)} MPa; h<sub>b</sub> = {fmt(I.hb, 3)} m;
          μ<sub>b</sub> = {fmt(I.mub, 2)}; f<sub>br</sub> = {fmt(I.fbr, 2)} MPa.
        </div>
      )}

      {data?.neAuto && (
        <>
          <h2 style={h2}>II. Số trục xe tích lũy N<sub>e</sub> (Phụ lục A)</h2>
          <div>
            k<sub>pi</sub> = (P<sub>i</sub>/P<sub>s</sub>)<sup>16</sup> — Công thức (A.1) · N<sub>s1</sub> =
            ADTT·f<sub>hướng</sub>·f<sub>làn</sub>·(n/3000)·Σ(k<sub>pi</sub>·p<sub>i</sub>) = <strong>{fmt(v.ne.Ns1, 4)}</strong> lần/ngày.làn
            — Công thức (A.2)
          </div>
          <div>
            N<sub>e</sub> = N<sub>s1</sub>·[(1+g<sub>r</sub>)<sup>t</sup> − 1]/g<sub>r</sub>·365·η = <strong>{Math.round(v.ne.Ne).toLocaleString('en-US')}</strong> lần —
            Công thức (A.3)
          </div>
        </>
      )}

      <h2 style={h2}>III. Ứng suất kéo uốn trong tấm BTXM</h2>
      <h3 style={h3}>III.1. Ứng suất do tải trọng xe</h3>
      <Table items={stress} />
      <h3 style={h3}>III.2. Ứng suất do gradien nhiệt độ{hasBase ? ' và trong lớp móng trên' : ''}</h3>
      <Table items={thermal} />

      <h2 style={h2}>IV. Kiểm toán theo các trạng thái giới hạn (Điều 8.2.2)</h2>
      <Check
        title="a. Điều kiện mỏi do tải trọng và gradien nhiệt độ"
        lhsLabel={<>γ<sub>r</sub>(σ<sub>pr</sub> + σ<sub>tr</sub>)</>}
        lhs={c1.lhs}
        rhsLabel={<>f<sub>r</sub></>}
        rhs={c1.rhs}
        passed={c1.passed}
        passText="Tấm BTXM đảm bảo điều kiện mỏi do tải trọng và gradien nhiệt độ."
        failText="Tấm BTXM KHÔNG đảm bảo điều kiện mỏi do tải trọng và gradien nhiệt độ."
        refText="Công thức (6) — Điều 8.2.2"
        testId="rigid-check-fatigue"
      />
      <Check
        title="b. Điều kiện chịu trục đơn nặng nhất và gradien nhiệt độ lớn nhất"
        lhsLabel={<>γ<sub>r</sub>(σ<sub>pmax</sub> + σ<sub>tmax</sub>)</>}
        lhs={c2.lhs}
        rhsLabel={<>f<sub>r</sub></>}
        rhs={c2.rhs}
        passed={c2.passed}
        passText="Tấm BTXM đảm bảo điều kiện chịu trục đơn nặng nhất và gradien nhiệt độ lớn nhất."
        failText="Tấm BTXM KHÔNG đảm bảo điều kiện chịu trục đơn nặng nhất và gradien nhiệt độ lớn nhất."
        refText="Công thức (7) — Điều 8.2.2"
        testId="rigid-check-maxload"
      />
      {c3.applicable && (
        <Check
          title="c. Điều kiện mỏi của lớp móng trên"
          lhsLabel={<>γ<sub>r</sub>·σ<sub>bpr</sub></>}
          lhs={c3.lhs}
          rhsLabel={<>f<sub>br</sub></>}
          rhs={c3.rhs}
          passed={c3.passed}
          passText="Lớp móng trên đảm bảo điều kiện mỏi."
          failText="Lớp móng trên KHÔNG đảm bảo điều kiện mỏi."
          refText="Công thức (8) — Điều 8.2.2"
          testId="rigid-check-base"
        />
      )}
      <div
        data-testid="rigid-overall"
        data-passed={v.allPassed ? 'true' : 'false'}
        style={{
          marginTop: 10,
          padding: '8px 14px',
          borderRadius: 6,
          fontWeight: 700,
          border: `2px solid ${v.allPassed ? '#16a34a' : '#dc2626'}`,
          background: v.allPassed ? '#f0fdf4' : '#fef2f2',
          color: v.allPassed ? '#14532d' : '#7f1d1d',
        }}
      >
        {v.allPassed ? '✓ Kết luận chung: ĐẠT tất cả các điều kiện.' : '✗ Kết luận chung: KHÔNG ĐẠT một số điều kiện.'}
        {v.minHc !== null
          ? ` Chiều dày tấm nhỏ nhất thoả mãn (bước 5 mm): ${fmt(v.minHc, 3)} m.`
          : ' Không tìm được chiều dày tấm ≤ 0,42 m thoả mãn.'}
      </div>

      <h2 style={h2}>V. Cấu tạo khe nối (Điều 6)</h2>
      <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
        <li>Thanh liên kết khe dọc (Bảng 5): {v.joint.tie} mm</li>
        <li>
          Thanh truyền lực khe ngang (Điều 6.2.6): Ø{v.joint.d[1]} mm, dài {v.joint.d[2]} mm, cách {v.joint.d[3]} mm
        </li>
        <li>Chiều sâu cắt khe co giả (Điều 6.2.4): {v.joint.doc_gia}</li>
        <li>Số lần cắt khe: {v.joint.catlan}</li>
      </ul>

      {v.warnings.length > 0 && (
        <>
          <h2 style={h2}>VI. Lưu ý và cảnh báo kỹ thuật</h2>
          <ul style={{ margin: '4px 0 0 18px', padding: 0, color: '#92400e' }}>
            {v.warnings.map((w) => (
              <li key={w}>⚠ {w}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
