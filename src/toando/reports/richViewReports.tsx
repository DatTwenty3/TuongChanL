import React from 'react';
import type {
  AlternativeVerificationResult,
  DeflectionResult,
  DesignKindType,
  DesignObjectType,
  EchCuMethod,
  FlexuralLayerResult,
  ForecastConfig,
  ProjectState,
  RehabCalculationSummary,
  RoadScale,
  ShearTargetResult,
  TrafficSummary,
  TwoLayerReductionResult,
} from '../types/project';
import { EQUATION_ASSETS, type EquationAssetKey } from './equationAssets';

function fmt(val: number | null | undefined, digits = 2): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—';
  return val.toFixed(digits);
}

function fmtNe(ne: number): string {
  if (!Number.isFinite(ne)) return '—';
  if (ne >= 1e6) {
    return `${(ne / 1e6).toFixed(4)} × 10⁶`;
  }
  return ne.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function EqImg({
  asset,
  className,
}: {
  asset: EquationAssetKey;
  className?: string;
}): React.ReactElement {
  const meta = EQUATION_ASSETS[asset];
  return (
    <img
      src={meta.src}
      alt={meta.alt}
      title={meta.alt}
      width={meta.width}
      height={meta.height}
      className={className ? `rv-eq-img ${className}` : 'rv-eq-img'}
      style={{
        verticalAlign: 'middle',
        display: 'inline-block',
        margin: '0 3px',
      }}
    />
  );
}

function ConclusionBanner({
  passed,
  passText,
  failText,
}: {
  passed: boolean;
  passText: string;
  failText: string;
}): React.ReactElement {
  return (
    <div
      className={`rv-conclusion ${passed ? 'rv-pass' : 'rv-fail'}`}
      data-passed={passed ? 'true' : 'false'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginTop: '12px',
        padding: '10px 14px',
        borderRadius: '6px',
        border: `1.5px solid ${passed ? '#16a34a' : '#dc2626'}`,
        backgroundColor: passed ? '#f0fdf4' : '#fef2f2',
        color: passed ? '#14532d' : '#7f1d1d',
        fontWeight: 700,
        fontSize: '14px',
      }}
    >
      <EqImg asset={passed ? 'check' : 'cross'} className="rv-status-badge" />
      <span>{passed ? passText : failText}</span>
    </div>
  );
}

function ReductionMiniTable({
  reduction,
  modulusHeader,
}: {
  reduction: TwoLayerReductionResult;
  modulusHeader: string;
}): React.ReactElement {
  return (
    <table
      className="rv-mini-table"
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        margin: '8px 0 10px 0',
        fontSize: '12.5px',
      }}
    >
      <thead>
        <tr style={{ backgroundColor: '#eef2f7', textAlign: 'center' }}>
          <th style={cellThStyle}>Lớp kết cấu (từ trên xuống)</th>
          <th style={cellThStyle}>{modulusHeader}</th>
          <th style={cellThStyle}>t = E1/E2</th>
          <th style={cellThStyle}>hi (cm)</th>
          <th style={cellThStyle}>k = h1/h2</th>
          <th style={cellThStyle}>Htb (cm)</th>
          <th style={cellThStyle}>E&apos;tb (MPa)</th>
        </tr>
      </thead>
      <tbody>
        {reduction.rows.map((r) => (
          <tr key={`${r.layerOrder}-${r.tenVatLieu}`}>
            <td style={cellTdLeftStyle}>{r.tenVatLieu}</td>
            <td style={cellTdRightStyle}>{fmt(r.E_MPa, 2)}</td>
            <td style={cellTdRightStyle}>{r.t_E1_E2 !== null ? fmt(r.t_E1_E2, 3) : '—'}</td>
            <td style={cellTdRightStyle}>{fmt(r.h_cm, 2)}</td>
            <td style={cellTdRightStyle}>{r.k_h1_h2 !== null ? fmt(r.k_h1_h2, 3) : '—'}</td>
            <td style={cellTdRightStyle}>{fmt(r.Htb_cm, 2)}</td>
            <td style={cellTdRightStyle}>{fmt(r.EtbPrime_MPa, 2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const containerStyle: React.CSSProperties = {
  fontFamily: '"Segoe UI", Tahoma, Arial, sans-serif',
  fontSize: '13.5px',
  lineHeight: 1.75,
  color: '#1e293b',
  backgroundColor: '#ffffff',
  padding: '14px 18px',
  borderRadius: '6px',
  border: '1px solid #cbd5e1',
};

const paraStyle: React.CSSProperties = {
  margin: '6px 0',
};

const cellThStyle: React.CSSProperties = {
  border: '1px solid #cbd5e1',
  padding: '5px 8px',
  fontWeight: 600,
  color: '#0f172a',
};

const cellTdLeftStyle: React.CSSProperties = {
  border: '1px solid #cbd5e1',
  padding: '4px 8px',
  textAlign: 'left',
};

const cellTdRightStyle: React.CSSProperties = {
  border: '1px solid #cbd5e1',
  padding: '4px 8px',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
};

function getEchMethodLabel(method?: EchCuMethod): string {
  switch (method) {
    case 'BENKELMAN':
      return 'Phương pháp Benkelman TCVN 8867';
    case 'DIRECT_FWD':
      return 'Nhập trực tiếp FWD / TCVN 8867';
    case 'LAYER_STACK':
      return 'Quy đổi từ các lớp kết cấu cũ';
    default:
      return 'Xác định theo Chương 10';
  }
}

function isRehabOverlayMode(
  loaiTK?: DesignKindType,
  rehabSummary?: RehabCalculationSummary
): boolean {
  const effectiveKind = rehabSummary?.loaiTK ?? loaiTK;
  return effectiveKind === 'CAI_TAO' && rehabSummary?.strategy !== 'FULL_REBUILD';
}

function RehabWarningCallout({
  title,
  items,
}: {
  title?: string;
  items: string[];
}): React.ReactElement | null {
  const unique = Array.from(new Set(items.filter((x) => x.trim().length > 0)));
  if (unique.length === 0) return null;
  return (
    <div
      className="rv-warning-callout"
      style={{
        margin: '8px 0 10px 0',
        padding: '8px 12px',
        borderRadius: '6px',
        border: '1.5px solid #d97706',
        backgroundColor: '#fffbeb',
        color: '#78350f',
        fontSize: '12.5px',
        lineHeight: 1.55,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: '3px' }}>
        {title ?? 'Cảnh báo & lưu ý kỹ thuật (Chương 10 — TCCS 38:2022/TCĐBVN):'}
      </div>
      <ul style={{ margin: 0, paddingLeft: '18px' }}>
        {unique.map((msg, idx) => (
          <li key={idx}>{msg}</li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================================
// 1. rv_Vong — Độ võng đàn hồi
// ============================================================================

export interface RvVongReportProps {
  deflection: DeflectionResult;
  roadScale: RoadScale;
  subgradeE0: number;
  alternativeName?: string;
  loaiTK?: DesignKindType;
  rehabSummary?: RehabCalculationSummary;
}

export function RvVongReport({
  deflection,
  roadScale,
  subgradeE0,
  alternativeName,
  loaiTK,
  rehabSummary,
}: RvVongReportProps): React.ReactElement {
  const { reduction } = deflection;
  const cmp = deflection.passed ? '≥' : '<';
  const isRehabOverlay = isRehabOverlayMode(loaiTK, rehabSummary);
  const isFullRebuild =
    (rehabSummary?.loaiTK ?? loaiTK) === 'CAI_TAO' && rehabSummary?.strategy === 'FULL_REBUILD';
  const foundationE = deflection.foundationModulus_MPa ?? rehabSummary?.echCu_MPa ?? subgradeE0;
  const hasOverlayLayers = reduction.rows.length > 0 && reduction.H_total_cm > 0;
  const buVenhList = rehabSummary?.excludedBuVenhLayers ?? [];
  const warningItems = [...(rehabSummary?.warnings ?? [])];

  return (
    <div className="rv-report rv-vong" style={containerStyle} data-report="rv_Vong">
      {alternativeName && (
        <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', marginBottom: '6px' }}>
          {isRehabOverlay
            ? `Kiểm tra độ võng đàn hồi kết cấu tăng cường — ${alternativeName}`
            : `Kiểm tra độ võng đàn hồi — ${alternativeName}`}
        </div>
      )}

      {isRehabOverlay && (
        <div
          className="rv-rehab-context"
          style={{
            margin: '6px 0 10px 0',
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid #93c5fd',
            backgroundColor: '#eff6ff',
            color: '#1e3a8a',
            fontSize: '13px',
          }}
        >
          Thiết kế tăng cường, cải tạo áo đường cũ (Chương 10 — TCCS 38:2022/TCĐBVN). Mô đun đàn hồi chung đặc trưng kết cấu áo đường cũ đóng vai trò mô đun nền tương đương dưới lớp tăng cường:{' '}
          E<sub>0</sub>&apos; = E<sub>ch,cũ</sub> = <strong>{fmt(foundationE, 2)}</strong> (MPa) [
          {getEchMethodLabel(rehabSummary?.echMethod)}].
        </div>
      )}

      {isFullRebuild && (
        <div
          className="rv-rehab-context"
          style={{
            margin: '6px 0 10px 0',
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            backgroundColor: '#f8fafc',
            color: '#334155',
            fontSize: '13px',
          }}
        >
          Giải pháp cải tạo toàn bộ kết cấu từ nền trở lên (§10.1.4.3): tính toán trên nền đất E₀ ={' '}
          <strong>{fmt(subgradeE0, 2)}</strong> (MPa) như kết cấu mới.
        </div>
      )}

      {isRehabOverlay && buVenhList.length > 0 && (
        <p style={{ ...paraStyle, fontStyle: 'italic', color: '#475569' }}>
          Ghi chú: Lớp bù vênh (
          {buVenhList.map((l) => `${l.layerName} (${fmt(l.chieuDay_cm, 1)} cm)`).join(', ')}
          ) không được tính vào cường độ chung kết cấu sau tăng cường (theo Điều 10.2.1.2).
        </p>
      )}

      {isRehabOverlay && !hasOverlayLayers ? (
        <p style={paraStyle}>
          Không có lớp tăng cường chịu lực mới (chỉ bố trí lớp bù vênh/bảo vệ), do đó mô đun đàn hồi chung sau tăng cường giữ nguyên theo mặt đường cũ:{' '}
          <EqImg asset="echm" /> = E<sub>ch,cũ</sub> = <strong>{fmt(deflection.Ech_MPa, 2)}</strong> (MPa).
        </p>
      ) : (
        <>
          <p style={paraStyle}>
            Chuyển hệ nhiều lớp thành hệ 2 lớp bằng cách đổi nhiều lớp kết cấu áo đường lần lượt hai lớp một từ dưới lên theo công thức:{' '}
            <EqImg asset="ctEtb" /> ; <EqImg asset="ctHtb" /> ; Trong đó: <EqImg asset="ctK" /> ; <EqImg asset="ctT" />
          </p>

          <p style={paraStyle}>
            Ta có <EqImg asset="ephayTb" /> = <strong>{fmt(reduction.EtbPrime_MPa, 2)}</strong> (MPa),{' '}
            H = <strong>{fmt(reduction.H_total_cm, 2)}</strong> (cm),{' '}
            β = <strong>{fmt(reduction.beta, 4)}</strong> (Tra Bảng 11, TCCS 38:2022/TCĐBVN),{' '}
            <EqImg asset="suyRa" /> <EqImg asset="etb" /> = <strong>{fmt(reduction.Etb_dc_MPa, 2)}</strong> (MPa)
            {reduction.etbCapped
              ? ` (kẹp trần max(Ei) = ${fmt(reduction.maxLayerE_MPa, 2)} MPa theo Bảng 11 Chú thích 2)`
              : ''}
          </p>

          {!deflection.usedFormulaF1 ? (
            <p style={paraStyle}>
              Tra toán đồ Hình 2, với 2 chỉ số: <EqImg asset="hD" /> = <strong>{fmt(deflection.H_over_D, 3)}</strong> ;{' '}
              <EqImg asset="eoE1" /> = <strong>{fmt(deflection.E0_over_Etbdc, 4)}</strong>{' '}
              {isRehabOverlay
                ? `(với E₀' = Ech,cũ = ${fmt(foundationE, 2)} MPa)`
                : `(với E₀ = ${fmt(subgradeE0, 2)} MPa)`}
              . Ta được: <EqImg asset="echmE1" /> = <strong>{fmt(deflection.Ech_over_E1, 4)}</strong>{' '}
              <EqImg asset="suyRa" /> <EqImg asset="echm" /> = <strong>{fmt(deflection.Ech_MPa, 2)}</strong> (MPa)
            </p>
          ) : (
            <p style={paraStyle}>
              Sử dụng Công thức (E.1), Phụ lục E, TCCS 38:2022/TCĐBVN (do H/D = {fmt(deflection.H_over_D, 3)} &gt; 2.0
              {isRehabOverlay ? `, với E₀' = Ech,cũ = ${fmt(foundationE, 2)} MPa` : ''}), ta được:{' '}
              <EqImg asset="echF" /> <EqImg asset="suyRa" /> <EqImg asset="echm" /> = <strong>{fmt(deflection.Ech_MPa, 2)}</strong> (MPa)
            </p>
          )}
        </>
      )}

      {deflection.e0RatioExtrapolated && (
        <p style={{ ...paraStyle, color: '#92400e', fontSize: '12.5px' }}>
          Lưu ý nội suy biên Hình 2: Tỷ số E₀&apos;/E₁ = {fmt(deflection.E0_over_Etbdc, 4)} nằm trong khoảng (0,90; 1,00] vượt cận trên 0,90 của Hình 2; đã nội suy tuyến tính giữa giá trị tại E₀&apos;/E₁ = 0,90 và giới hạn vật lý E<sub>ch</sub>/E₁ = 1,00.
        </p>
      )}

      {isRehabOverlay && rehabSummary?.existingSurfaceAlreadyMeetsEyc && (
        <p style={{ ...paraStyle, color: '#0369a1', fontSize: '12.5px' }}>
          Thông báo: Kết cấu áo đường cũ đã đạt E<sub>ch,cũ</sub> = {fmt(foundationE, 2)} MPa ≥ K<sub>cđ</sub><sup>đv</sup> · E<sub>yc</sub> = {fmt(deflection.Eyc_required_MPa, 2)} MPa.
        </p>
      )}

      <p style={paraStyle}>
        Độ tin cậy thiết kế R = <strong>{fmt(roadScale.doTinCayTK, 2)}</strong>. Tra Bảng 8, TCCS 38:2022/TCĐBVN, ta được:{' '}
        <EqImg asset="kcdDv" /> = <strong>{fmt(deflection.Kcd_dv, 2)}</strong>{' '}
        <EqImg asset="suyRa" /> <EqImg asset="kcdDvEyc" /> = {fmt(deflection.Kcd_dv, 2)} × {fmt(deflection.Eyc_MPa, 2)} ={' '}
        <strong>{fmt(deflection.Eyc_required_MPa, 2)}</strong> (MPa)
      </p>

      <p style={paraStyle}>
        Điều kiện kiểm tra: <EqImg asset="dkVong" /> :{' '}
        <strong>{fmt(deflection.Ech_MPa, 2)}</strong> (MPa) {cmp}{' '}
        <strong>{fmt(deflection.Eyc_required_MPa, 2)}</strong> (MPa)
      </p>

      {isRehabOverlay && <RehabWarningCallout items={warningItems} />}

      <ConclusionBanner
        passed={deflection.passed}
        passText={
          isRehabOverlay
            ? 'Kết cấu tăng cường đảm bảo tiêu chuẩn về độ võng đàn hồi'
            : 'Kết cấu áo đường đảm bảo tiêu chuẩn về độ võng đàn hồi'
        }
        failText={
          isRehabOverlay
            ? 'Kết cấu tăng cường KHÔNG đảm bảo tiêu chuẩn về độ võng đàn hồi'
            : 'Kết cấu áo đường KHÔNG đảm bảo tiêu chuẩn về độ võng đàn hồi'
        }
      />
    </div>
  );
}

// ============================================================================
// 2. rv_Truot — Cắt trượt (per target: Đất nền + mỗi lớp C != 0)
// ============================================================================

export interface RvTruotReportProps {
  target: ShearTargetResult;
  roadScale: RoadScale;
  forecast: ForecastConfig;
  designObject: DesignObjectType;
  traffic?: TrafficSummary;
  showReductionTable?: boolean;
  loaiTK?: DesignKindType;
  rehabSummary?: RehabCalculationSummary;
  showRehabWarnings?: boolean;
}

export function RvTruotReport({
  target,
  roadScale,
  forecast,
  designObject,
  traffic,
  showReductionTable = true,
  loaiTK,
  rehabSummary,
  showRehabWarnings = true,
}: RvTruotReportProps): React.ReactElement {
  const cmp = target.passed ? '≤' : '>';
  const objLabel = designObject === 'LGC' ? 'Kết cấu lề gia cố' : 'Kết cấu áo đường';
  const isRehabOverlay = isRehabOverlayMode(loaiTK, rehabSummary);
  const passText = target.isSubgrade
    ? isRehabOverlay
      ? 'Đất nền cũ đảm bảo điều kiện cân bằng trượt'
      : 'Đất nền đảm bảo điều kiện cân bằng trượt'
    : `Lớp ${target.targetName} đảm bảo điều kiện cân bằng trượt`;
  const failText = target.isSubgrade
    ? isRehabOverlay
      ? 'Đất nền cũ KHÔNG đảm bảo điều kiện cân bằng trượt'
      : 'Đất nền KHÔNG đảm bảo điều kiện cân bằng trượt'
    : `Lớp ${target.targetName} KHÔNG đảm bảo điều kiện cân bằng trượt`;

  const warningItems: string[] = [];
  if (showRehabWarnings && isRehabOverlay) {
    if (rehabSummary?.subgradeShearSkippedReason) {
      warningItems.push(rehabSummary.subgradeShearSkippedReason);
    }
    if (rehabSummary?.warnings) {
      warningItems.push(...rehabSummary.warnings);
    }
  }

  return (
    <div
      className="rv-report rv-truot"
      style={containerStyle}
      data-report="rv_Truot"
      data-target={target.targetId}
    >
      <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', marginBottom: '6px' }}>
        {target.isSubgrade
          ? isRehabOverlay
            ? 'Kiểm tra đất nền cũ (Chương 10):'
            : 'Kiểm tra đất nền:'
          : `Kiểm tra lớp ${target.targetName}:`}
      </div>

      {isRehabOverlay && target.isSubgrade && (
        <p style={{ ...paraStyle, color: '#1e3a8a', backgroundColor: '#eff6ff', padding: '6px 10px', borderRadius: '5px', border: '1px solid #bfdbfe' }}>
          Kiểm tra cắt trượt trong đất nền cũ (theo Điều 10.4.2, Điều 9.2.5.5 &amp; Điều 9.3, tính đổi cả [lớp tăng cường mới + lớp cũ giữ lại] phía trên đất nền):
        </p>
      )}

      {isRehabOverlay && !target.isSubgrade && (
        <p style={{ ...paraStyle, color: '#1e3a8a', backgroundColor: '#eff6ff', padding: '6px 10px', borderRadius: '5px', border: '1px solid #bfdbfe' }}>
          Kiểm tra cắt trượt trong lớp vật liệu kém dính kết (Chương 10 — Điều 10.4.2 &amp; Điều 9.3, trên cơ sở [lớp tăng cường mới + lớp cũ giữ lại] hoặc E<sub>ch,cũ</sub> ={' '}
          {rehabSummary?.echCu_MPa !== undefined ? fmt(rehabSummary.echCu_MPa, 2) : '—'} MPa):
        </p>
      )}

      {warningItems.length > 0 && <RehabWarningCallout items={warningItems} />}

      {target.isSubgrade ? (
        <p style={paraStyle}>
          Chuyển hệ nhiều lớp thành hệ 2 lớp bằng cách đổi nhiều lớp kết cấu áo đường lần lượt hai lớp một từ dưới lên theo công thức:{' '}
          <EqImg asset="ctEtb" /> ; <EqImg asset="ctHtb" /> ; Trong đó: <EqImg asset="ctK" /> ; <EqImg asset="ctT" />
        </p>
      ) : (
        <>
          <p style={paraStyle}>Tính đổi các lớp bên trên về một lớp thể hiện ở bảng sau:</p>
          {showReductionTable && (
            <ReductionMiniTable reduction={target.reductionAbove} modulusHeader="Etr (MPa)" />
          )}
        </>
      )}

      <p style={paraStyle}>
        Ta có <EqImg asset="ephayTb" /> = <strong>{fmt(target.reductionAbove.EtbPrime_MPa, 2)}</strong> (MPa),{' '}
        H = <strong>{fmt(target.H_cm, 2)}</strong> (cm),{' '}
        β = <strong>{fmt(target.reductionAbove.beta, 4)}</strong> (Tra Bảng 11, TCCS 38:2022/TCĐBVN),{' '}
        <EqImg asset="suyRa" /> <EqImg asset="etb" /> = <EqImg asset="e1" /> = <strong>{fmt(target.E1_MPa, 2)}</strong> (MPa)
        {target.reductionAbove.etbCapped
          ? ` (kẹp trần max(Ei) = ${fmt(target.reductionAbove.maxLayerE_MPa, 2)} MPa theo Bảng 11 Chú thích 2)`
          : ''}
      </p>

      {!target.isSubgrade && (
        <p style={paraStyle}>
          Xác định Ech ở trên mặt lớp {target.targetName}:{' '}
          {target.reductionBelow ? (
            <>
              Từ các lớp bên dưới có <EqImg asset="ephayTb" /> = {fmt(target.reductionBelow.EtbPrime_MPa, 2)} (MPa),{' '}
              H = {fmt(target.reductionBelow.H_total_cm, 2)} (cm), β = {fmt(target.reductionBelow.beta, 4)},{' '}
              <EqImg asset="etb" /> = {fmt(target.reductionBelow.Etb_dc_MPa, 2)} (MPa)
              {target.reductionBelow.etbCapped
                ? ` (kẹp trần max(Ei) = ${fmt(target.reductionBelow.maxLayerE_MPa, 2)} MPa theo Bảng 11 Chú thích 2)`
                : ''}
              ,{' '}
            </>
          ) : null}
          ta được <EqImg asset="e2" /> = Ech = <strong>{fmt(target.E2_MPa, 2)}</strong> (MPa)
        </p>
      )}

      <p style={paraStyle}>
        {target.usedToanDo === '3-3' || target.H_over_D > 2.0
          ? 'Tra toán đồ Hình 5 với các tỷ số: '
          : 'Tra toán đồ Hình 4 với các tỷ số: '}
        <EqImg asset="hD" /> = <strong>{fmt(target.H_over_D, 3)}</strong> ;{' '}
        <EqImg asset="e1E2" /> = <strong>{fmt(target.E1_over_E2, 2)}</strong>,{' '}
        φ = <strong>{fmt(target.phi_deg, 2)}</strong> (độ).{' '}
        Ta được: <EqImg asset="taxP" /> = <strong>{fmt(target.tax_over_p, 4)}</strong>{' '}
        (với p = {fmt(forecast.apLucBanh_p_MPa, 2)} MPa){' '}
        <EqImg asset="suyRa" /> <EqImg asset="tax" /> = <strong>{fmt(target.tax_MPa, 4)}</strong> (MPa)
      </p>

      <p style={paraStyle}>
        Tra toán đồ Hình 6 với H = <strong>{fmt(target.H_cm, 2)}</strong> (cm), φ = <strong>{fmt(target.phi_deg, 2)}</strong> (độ),{' '}
        ta được ứng suất cắt hoạt động do trọng lượng bản thân các lớp kết cấu gây ra:{' '}
        <EqImg asset="tav" /> = <strong>{fmt(target.tav_MPa, 4)}</strong> (MPa)
      </p>

      <p style={paraStyle}>
        Lực dính tính toán <EqImg asset="ctt" /> = {fmt(target.C_MPa, 4)} × {fmt(target.k1, 2)} × {fmt(target.k2, 3)} ×{' '}
        {fmt(target.k3, 2)} = <strong>{fmt(target.Ctt_MPa, 4)}</strong> (MPa).{' '}
        Trong đó: {objLabel},{' '}
        {traffic ? `Ntt = ${fmt(traffic.Ntt_trucLanNgDem, 2)} (trục/làn.ngày đêm), ` : ''}
        <EqImg asset="k1" /> = <strong>{fmt(target.k1, 2)}</strong> ;{' '}
        <EqImg asset="k2" /> = <strong>{fmt(target.k2, 3)}</strong> (tra Bảng 12) ;{' '}
        <EqImg asset="k3" /> = <strong>{fmt(target.k3, 2)}</strong>
      </p>

      <p style={paraStyle}>
        Độ tin cậy thiết kế R = <strong>{fmt(roadScale.doTinCayTK, 2)}</strong>. Tra Bảng 8, TCCS 38:2022/TCĐBVN, ta được hệ số cường độ về cắt trượt:{' '}
        K<sub>cđ</sub><sup>tr</sup> = <strong>{fmt(target.Kcd_tr, 2)}</strong>
      </p>

      <p style={paraStyle}>
        Điều kiện kiểm tra: <EqImg asset="dkTruot" /> :{' '}
        <EqImg asset="taxTav" /> = <strong>{fmt(target.tau_total_MPa, 4)}</strong> (MPa) {cmp}{' '}
        <EqImg asset="cttKcdTr" /> = <strong>{fmt(target.tau_allow_MPa, 4)}</strong> (MPa)
      </p>

      <ConclusionBanner passed={target.passed} passText={passText} failText={failText} />
    </div>
  );
}

export interface RvTruotAllReportProps {
  verification: AlternativeVerificationResult;
  project: ProjectState;
  traffic?: TrafficSummary;
  loaiTK?: DesignKindType;
  rehabSummary?: RehabCalculationSummary;
}

export function RvTruotAllReport({
  verification,
  project,
  traffic,
  loaiTK,
  rehabSummary,
}: RvTruotAllReportProps): React.ReactElement {
  const resolvedRehab = rehabSummary ?? verification.rehabSummary;
  const resolvedLoaiTK = loaiTK ?? project.projectInfo.loaiTK;
  const isRehabOverlay = isRehabOverlayMode(resolvedLoaiTK, resolvedRehab);

  const warningItems: string[] = [];
  if (isRehabOverlay) {
    if (resolvedRehab?.subgradeShearSkippedReason) {
      warningItems.push(resolvedRehab.subgradeShearSkippedReason);
    }
    if (resolvedRehab?.warnings) {
      warningItems.push(...resolvedRehab.warnings);
    }
  }

  if (!verification.shearApplicable) {
    const grade = project.designParams.loaiTangMat;
    const isLowGrade = grade === 'B1' || grade === 'B2';
    return (
      <div className="rv-report rv-truot" style={containerStyle} data-report="rv_Truot">
        {isRehabOverlay && <RehabWarningCallout items={warningItems} />}
        <p style={paraStyle}>
          {isLowGrade
            ? `Không yêu cầu kiểm toán cắt trượt đối với tầng mặt cấp thấp ${grade} (theo Điều 9.1.4.3 & 9.3.1, TCCS 38:2022/TCĐBVN).`
            : 'Không yêu cầu kiểm toán cắt trượt (theo TCCS 38:2022/TCĐBVN).'}
        </p>
      </div>
    );
  }

  if (verification.shearTargets.length === 0) {
    return (
      <div className="rv-report rv-truot" style={containerStyle} data-report="rv_Truot">
        {isRehabOverlay && (
          <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', marginBottom: '6px' }}>
            Kiểm tra cắt trượt (Chương 10 — TCCS 38:2022/TCĐBVN):
          </div>
        )}
        <RehabWarningCallout items={warningItems} />
        <p style={paraStyle}>
          {resolvedRehab?.subgradeShearSkippedReason ||
            'Chưa có đối tượng kiểm toán cắt trượt (thiếu thông số chiều dày kết cấu cũ H_cũ hoặc lớp vật liệu kém dính kết).'}
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {isRehabOverlay && warningItems.length > 0 && (
        <div className="rv-report rv-truot-warnings" style={containerStyle}>
          <RehabWarningCallout items={warningItems} />
        </div>
      )}
      {verification.shearTargets.map((target) => (
        <RvTruotReport
          key={target.targetId}
          target={target}
          roadScale={project.roadScale}
          forecast={project.forecast}
          designObject={project.projectInfo.doiTuongTK}
          traffic={traffic}
          loaiTK={resolvedLoaiTK}
          rehabSummary={resolvedRehab}
          showRehabWarnings={false}
        />
      ))}
    </div>
  );
}

// ============================================================================
// 3. rv_KeoUon — Kéo uốn (per monolithic layer)
// ============================================================================

export interface RvKeoUonReportProps {
  layerResult: FlexuralLayerResult;
  roadScale: RoadScale;
  forecast: ForecastConfig;
  traffic: TrafficSummary;
  loaiTK?: DesignKindType;
  rehabSummary?: RehabCalculationSummary;
  showRehabWarnings?: boolean;
}

function getMaterialClassLabel(matClass: FlexuralLayerResult['materialClass']): string {
  switch (matClass) {
    case 'BTN':
      return 'Bê tông nhựa';
    case 'DA_SOI_GC':
      return 'Đá dăm / sỏi cuội gia cố chất kết dính vô cơ';
    case 'DAT_GC':
      return 'Đất / cát gia cố chất kết dính vô cơ';
  }
}

export function RvKeoUonReport({
  layerResult,
  roadScale,
  forecast,
  traffic,
  loaiTK,
  rehabSummary,
  showRehabWarnings = true,
}: RvKeoUonReportProps): React.ReactElement {
  const cmp = layerResult.passed ? '≤' : '>';
  const formulaEq = forecast.namTinhToan === 'NAM_DAU' ? '(A.2)' : '(A.3)';
  const loadLabel =
    forecast.taiTrongTrucTacDung === 'BANH_DON'
      ? 'Cụm bánh đơn (tải trọng trục đặc biệt)'
      : 'Cụm bánh đôi (tải trọng trục tiêu chuẩn)';
  const isRehabOverlay = isRehabOverlayMode(loaiTK, rehabSummary);
  const echCuValue = rehabSummary?.echCu_MPa;
  const warningItems =
    showRehabWarnings && isRehabOverlay && rehabSummary?.warnings ? rehabSummary.warnings : [];

  return (
    <div
      className="rv-report rv-keouon"
      style={containerStyle}
      data-report="rv_KeoUon"
      data-layer={layerResult.layerId}
    >
      <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', marginBottom: '6px' }}>
        Kiểm tra lớp {layerResult.layerName}:
      </div>

      {warningItems.length > 0 && <RehabWarningCallout items={warningItems} />}

      <p style={paraStyle}>
        {isRehabOverlay && !layerResult.reductionBelow ? (
          <>
            Xác định <EqImg asset="echm" /> trên mặt kết cấu áo đường cũ (theo Điều 10.4.2 &amp; 9.4.2):{' '}
            <EqImg asset="echm" /> = E<sub>ch,cũ</sub> = <strong>{fmt(layerResult.Echm_MPa, 2)}</strong> (MPa)
          </>
        ) : isRehabOverlay && layerResult.reductionBelow ? (
          <>
            Quy đổi các lớp phía dưới lớp kiểm tra về hệ 2 lớp{' '}
            {layerResult.layerName.includes('(lớp cũ giữ lại)')
              ? 'trên nền đất E₀ '
              : echCuValue !== undefined
                ? `với nền tương đương E₀' = Ech,cũ = ${fmt(echCuValue, 2)} (MPa) `
                : ''}
            (theo Điều 10.4.2 &amp; 9.4.2):{' '}
            <EqImg asset="ephayTb" /> = <strong>{fmt(layerResult.reductionBelow.EtbPrime_MPa, 2)}</strong> (MPa),{' '}
            H = <strong>{fmt(layerResult.reductionBelow.H_total_cm, 2)}</strong> (cm),{' '}
            β = <strong>{fmt(layerResult.reductionBelow.beta, 4)}</strong>,{' '}
            <EqImg asset="etb" /> = <strong>{fmt(layerResult.reductionBelow.Etb_dc_MPa, 2)}</strong> (MPa)
            {layerResult.reductionBelow.etbCapped
              ? ` (kẹp trần max(Ei) = ${fmt(layerResult.reductionBelow.maxLayerE_MPa, 2)} MPa theo Bảng 11 Chú thích 2)`
              : ''}{' '}
            <EqImg asset="suyRa" /> <EqImg asset="echm" /> = <strong>{fmt(layerResult.Echm_MPa, 2)}</strong> (MPa)
          </>
        ) : layerResult.reductionBelow ? (
          <>
            Xác định <EqImg asset="echm" /> ở trên mặt lớp {layerResult.layerName}:{' '}
            Chuyển hệ nhiều lớp phía dưới lớp kiểm tra thành hệ 2 lớp theo công thức:{' '}
            <EqImg asset="ctEtb" /> ; <EqImg asset="ctHtb" /> ; Trong đó: <EqImg asset="ctK" /> ; <EqImg asset="ctT" />.{' '}
            Xét các lớp phía dưới lớp kiểm tra, ta có <EqImg asset="ephayTb" /> ={' '}
            <strong>{fmt(layerResult.reductionBelow.EtbPrime_MPa, 2)}</strong> (MPa),{' '}
            H = <strong>{fmt(layerResult.reductionBelow.H_total_cm, 2)}</strong> (cm),{' '}
            β = <strong>{fmt(layerResult.reductionBelow.beta, 4)}</strong>,{' '}
            <EqImg asset="etb" /> = <strong>{fmt(layerResult.reductionBelow.Etb_dc_MPa, 2)}</strong> (MPa)
            {layerResult.reductionBelow.etbCapped
              ? ` (kẹp trần max(Ei) = ${fmt(layerResult.reductionBelow.maxLayerE_MPa, 2)} MPa theo Bảng 11 Chú thích 2)`
              : ''}{' '}
            <EqImg asset="suyRa" /> <EqImg asset="echm" /> = <strong>{fmt(layerResult.Echm_MPa, 2)}</strong> (MPa)
          </>
        ) : (
          <>
            Xác định <EqImg asset="echm" /> ở trên mặt lớp {layerResult.layerName}:{' '}
            Xét phía dưới lớp kiểm tra là đất nền, ta có <EqImg asset="echm" /> = E₀ ={' '}
            <strong>{fmt(layerResult.Echm_MPa, 2)}</strong> (MPa)
          </>
        )}
      </p>

      <p style={paraStyle}>
        {layerResult.isSurfaceLayer ? (
          <>
            Tra toán đồ Hình 7 với các thông số sau: <EqImg asset="hD" /> ={' '}
            <strong>{fmt(layerResult.H_over_D, 3)}</strong> ; <EqImg asset="e1Echm" /> ={' '}
            <strong>{fmt(layerResult.ratio1, 3)}</strong>
          </>
        ) : (
          <>
            Tra toán đồ Hình 8 với các thông số sau: <EqImg asset="hD" /> ={' '}
            <strong>{fmt(layerResult.H_over_D, 3)}</strong> ; <EqImg asset="e1E2" /> ={' '}
            <strong>{fmt(layerResult.ratio1, 3)}</strong> ; <EqImg asset="e2E3" /> ={' '}
            <strong>{fmt(layerResult.ratio2, 3)}</strong>
          </>
        )}
        {layerResult.usedAnalyticalFallback ? ' (dùng công thức giải tích Phụ lục E)' : ''}.{' '}
        Tra được ứng suất kéo uốn đơn vị: σ̄<sub>ku</sub> = <strong>{fmt(layerResult.sigma_ku_bar, 4)}</strong>
      </p>

      <p style={paraStyle}>
        Tải trọng tác dụng là: {loadLabel}. Với p = <strong>{fmt(layerResult.p_MPa, 2)}</strong> (MPa),{' '}
        <EqImg asset="kb" /> = <strong>{fmt(layerResult.kb, 2)}</strong>. Do đó, ứng suất kéo uốn lớn nhất phát sinh ở đáy lớp{' '}
        {layerResult.layerName}: <EqImg asset="sigmaKu" /> = <strong>{fmt(layerResult.sigma_ku_MPa, 3)}</strong> (MPa)
      </p>

      <p style={paraStyle}>
        Số trục xe tiêu chuẩn tích lũy trong suốt thời hạn thiết kế (dùng Công thức {formulaEq}, Phụ lục A):{' '}
        N<sub>e</sub> = <strong>{fmtNe(traffic.Ne_truc)}</strong> (Trục).{' '}
        Vật liệu kiểm tra là {getMaterialClassLabel(layerResult.materialClass)}, vậy hệ số{' '}
        <EqImg asset="k1" /> = <strong>{fmt(layerResult.k1, 4)}</strong> ;{' '}
        <EqImg asset="k2" /> = <strong>{fmt(layerResult.k2, 2)}</strong>.{' '}
        Cường độ chịu kéo uốn tính toán của lớp {layerResult.layerName}:{' '}
        <EqImg asset="rttKu" /> = {fmt(layerResult.k1, 4)} × {fmt(layerResult.k2, 2)} × {fmt(layerResult.Rku_MPa, 2)} ={' '}
        <strong>{fmt(layerResult.Rtt_ku_MPa, 3)}</strong> (MPa)
      </p>

      <p style={paraStyle}>
        Độ tin cậy thiết kế R = <strong>{fmt(roadScale.doTinCayTK, 2)}</strong>. Tra Bảng 8, TCCS 38:2022/TCĐBVN, hệ số cường độ về chịu kéo uốn:{' '}
        <EqImg asset="kcdKu" /> = <strong>{fmt(layerResult.Kcd_ku, 2)}</strong>
      </p>

      <p style={paraStyle}>
        Điều kiện kiểm tra: <EqImg asset="dkKeoUon" /> :{' '}
        <EqImg asset="sigmaKuAlone" /> = <strong>{fmt(layerResult.sigma_ku_MPa, 3)}</strong> (MPa) {cmp}{' '}
        <EqImg asset="rkuKcdKu" /> = <strong>{fmt(layerResult.R_allow_MPa, 3)}</strong> (MPa)
      </p>

      <ConclusionBanner
        passed={layerResult.passed}
        passText={`Lớp ${layerResult.layerName} đảm bảo tiêu chuẩn chịu kéo uốn`}
        failText={`Lớp ${layerResult.layerName} KHÔNG đảm bảo tiêu chuẩn chịu kéo uốn`}
      />
    </div>
  );
}

export interface RvKeoUonAllReportProps {
  verification: AlternativeVerificationResult;
  project: ProjectState;
  traffic: TrafficSummary;
  loaiTK?: DesignKindType;
  rehabSummary?: RehabCalculationSummary;
}

export function RvKeoUonAllReport({
  verification,
  project,
  traffic,
  loaiTK,
  rehabSummary,
}: RvKeoUonAllReportProps): React.ReactElement {
  const resolvedRehab = rehabSummary ?? verification.rehabSummary;
  const resolvedLoaiTK = loaiTK ?? project.projectInfo.loaiTK;
  const isRehabOverlay = isRehabOverlayMode(resolvedLoaiTK, resolvedRehab);
  const warningItems = isRehabOverlay && resolvedRehab?.warnings ? resolvedRehab.warnings : [];

  if (!verification.flexuralApplicable || verification.flexuralLayers.length === 0) {
    const grade = project.designParams.loaiTangMat;
    const isLowGrade = grade === 'B1' || grade === 'B2';
    return (
      <div className="rv-report rv-keouon" style={containerStyle} data-report="rv_KeoUon">
        {isRehabOverlay && <RehabWarningCallout items={warningItems} />}
        <p style={paraStyle}>
          {isLowGrade
            ? `Không yêu cầu kiểm toán chịu kéo uốn đối với tầng mặt cấp thấp ${grade} (theo Điều 9.1.4.3 & 9.4.1, TCCS 38:2022/TCĐBVN).`
            : 'Không có lớp vật liệu liền khối cần kiểm toán chịu kéo uốn (theo Điều 9.4.1, TCCS 38:2022/TCĐBVN).'}
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {isRehabOverlay && warningItems.length > 0 && (
        <div className="rv-report rv-keouon-warnings" style={containerStyle}>
          <RehabWarningCallout items={warningItems} />
        </div>
      )}
      {verification.flexuralLayers.map((layerResult) => (
        <RvKeoUonReport
          key={layerResult.layerId}
          layerResult={layerResult}
          roadScale={project.roadScale}
          forecast={project.forecast}
          traffic={traffic}
          loaiTK={resolvedLoaiTK}
          rehabSummary={resolvedRehab}
          showRehabWarnings={false}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Pure HTML / Plain-Text Report Builders (for standalone export/testing)
// ============================================================================

export function buildRvVongSummaryText(
  deflection: DeflectionResult,
  rehabSummary?: RehabCalculationSummary
): string {
  const cmp = deflection.passed ? '≥' : '<';
  const isRehabOverlay = isRehabOverlayMode(undefined, rehabSummary);
  const conclusion = isRehabOverlay
    ? deflection.passed
      ? 'Kết cấu tăng cường đảm bảo tiêu chuẩn về độ võng đàn hồi'
      : 'Kết cấu tăng cường KHÔNG đảm bảo tiêu chuẩn về độ võng đàn hồi'
    : deflection.passed
      ? 'Kết cấu áo đường đảm bảo tiêu chuẩn về độ võng đàn hồi'
      : 'Kết cấu áo đường KHÔNG đảm bảo tiêu chuẩn về độ võng đàn hồi';
  const capNote = deflection.reduction.etbCapped
    ? ` (kẹp trần max(Ei) = ${fmt(deflection.reduction.maxLayerE_MPa, 2)} MPa theo Bảng 11 Chú thích 2)`
    : '';
  const lines: string[] = [];
  if (isRehabOverlay) {
    const fE = deflection.foundationModulus_MPa ?? rehabSummary?.echCu_MPa;
    lines.push(
      `Chương 10 (${getEchMethodLabel(rehabSummary?.echMethod)}): E0' = Ech,cũ = ${fmt(fE, 2)} MPa`
    );
  }
  lines.push(
    `E'tb = ${fmt(deflection.reduction.EtbPrime_MPa, 2)} MPa, H = ${fmt(deflection.reduction.H_total_cm, 2)} cm, β = ${fmt(deflection.reduction.beta, 4)}, Etb^đc = ${fmt(deflection.reduction.Etb_dc_MPa, 2)} MPa${capNote}`,
    `Ech.m = ${fmt(deflection.Ech_MPa, 2)} MPa ${cmp} Kcd^đv * Eyc = ${fmt(deflection.Eyc_required_MPa, 2)} MPa`,
    conclusion
  );
  return lines.join('\n');
}

export function buildRvTruotSummaryText(
  target: ShearTargetResult,
  rehabSummary?: RehabCalculationSummary
): string {
  const cmp = target.passed ? '≤' : '>';
  const isRehabOverlay = isRehabOverlayMode(undefined, rehabSummary);
  const conclusion = target.isSubgrade
    ? target.passed
      ? isRehabOverlay
        ? 'Đất nền cũ đảm bảo điều kiện cân bằng trượt'
        : 'Đất nền đảm bảo điều kiện cân bằng trượt'
      : isRehabOverlay
        ? 'Đất nền cũ KHÔNG đảm bảo điều kiện cân bằng trượt'
        : 'Đất nền KHÔNG đảm bảo điều kiện cân bằng trượt'
    : target.passed
      ? `Lớp ${target.targetName} đảm bảo điều kiện cân bằng trượt`
      : `Lớp ${target.targetName} KHÔNG đảm bảo điều kiện cân bằng trượt`;
  return [
    `${target.targetName}: E1 = ${fmt(target.E1_MPa, 2)} MPa, E2 = ${fmt(target.E2_MPa, 2)} MPa, H/D = ${fmt(target.H_over_D, 3)}`,
    `τax = ${fmt(target.tax_MPa, 4)} MPa, τav = ${fmt(target.tav_MPa, 4)} MPa, Ctt = ${fmt(target.Ctt_MPa, 4)} MPa`,
    `τax + τav = ${fmt(target.tau_total_MPa, 4)} MPa ${cmp} Ctt/Kcd^tr = ${fmt(target.tau_allow_MPa, 4)} MPa`,
    conclusion,
  ].join('\n');
}

export function buildRvKeoUonSummaryText(
  layerResult: FlexuralLayerResult,
  rehabSummary?: RehabCalculationSummary
): string {
  const cmp = layerResult.passed ? '≤' : '>';
  const isRehabOverlay = isRehabOverlayMode(undefined, rehabSummary);
  const conclusion = layerResult.passed
    ? `Lớp ${layerResult.layerName} đảm bảo tiêu chuẩn chịu kéo uốn`
    : `Lớp ${layerResult.layerName} KHÔNG đảm bảo tiêu chuẩn chịu kéo uốn`;
  const contextNote =
    isRehabOverlay && !layerResult.reductionBelow
      ? ' (trực tiếp trên mặt đường cũ Ech,cũ)'
      : '';
  return [
    `Lớp ${layerResult.layerName}: Ech.m = ${fmt(layerResult.Echm_MPa, 2)} MPa${contextNote}, σ̄ku = ${fmt(layerResult.sigma_ku_bar, 4)}`,
    `σku = ${fmt(layerResult.sigma_ku_MPa, 3)} MPa ${cmp} Rtt^ku/Kcd^ku = ${fmt(layerResult.R_allow_MPa, 3)} MPa`,
    conclusion,
  ].join('\n');
}
