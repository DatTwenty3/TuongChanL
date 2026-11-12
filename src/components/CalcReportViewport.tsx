import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CFE,
  calcFeStale,
  getFeCache,
  isCalcValid,
  pileOn,
  cuOn,
  lunOn,
  setCalcDec as setEngineCalcDec,
  type EngineProject,
} from '../engine';
import {
  FE_KLAB,
  FE_VIEWS,
  calcGsView,
  calcPileSheetHtml,
  calcCuSheetHtml,
  calcLunSheetHtml,
  calcRbView,
  calcSheetHTML,
  cfFeContour,
  cfFeReact,
  cfFeRibDiag,
  cfFeSecPos,
  feElemInfo,
  feMVNTable,
  feSecNo,
  feStripTables,
  setCalcDec as setReportDec,
  type FeInteractiveState,
  type FeReportResult,
} from '../reports';
import { useAppStore } from '../state/appStore';
import { Glyphs } from './Icon';
import { formatGsStatusText } from './SidebarCalcPanel';

const FeViewPanel: React.FC<{ project: EngineProject; result: FeReportResult }> = ({
  project,
  result,
}) => {
  const { feViewState: feV, setFeViewState: setFeV } = useAppStore();

  const dec = project.calc?.dec === ',' ? ',' : '.';
  setReportDec(dec);
  setEngineCalcDec(dec);

  const fe = result.fe!;
  const M = fe.M!;
  const ribbed = !M.strip;
  const hasEq = Boolean(result.E);

  const kopts = useMemo<Array<[string, string]>>(
    () => [
      ['bao', 'Cường độ I (bao)'],
      ['Ia', 'Cường độ I-a'],
      ['Ib', 'Cường độ I-b'],
      ['Ic', 'Cường độ I-c'],
      ['SD', 'Sử dụng I'],
      ...(hasEq
        ? ([
            ['baoE', 'Đặc biệt (bao)'],
            ['Ea', 'Đặc biệt I-a'],
            ['Eb', 'Đặc biệt I-b'],
          ] as Array<[string, string]>)
        : []),
    ],
    [hasEq],
  );

  const activeK = kopts.some((o) => o[0] === feV.k) ? feV.k : 'bao';

  const qopts = useMemo(
    () =>
      (Object.keys(CFE.FQ) as Array<keyof typeof CFE.FQ>).map((q) => [
        q,
        `${CFE.FQ[q].t} (${CFE.FQ[q].u})`,
      ]),
    [],
  );

  const contourSvg = useMemo(() => {
    setReportDec(dec);
    setEngineCalcDec(dec);
    return cfFeContour(result, {
      q: feV.q,
      k: activeK,
      az: feV.az,
      el: feV.el,
      ribs: feV.ribs,
      data: true,
      W: 780,
    });
  }, [dec, result, feV.q, activeK, feV.az, feV.el, feV.ribs]);

  const vals = useMemo(
    () => CFE.fieldOf(fe, activeK, feV.q as keyof typeof CFE.FQ),
    [fe, activeK, feV.q],
  );

  const defaultInfo = ribbed
    ? 'Rê chuột lên một phần tử để xem nội lực của phần tử đó.'
    : 'Giá trị của từng phần tử ghi ở các bảng bên dưới.';

  const [hoveredInfoHtml, setHoveredInfoHtml] = useState<string>(defaultInfo);
  const figBoxRef = useRef<HTMLDivElement | null>(null);
  const hotElemRef = useRef<Element | null>(null);

  useEffect(() => {
    hotElemRef.current = null;
    setHoveredInfoHtml(defaultInfo);
  }, [contourSvg, defaultInfo]);

  const extraHtml = useMemo(() => {
    setReportDec(dec);
    setEngineCalcDec(dec);
    let h = '';
    if (ribbed) {
      h += `<h4>Nội lực của sườn dọc chiều cao</h4><div class="figw">${cfFeRibDiag(result)}</div>`;
    }
    h += `<h4>Phản lực nền – ${FE_KLAB[activeK] ?? activeK}</h4><div class="figw">${cfFeReact(result, activeK)}</div>`;
    const secNotes = fe.sec
      ? fe.sec.map((s) => `${feSecNo(s.id)}: ${s.name}`).join(' · ')
      : '';
    h += `<h4>Tổng hợp nội lực M, V, N tại các mặt cắt kiểm tra</h4><div class="csheet feT"><div class="figw">${cfFeSecPos(result)}</div>${feMVNTable(result)}${secNotes ? `<p class="small">${secNotes}</p>` : ''}</div>`;
    if (!ribbed) {
      h += `<h4>Giá trị nội lực của từng phần tử – ${FE_KLAB[activeK] ?? activeK}</h4><div class="csheet feT">${feStripTables(result, activeK)}</div>`;
    }
    return h;
  }, [dec, ribbed, result, activeK, fe.sec]);

  return (
    <div className="feview">
      <div className="fetool">
        <label className="fe-c">
          <span>Đại lượng</span>
          <select
            value={feV.q}
            onChange={(e) => setFeV((v) => ({ ...v, q: e.target.value }))}
          >
            {qopts.map(([val, lab]) => (
              <option key={val} value={val}>
                {lab}
              </option>
            ))}
          </select>
        </label>
        <label className="fe-c">
          <span>Tổ hợp</span>
          <select
            value={activeK}
            onChange={(e) => setFeV((v) => ({ ...v, k: e.target.value }))}
          >
            {kopts.map(([val, lab]) => (
              <option key={val} value={val}>
                {lab}
              </option>
            ))}
          </select>
        </label>
        {ribbed ? (
          <label className="fe-c">
            <span>Sườn</span>
            <select
              value={feV.ribs}
              onChange={(e) =>
                setFeV((v) => ({ ...v, ribs: e.target.value as FeInteractiveState['ribs'] }))
              }
            >
              <option value="grey">Màu xám</option>
              <option value="color">Tô màu nội lực</option>
              <option value="hide">Ẩn sườn</option>
            </select>
          </label>
        ) : null}
      </div>

      {ribbed ? (
        <div className="fetool">
          <span className="fe-l">Góc nhìn</span>
          {FE_VIEWS.map(([label, az, el]) => (
            <button
              key={label}
              type="button"
              onClick={() => setFeV((v) => ({ ...v, az, el }))}
            >
              {label}
            </button>
          ))}
          <label className="fe-c sl">
            <span>Xoay</span>
            <input
              type="range"
              min={0}
              max={360}
              step={1}
              value={feV.az}
              onChange={(e) => setFeV((v) => ({ ...v, az: Number(e.target.value) }))}
            />
            <i>{Math.round(feV.az)}°</i>
          </label>
          <label className="fe-c sl">
            <span>Nghiêng</span>
            <input
              type="range"
              min={0}
              max={90}
              step={1}
              value={feV.el}
              onChange={(e) => setFeV((v) => ({ ...v, el: Number(e.target.value) }))}
            />
            <i>{Math.round(feV.el)}°</i>
          </label>
        </div>
      ) : null}

      <div
        ref={figBoxRef}
        className="fefig"
        dangerouslySetInnerHTML={{ __html: contourSvg }}
        onMouseMove={(evt) => {
          const target = evt.target as Element | null;
          const eAttr = target?.getAttribute ? target.getAttribute('data-e') : null;
          if (eAttr == null || !vals || !target) return;
          if (hotElemRef.current && hotElemRef.current !== target) {
            hotElemRef.current.removeAttribute('stroke');
            hotElemRef.current.removeAttribute('stroke-width');
          }
          target.setAttribute('stroke', '#000');
          target.setAttribute('stroke-width', '1.6');
          hotElemRef.current = target;
          setReportDec(dec);
          setEngineCalcDec(dec);
          setHoveredInfoHtml(feElemInfo(result, Number(eAttr), vals, { k: activeK, q: feV.q }));
        }}
      />

      <div className="feinfo" dangerouslySetInnerHTML={{ __html: hoveredInfoHtml }} />

      <p className="fenote">
        Trục 1 của tấm: thân và sườn – phương đứng, bản đáy – phương x (mũi → gót); trục 2:
        phương còn lại trong mặt phẳng tấm (thân, bản đáy – dọc tường; sườn – ngang). M dương:
        căng mặt sau thân (phía đất đắp) / thớ dưới bản đáy. N dương: kéo. Tổ hợp &quot;bao&quot;: ở
        mỗi phần tử lấy giá trị có trị tuyệt đối lớn nhất của các tổ hợp thành phần.
      </p>

      <div className="feextra" dangerouslySetInnerHTML={{ __html: extraHtml }} />
    </div>
  );
};

export const CalcReportViewport: React.FC = () => {
  const {
    project,
    viewMode,
    calcSub,
    setCalcSub,
    calcResult,
    feRev,
    gsRev,
    femRev,
    gsBusy,
    runGsNow,
  } = useAppStore();

  void feRev;
  void gsRev;
  void femRev;

  const hostRef = useRef<HTMLDivElement | null>(null);

  const feOn = Boolean(project.calc?.feOn);
  const pileShown = pileOn(project);
  const cuShown = cuOn(project);
  const lunShown = lunOn(project);
  const activeSub =
    (!feOn && calcSub === 'fe') || (!pileShown && calcSub === 'pile') || (!cuShown && calcSub === 'cu') || (!lunShown && calcSub === 'lun')
      ? 'sheet'
      : calcSub;

  const helperTexts: Record<string, string> = {
    sheet: 'Bảng tính kiểm toán đầy đủ (in, xuất Word)',
    gs: 'Hệ số an toàn trượt, lật, cung trượt Bishop; bản đồ áp lực nước lỗ rỗng, vùng chảy dẻo, chuyển vị và lưới biến dạng',
    rb: 'Sơ đồ bố trí cốt thép có mác, bảng thống kê chi tiết cho 1 m dài tường, kết luận',
    fe: 'M, V, N của từng phần tử thân – bản đáy – sườn, theo tổ hợp',
    pile: 'Sức chịu tải cọc, phản lực đầu cọc theo tổ hợp, kiểm tra theo TCVN 10304:2025',
    cu: 'Sức chịu tải khối móng cừ tràm, từng cây cừ, số cây cần trên 1 m², đất dưới mũi cừ',
    lun: 'Lún cố kết theo phân tầng lấy tổng (Cc, Cr, Pc), tổng lún S = m·Sc, dự báo lún theo thời gian',
  };

  const valid = isCalcValid(calcResult);
  const feSolve = valid ? calcResult.fe : undefined;
  const feErrMsg =
    (feSolve && 'err' in feSolve ? (feSolve as { err?: string }).err : undefined) ||
    (() => {
      const f = getFeCache().fe;
      return f && 'err' in f ? (f as { err?: string }).err : undefined;
    })();
  const feOk = Boolean(
    valid && feSolve && !(feSolve as { err?: string }).err && feSolve.res,
  );

  const reportHtml = useMemo(() => {
    const dec = project.calc?.dec === ',' ? ',' : '.';
    setReportDec(dec);
    setEngineCalcDec(dec);
    if (activeSub === 'fe') return '';
    if (activeSub === 'pile') return calcPileSheetHtml(project, calcResult);
    if (activeSub === 'cu') return calcCuSheetHtml(project, calcResult);
    if (activeSub === 'lun') return calcLunSheetHtml(project, calcResult);
    if (activeSub === 'gs' && valid && calcResult.g) {
      return calcGsView(project, calcResult);
    }
    if (activeSub === 'rb' && valid && calcResult.g) {
      return calcRbView(project, calcResult);
    }
    return calcSheetHTML(project, calcResult);
  }, [activeSub, valid, project, calcResult, feRev, gsRev, femRev]);

  return (
    <div id="calcv" ref={hostRef} hidden={viewMode !== 'calc'}>
      <div className="csub">
        <button
          type="button"
          className={activeSub === 'sheet' ? 'on' : undefined}
          onClick={() => setCalcSub('sheet')}
        >
          Bảng tính
        </button>
        <button
          type="button"
          className={activeSub === 'gs' ? 'on' : undefined}
          onClick={() => setCalcSub('gs')}
        >
          Ổn định tổng thể
        </button>
        <button
          type="button"
          className={activeSub === 'rb' ? 'on' : undefined}
          onClick={() => setCalcSub('rb')}
        >
          Bố trí thép
        </button>
        {pileShown ? (
          <button
            type="button"
            className={activeSub === 'pile' ? 'on' : undefined}
            onClick={() => setCalcSub('pile')}
          >
            Móng cọc
          </button>
        ) : null}
        {cuShown ? (
          <button
            type="button"
            className={activeSub === 'cu' ? 'on' : undefined}
            onClick={() => setCalcSub('cu')}
          >
            Cừ tràm
          </button>
        ) : null}
        {lunShown ? (
          <button
            type="button"
            className={activeSub === 'lun' ? 'on' : undefined}
            onClick={() => setCalcSub('lun')}
          >
            Lún
          </button>
        ) : null}
        {feOn ? (
          <button
            type="button"
            className={activeSub === 'fe' ? 'on' : undefined}
            onClick={() => setCalcSub('fe')}
          >
            Nội lực mô hình tấm (xem)
          </button>
        ) : null}

        {activeSub === 'gs' ? (
          <>
            <button
              type="button"
              className="go gsRun"
              disabled={gsBusy}
              title="Tính lại ngay thấm 2D + cung trượt Bishop (và FEM 2D nếu chưa có kết quả mới) – bình thường tự tính khi số liệu đứng yên"
              onClick={() => runGsNow(false)}
            >
              {gsBusy ? 'Đang tính…' : 'Tính lại'}
            </button>
            <span className="gsStat">
              <Glyphs text={formatGsStatusText(project, gsBusy)} />
            </span>
          </>
        ) : (
          <span>{helperTexts[activeSub] ?? ''}</span>
        )}
      </div>

      {activeSub === 'fe' ? (
        feOk && valid ? (
          <FeViewPanel project={project} result={calcResult as FeReportResult} />
        ) : (
          <div className="feview">
            <p className="feinfo">
              {calcFeStale(project)
                ? '… Mô hình FE đang tính lại, kết quả sẽ hiện sau giây lát.'
                : 'Chưa có kết quả mô hình FE' + (feErrMsg ? `: ${feErrMsg}` : '.')}
            </p>
          </div>
        )
      ) : (
        <div className="csheet" dangerouslySetInnerHTML={{ __html: reportHtml }} />
      )}
    </div>
  );
};
