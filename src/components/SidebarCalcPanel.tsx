import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  DIAS,
  ancKey,
  ancOn,
  blindT,
  calcEnsure,
  calcFeStale,
  calcFemCanAuto,
  calcFemOut,
  calcFemStale,
  calcGsOut,
  calcGsRows,
  calcGsStale,
  calcRebarMap,
  calcRun,
  calcSuggest,
  calcTipLive,
  fmt,
  fmt2,
  geom,
  getFeCache,
  getFemCache,
  isCalcValid,
  isD,
  ribPathsOf,
  type CalcRunResult,
  type EngineProject,
  type EngineSuggestItem,
} from '../engine';
import { getProjectPath, useAppStore } from '../state/appStore';
import { Glyphs, Sym } from './Icon';
import { PilePanel } from './PilePanel';
import {
  AccTitle,
  ChkField,
  DateField,
  NumField,
  QuickHRow,
  SciField,
  SelField,
  TxtField,
} from './FieldControls';

const CalcAccordion: React.FC<{
  id: string;
  title: string;
  initialOpen?: boolean;
  children: React.ReactNode;
}> = ({ id, title, initialOpen = false, children }) => {
  const { calcAccordions, setCalcAccordion } = useAppStore();
  const open = calcAccordions[id] ?? initialOpen;

  return (
    <details
      open={open}
      onToggle={(e) => {
        const next = e.currentTarget.open;
        if (next !== open) setCalcAccordion(id, next);
      }}
    >
      <summary>
        <AccTitle title={title} />
      </summary>
      <div className="body">{children}</div>
    </details>
  );
};

function calcRbList(
  P: EngineProject,
): Array<[id: string, nm: string, path: string, kind?: 'n']> {
  if (P.type === 'rib') {
    const ph = ribPathsOf(P);
    const C = P.tpl === 'C';
    const D = P.tpl === 'D';
    const candidates: Array<[string, string, string | null, 'n'?]> = [
      ['h1', 'Bản mặt – thép ngang (chịu uốn giữa các sườn)', ph.h1],
      ['s1', 'Bản mặt – thép đứng mặt sau', ph.s1],
      ['s2', 'Bản mặt – thép đứng mặt trước', ph.s2],
      ['b1', C ? 'Bản đáy – thép ngang (2 lớp)' : 'Bản đáy – lớp dưới (mũi)', ph.b1],
      ...(C
        ? ([] as Array<[string, string, string | null, 'n'?]>)
        : ([
            ['b2', 'Bản đáy – lớp trên (vuông góc mặt tường)', ph.b2],
          ] as Array<[string, string, string | null, 'n'?]>)),
      ['l1', 'Bản đáy – thép dọc tường (gót giữa các sườn)', ph.l1],
      D
        ? ['r1', 'Sườn – thép xiên (Φ, khoảng cách các đường)', ph.r1]
        : ['r1', 'Sườn – thép chủ (số thanh mỗi nhóm)', ph.r1, 'n'],
      ['r2', 'Sườn – thép ngang (giằng, đai chịu cắt)', ph.r2],
      ['r3', 'Sườn – thép đứng (treo bản đáy)', ph.r3],
    ];
    return candidates
      .filter((row): row is [string, string, string, 'n'?] => typeof row[2] === 'string' && row[2].length > 0);
  }
  const rm = calcRebarMap(P);
  return [
    ['s1', 'Thân tường – thép đứng mặt sau (chịu kéo)', rm.path.sb],
    ['s2', 'Thân tường – thép đứng mặt trước', rm.path.sf],
    ['b2', 'Bản đáy – lớp trên (gót)', rm.path.ft],
    ['b1', 'Bản đáy – lớp dưới (mũi)', rm.path.fb],
    ['h1', 'Thân tường – thép ngang (co ngót, nhiệt độ)', rm.path.hh],
    ['l1', 'Bản đáy – thép dọc (co ngót, nhiệt độ)', rm.path.ll],
  ];
}

const DraftCalcNum: React.FC<{
  value: number;
  min: number;
  max: number;
  step: number;
  isInt?: boolean;
  onCommit: (v: number) => void;
}> = ({ value, min, max, step, isInt, onCommit }) => {
  const [draft, setDraft] = useState(() => String(value));
  const focusedRef = useRef(false);
  const committedRef = useRef(value);

  useEffect(() => {
    if (!focusedRef.current || value !== committedRef.current) {
      setDraft(String(value));
      committedRef.current = value;
    }
  }, [value]);

  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={draft}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onChange={(e) => {
        const next = e.target.value;
        setDraft(next);
        const v = parseFloat(next);
        if (!Number.isNaN(v)) {
          const val = isInt ? Math.round(v) : v;
          if (val >= (isInt ? 1 : 0.001) && val > 0) {
            committedRef.current = val;
            onCommit(val);
          }
        }
      }}
      onBlur={() => {
        focusedRef.current = false;
        setDraft(String(value));
        committedRef.current = value;
      }}
    />
  );
};

export function formatGsStatusText(P: EngineProject, gsBusy: boolean): string {
  calcEnsure(P);
  if (gsBusy) return 'Đang tính…';
  const o = calcGsOut(P);
  if (!o) return 'Sắp tự tính (khoảng 1 – 2 s; FEM 2D chạy thêm ở luồng nền)…';
  if ('err' in o && o.err) return 'Không chạy được: ' + o.err;
  const R = calcRun(P);
  if (!isCalcValid(R) || !R.g) return '';
  const G = calcGsRows(P, R);
  const nm: Record<string, string> = {
    sl: 'trượt',
    ot: 'lật',
    slE: 'trượt (ĐĐ)',
    otE: 'lật (ĐĐ)',
    bs: 'Bishop',
    srm: 'giảm cường độ',
  };
  const parts = G.rows
    .filter((r) => r.fs != null)
    .map(
      (r) =>
        `${nm[r.id] || r.id} ${r.fs! > 99 ? '> 99' : fmt2(r.fs!)}${r.ok || r.info ? '' : ' ✗'}`,
    );
  return (
    (calcGsStale(P) ? '⚠ Số liệu đã đổi sau lần tính – sắp tự tính lại. ' : '') +
    'Fs: ' +
    parts.join(' · ') +
    (G.ok == null ? '' : G.ok ? ' → ỔN ĐỊNH' : ' → KHÔNG ỔN ĐỊNH') +
    (G.miss.length ? ` (chưa có: ${G.miss.map((r) => nm[r.id] || r.id).join(', ')})` : '') +
    '.'
  );
}

function formatFeStatusText(P: EngineProject): string {
  const c = calcEnsure(P);
  if (!c.feOn) return '';
  if (calcFeStale(P)) return 'Đang tính…';
  const f = getFeCache().fe;
  if (!f) return '';
  const fErr = (f as { err?: string }).err;
  if (fErr) return 'Không chạy được: ' + fErr;
  if (!f.mesh) return '';
  return `Đã tính: ${f.mesh.elems} phần tử tấm, ${f.mesh.dof} bậc tự do, ${f.ms} ms.`;
}

function formatFemStatusText(P: EngineProject): string {
  const c = calcEnsure(P);
  if (!P.calc) return '';
  const femCache = getFemCache();
  if (femCache.busy) {
    return `Đang tính… ${((Date.now() - femCache.t0) / 1000).toFixed(1)} s (giao diện vẫn dùng được).`;
  }
  if (femCache.err && femCache.tpl === P.tpl) return 'Không chạy được: ' + femCache.err;
  const o = calcFemOut(P);
  const auto = calcFemCanAuto();
  if (!o) {
    return auto
      ? 'Sắp tự chạy (vài giây, giao diện vẫn dùng được)…'
      : 'Chưa chạy. Bấm "Chạy lại phân tích" (vài giây).';
  }
  const l = o.stages[o.stages.length - 1];
  const u = l.uTop[0];
  const stale = calcFemStale(P);
  return (
    (stale
      ? auto
        ? '⚠ Số liệu đã đổi sau lần chạy – sắp tự chạy lại. '
        : '⚠ Số liệu đã đổi sau lần chạy – bấm "Chạy lại phân tích" để cập nhật. '
      : '') +
    `Kết quả (${o.info.ne} phần tử, ${(o.time_ms / 1000).toFixed(1)} s): đỉnh tường dịch ${fmt(Math.abs(u), 1)} mm ${u > 0 ? 'về phía đất đắp' : 'về phía mũi'}, mũi / gót lún ${fmt(-l.uToe, 1)} / ${fmt(-l.uHeel, 1)} mm` +
    (o.FSsrm != null
      ? `, FS giảm cường độ ${fmt2(o.FSsrm)}${o.mech && o.mech.local ? ' (cơ chế cục bộ – không đại diện ổn định tổng thể)' : ' (tham khảo)'}`
      : '') +
    (o.warn.length ? `; ⚠ ${o.warn.length} cảnh báo hội tụ` : '') +
    '. Bản đồ ở tab Ổn định tổng thể' +
    (c.femOn ? ' và mục FEM 2D trong bảng tính' : '') +
    '.'
  );
}

function buildHintMessage(
  P: EngineProject,
  R: CalcRunResult,
  heelHint: number | null | undefined,
  heelHintBusy: boolean,
): string {
  if (heelHintBusy) return 'Đang tính…';
  const valid = isCalcValid(R);
  const stab = valid && R.ok && R.ok.e && R.ok.sl && R.ok.br;
  const quiet = heelHint === undefined;
  if (stab) {
    return quiet ? '' : '✓ Lệch tâm, trượt và sức kháng nền đã đạt – không cần mở rộng gót.';
  }
  if (heelHint == null) {
    return quiet
      ? 'Bấm nút để tìm bề rộng gót tối thiểu đạt lệch tâm, trượt, sức kháng nền.'
      : 'Không đạt dù tăng gót thêm 4 m: cần xem lại chiều cao bản đáy, chân khay hoặc đặc trưng của nền.';
  }
  return `Tăng gót bản đáy thêm ≥ ${fmt(heelHint, 0)} cm (gót ≈ ${fmt(P.heel + heelHint, 0)} cm) thì lệch tâm, trượt và sức kháng nền đều đạt (giữ nguyên các số liệu khác).`;
}

export const SidebarCalcPanel: React.FC = () => {
  const {
    project,
    calcResult,
    feRev,
    gsRev,
    femRev,
    gsBusy,
    femBusy,
    femTick,
    heelHint,
    heelHintBusy,
    setPath,
    updateProject,
    toggleAnc,
    applyRebarFixes,
    runHeelHint,
    runGsNow,
    runFemNow,
    setCalcSub,
  } = useAppStore();

  void feRev;
  void gsRev;
  void femRev;
  void femTick;

  const c = calcEnsure(project);
  const rock = c.soil === 'a';
  const fm = project.fillMode || 'none';
  const aOn = ancOn(project);

  const gsOut = calcGsOut(project);
  const gsRows = useMemo(() => {
    if (!isCalcValid(calcResult) || !calcResult.g || !gsOut || ('err' in gsOut && gsOut.err)) {
      return null;
    }
    return calcGsRows(project, calcResult);
  }, [project, calcResult, gsOut, gsRev, femRev]);

  const gsStale = calcGsStale(project);
  const feStatus = formatFeStatusText(project);
  const femStatus = formatFemStatusText(project);

  const rbList = useMemo(() => calcRbList(project), [project]);
  const suggestItems = useMemo(() => {
    if (isCalcValid(calcResult) && (calcResult.model === 'canti' || calcResult.model === 'rib')) {
      return calcSuggest(project, calcResult);
    }
    return [];
  }, [project, calcResult]);

  const fixableItems = useMemo(
    () => suggestItems.filter((it) => !it.ok && Boolean(it.sug)),
    [suggestItems],
  );

  const hintText = buildHintMessage(project, calcResult, heelHint, heelHintBusy);

  const gA = aOn ? geom(project).an : undefined;
  const rA = aOn ? project.rb[ancKey(project)] : undefined;
  const tl = blindT(project);

  return (
    <div id="panel">
      {/* 0. Thông tin dự án · kích thước nhanh */}
      <CalcAccordion id="0" title="0. Thông tin dự án · kích thước nhanh" initialOpen>
        <TxtField path="calc.pjName" label="Tên dự án" />
        <TxtField path="calc.pjItem" label="Hạng mục" />
        <TxtField path="calc.pjPlace" label="Địa điểm xây dựng" />
        <TxtField path="calc.pjBy" label="Người tính" />
        <DateField path="calc.pjDate" label="Ngày lập" />
        <div className="hint">
          Các dòng đã nhập được in ngay dưới tiêu đề bảng tính và file Word; để trống thì không in.
        </div>
        <QuickHRow />
        <div className="hint" id="calcTip">
          {calcTipLive(project)}
        </div>
      </CalcAccordion>

      {/* 1. Đất đắp sau tường */}
      <CalcAccordion id="1" title="1. Đất đắp sau tường" initialOpen>
        <SelField
          path="fillMode"
          label="Dạng đất đắp trên đỉnh tường"
          stack
          options={[
            ['none', 'Đắp ngang bằng đỉnh tường'],
            ['flat', 'Vai đất đắp ngang (cao hơn đỉnh)'],
            ['1', 'Mái đất đắp dốc 1/1'],
            ['1.5', 'Mái đất đắp dốc 1/1,5'],
          ]}
        />
        {fm !== 'none' ? (
          <NumField
            path="fillH"
            label={
              fm === 'flat'
                ? 'Chiều cao đất đắp trên đỉnh tường'
                : 'Chiều cao mái đất đắp (rồi đắp ngang)'
            }
            unit="cm"
            min={20}
            max={2000}
            step={10}
          />
        ) : null}
        <NumField path="calc.gs" label="Trọng lượng riêng đất đắp γs" unit="kN/m³" min={10} max={25} step={0.5} />
        <NumField path="calc.phi" label="Góc ma sát trong φ'f" unit="độ" min={15} max={45} step={1} />
        <NumField path="calc.dw" label="Góc ma sát đất – lưng tường đứng δ" unit="độ" min={0} max={45} step={1} />
        <NumField path="calc.cs" label="Lực dính c' trên mặt trượt" unit="kPa" min={0} max={50} step={1} />
        <ChkField
          path="calc.dvA"
          label="Góc ma sát trên mặt phẳng AT (qua mép gót) lấy bằng góc dốc mặt đất tại đó"
        />
        {!c.dvA ? (
          <NumField
            path="calc.dv"
            label="Góc ma sát trên mặt phẳng AT (δAT)"
            unit="độ"
            min={0}
            max={45}
            step={1}
          />
        ) : null}
      </CalcAccordion>

      {/* 2. Tải trọng */}
      <CalcAccordion id="2" title="2. Tải trọng" initialOpen>
        <NumField path="calc.q" label="Tải chất thêm phân bố đều q (ES)" unit="kPa" min={0} max={100} step={1} />
        <NumField
          path="calc.qL"
          label="Hoạt tải phân bố trên mặt đất đắp qL – xe thi công, người (LS)"
          unit="kPa"
          min={0}
          max={100}
          step={1}
        />
        <ChkField path="calc.LL" label="Có hoạt tải xe (HL-93) phía sau tường (LS)" />
        {c.LL ? (
          <NumField
            path="calc.dT"
            label="Khoảng cách từ lưng tường đến mép làn xe d"
            unit="m"
            min={0}
            max={20}
            step={0.1}
          />
        ) : null}
        <NumField path="calc.eta" label="Hệ số điều chỉnh tải trọng η" unit="" min={0.8} max={1.3} step={0.05} />
      </CalcAccordion>

      {/* 3. Nền dưới đáy móng */}
      <CalcAccordion id="3" title="3. Nền dưới đáy móng" initialOpen>
        <SelField
          path="calc.soil"
          label="Loại nền dưới đáy móng"
          stack
          options={[
            ['r', 'Đất rời (cát, sỏi)'],
            ['d', 'Đất dính (sét)'],
            ['a', 'Đá'],
          ]}
        />
        {!rock ? (
          <>
            <NumField path="calc.gf" label="Trọng lượng riêng đất nền γ" unit="kN/m³" min={10} max={25} step={0.5} />
            <NumField path="calc.phif" label="Góc ma sát trong của đất nền φf" unit="độ" min={0} max={45} step={1} />
            <NumField path="calc.cf" label="Lực dính của đất nền c" unit="kPa" min={0} max={500} step={1} />
            {c.soil === 'd' ? (
              <NumField
                path="calc.Su"
                label="Cường độ kháng cắt không thoát nước Su (tính trượt)"
                unit="kPa"
                min={0}
                max={500}
                step={1}
              />
            ) : null}
            {c.wOn ? (
              <div className="hint">
                Mực nước ngầm lấy theo mục 4 (hF = {fmt(c.hF, 2)} m trên đáy bản đáy).
              </div>
            ) : (
              <NumField
                path="calc.Dw"
                label="Độ sâu mực nước ngầm từ mặt đất trước tường (99 = không có)"
                unit="m"
                min={0}
                max={99}
                step={0.1}
              />
            )}
            <NumField path="calc.hf" label="Chiều dày đất phủ trước mũi (trên mép mũi)" unit="m" min={0} max={5} step={0.1} />
            <SelField
              path="calc.brm"
              label="Cách xác định sức kháng đỡ"
              stack
              options={[
                ['lt', 'Lý thuyết theo c, φ (TCVN 11823-10, Điều 6.3.1.2)'],
                ['spt', 'Theo SPT (Điều 6.3.1.3)'],
                ['kt', 'Nhập qR theo thí nghiệm'],
              ]}
            />
            {c.brm === 'lt' ? (
              <NumField path="calc.phib" label="Hệ số sức kháng φb" unit="" min={0.2} max={1} step={0.05} />
            ) : c.brm === 'spt' ? (
              <>
                <NumField path="calc.Nspt" label="Số búa SPT tại đáy móng N" unit="búa" min={1} max={100} step={1} />
                <NumField path="calc.Ri" label="Hệ số chiết giảm tải nghiêng Ri" unit="" min={0.1} max={1} step={0.05} />
                <NumField path="calc.phibS" label="Hệ số sức kháng φb (SPT)" unit="" min={0.2} max={1} step={0.05} />
              </>
            ) : (
              <NumField path="calc.qRu" label="Sức kháng tính toán của nền qR" unit="kPa" min={0} max={10000} step={10} />
            )}
          </>
        ) : (
          <>
            <NumField path="calc.phif" label="Góc ma sát bê tông – đá φf (tính trượt)" unit="độ" min={0} max={60} step={1} />
            <NumField path="calc.hf" label="Chiều dày đất phủ trước mũi (trên mép mũi)" unit="m" min={0} max={5} step={0.1} />
            <SelField
              path="calc.brmR"
              label="Cách xác định sức kháng đỡ của đá"
              stack
              options={[
                ['ck', 'Theo qu và RMR (TCVN 11823-10, Điều 6.3.2.2)'],
                ['cp', 'Theo c, φ của khối đá nền (Điều 6.3.1.2)'],
                ['kt', 'Nhập qR theo thí nghiệm'],
              ]}
            />
            {c.brmR === 'ck' ? (
              <>
                <NumField path="calc.qu" label="Cường độ nén một trục của đá qu" unit="MPa" min={1} max={300} step={1} />
                <NumField path="calc.RMR" label="Chỉ số RMR" unit="" min={0} max={100} step={1} />
                <SelField
                  path="calc.rockT"
                  label="Nhóm đá (Bảng 10.4.6.4-4)"
                  stack
                  options={[
                    ['A', 'A - đá cacbonat'],
                    ['B', 'B - sét kết, bột kết, đá phiến'],
                    ['C', 'C - cát kết, quarzit'],
                    ['D', 'D - mácma hạt mịn'],
                    ['E', 'E - mácma hạt thô, biến chất'],
                  ]}
                />
                <NumField path="calc.phibR" label="Hệ số sức kháng φb (đá)" unit="" min={0.2} max={1} step={0.05} />
              </>
            ) : c.brmR === 'cp' ? (
              <>
                <NumField path="calc.cR" label="Lực dính c của khối đá nền" unit="kPa" min={0} max={5000} step={10} />
                <NumField path="calc.phiR" label="Góc ma sát trong φ của khối đá nền" unit="độ" min={0} max={60} step={1} />
                <NumField path="calc.gR" label="Trọng lượng riêng khối đá nền γ" unit="kN/m³" min={15} max={30} step={0.5} />
                <NumField path="calc.phibR" label="Hệ số sức kháng φb (đá)" unit="" min={0.2} max={1} step={0.05} />
              </>
            ) : (
              <NumField path="calc.qRu" label="Sức kháng tính toán của nền qR" unit="kPa" min={0} max={100000} step={10} />
            )}

            <label
              className="chk"
              title="Công tắc chung với tab Bản vẽ: có neo thì bản vẽ bỏ khóa chống cắt / chân khay (Mẫu 2: cả dầm biên)."
            >
              <input type="checkbox" checked={aOn} onChange={(e) => toggleAnc(e.target.checked)} />
              {' Có neo thép khoan vào đá (thay khóa chống cắt / chân khay)'}
            </label>

            {aOn ? (
              <>
                <label className="row stack">
                  <span className="lab">Cách neo chịu lực trượt</span>
                  <span className="inp">
                    <select
                      value={c.aSl}
                      data-path="calc.aSl"
                      onChange={(e) => {
                        const v = e.target.value as 'fr' | 'dw';
                        updateProject((draft) => {
                          const dc = calcEnsure(draft);
                          dc.aSlSet = true;
                          dc.aSl = v;
                        });
                      }}
                    >
                      <option value="fr">Lực kẹp của neo – ma sát cắt (μ.ΣTr)</option>
                      <option value="dw">Chốt chịu cắt (Qr = φs.ΣAb.κ.fy)</option>
                    </select>
                  </span>
                </label>
                {c.aSl === 'dw' ? (
                  <NumField
                    path="calc.aTv"
                    label="Hệ số cường độ cắt của chốt κ (τ = κ.fy)"
                    unit=""
                    min={0.3}
                    max={1}
                    step={0.05}
                  />
                ) : null}
                <NumField path="calc.afy" label="Giới hạn chảy thép neo fy" unit="MPa" min={240} max={600} step={10} />
                {c.aSl !== 'dw' ? (
                  <>
                    <NumField path="calc.aDh" label="Đường kính lỗ khoan Dh" unit="mm" min={40} max={200} step={1} />
                    <NumField path="calc.agf" label="Cường độ vữa bơm f'c,v" unit="MPa" min={15} max={60} step={1} />
                    <SelField
                      path="calc.tauA"
                      label="Cường độ dính bám vữa – đá"
                      stack
                      options={[
                        ['auto', 'Tham khảo theo nhóm đá'],
                        ['tay', 'Nhập theo thí nghiệm kéo neo'],
                      ]}
                    />
                    {c.tauA === 'tay' ? (
                      <NumField path="calc.atau" label="Cường độ dính bám danh định τn" unit="MPa" min={0.1} max={10} step={0.1} />
                    ) : null}
                    <NumField
                      path="calc.amu"
                      label="Hệ số ma sát bê tông – đá μ (lực kẹp của neo)"
                      unit=""
                      min={0.3}
                      max={1.4}
                      step={0.1}
                    />
                  </>
                ) : null}
                <div className="hint">
                  {gA
                    ? `Neo Φ${rA?.d ?? project.anc?.d ?? 32}, lưới ${fmt(gA.a * 10)}×${fmt(gA.a * 10)} mm, dài ${fmt(gA.L * 10)} mm: ăn vào đá Lr = ${fmt(Math.max(0, gA.Lb - tl) * 10)} mm, trong bản đáy La = ${fmt(gA.Lc * 10)} mm. Đường kính, chiều dài, lưới và vị trí neo lấy từ bản vẽ – nhập một lần ở mục "${isD(project) ? '2b. Chi tiết Mẫu 4' : '3. Thép neo cắm đá'}" và mục Cốt thép của tab Bản vẽ.`
                    : 'Chưa dựng được lưới neo (kiểm tra chiều dài đơn nguyên, bề rộng bản đáy).'}
                </div>
                <ChkField path="calc.aOT" label="Kể lực neo chống lật khi kiểm tra lệch tâm" />
              </>
            ) : (
              <div className="hint">
                Nền đá không neo: chống trượt chỉ nhờ ma sát bê tông – đá. Bật ô trên để cắm thép
                neo (bản vẽ sẽ bỏ khóa chống cắt / chân khay).
              </div>
            )}
          </>
        )}
        <NumField path="calc.phit" label="Hệ số sức kháng trượt φτ" unit="" min={0.5} max={1} step={0.05} />
      </CalcAccordion>

      {/* 4. Nước ngầm */}
      <CalcAccordion
        id="4"
        title={'4. Nước ngầm – áp lực thấm – đẩy ngược' + (c.wOn ? '  ·  đang bật' : '')}
      >
        <ChkField
          path="calc.wOn"
          label="Xét nước ngầm: áp lực nước sau lưng, đẩy ngược dưới đáy móng, đất ngập nước"
        />
        {c.wOn ? (
          <>
            <NumField
              path="calc.hB"
              label="Mực nước ngầm sau lưng tường hB (cao độ đo từ đáy bản đáy)"
              unit="m"
              min={0}
              max={40}
              step={0.1}
            />
            <NumField
              path="calc.hF"
              label="Mực nước phía trước mũi hF (cao độ đo từ đáy bản đáy)"
              unit="m"
              min={0}
              max={40}
              step={0.1}
            />
            <NumField path="calc.gsat" label="Trọng lượng riêng bão hòa của đất đắp γsat" unit="kN/m³" min={14} max={24} step={0.5} />
            {!rock ? (
              <>
                <NumField path="calc.gfs" label="Trọng lượng riêng bão hòa của đất nền γsat" unit="kN/m³" min={14} max={24} step={0.5} />
                <SelField
                  path="calc.wMode"
                  label="Sơ đồ áp lực nước lỗ rỗng dưới đáy móng (kiểm toán)"
                  stack
                  options={[
                    ['hs', 'Thủy tĩnh (cột nước giảm tuyến tính từ gót đến mũi)'],
                    ['fd', 'Thấm ổn định hai chiều (thể tích hữu hạn)'],
                  ]}
                />
              </>
            ) : null}
            <NumField
              path="calc.Tn"
              label="Chiều dày lớp thấm dưới đáy bản đáy Tn (đáy lớp không thấm)"
              unit="m"
              min={1}
              max={60}
              step={0.5}
            />
            <SciField path="calc.kbx" label="Hệ số thấm đất đắp sau lưng – phương ngang Kx" />
            <SciField path="calc.kby" label="Hệ số thấm đất đắp sau lưng – phương đứng Ky" />
            <SciField
              path="calc.kfx"
              label={(rock ? 'Hệ số thấm khối đá nền' : 'Hệ số thấm đất nền') + ' – phương ngang Kx'}
            />
            <SciField
              path="calc.kfy"
              label={(rock ? 'Hệ số thấm khối đá nền' : 'Hệ số thấm đất nền') + ' – phương đứng Ky'}
            />
            <div className="hint">
              Trường áp lực nước chỉ phụ thuộc tỷ số giữa các hệ số thấm (đất đắp / nền, ngang /
              đứng), không phụ thuộc giá trị tuyệt đối. Tham khảo: cát thô 1e-2 – 1e-4 ; cát mịn
              1e-4 – 1e-5 ; bụi, sét pha 1e-5 – 1e-7 ; sét &lt; 1e-8 (m/s). Lớp thấm Tn, Kx, Ky dùng
              cho phân tích ổn định tổng thể (mục 6) và cho sơ đồ &quot;Thấm hai chiều&quot; của
              kiểm toán.
            </div>
            {!rock ? (
              <NumField
                path="calc.FSp"
                label="Hệ số an toàn tối thiểu chống xói ngầm, đẩy trồi FSp"
                unit=""
                min={1}
                max={5}
                step={0.1}
              />
            ) : (
              <div className="hint">
                Nền đá: áp lực nước dưới đáy móng của kiểm toán tính theo sơ đồ thủy tĩnh; không xét
                xói ngầm của đất.
              </div>
            )}
            <div className="hint">
              Hệ số tải trọng của nước lấy 1,0. Mực nước nhập là cao độ trên đáy bản đáy; mực nước
              phía trước mũi cũng dùng để xác định hệ số Cwq, Cwγ của sức kháng đỡ.
            </div>
          </>
        ) : null}
      </CalcAccordion>

      {/* 5. Động đất */}
      <CalcAccordion
        id="5"
        title={'5. Động đất (tổ hợp Đặc biệt)' + (c.eqOn ? '  ·  đang bật' : '')}
      >
        <ChkField path="calc.eqOn" label="Xét động đất (giả tĩnh Mononobe-Okabe) – thêm tổ hợp Đặc biệt" />
        {c.eqOn ? (
          <>
            <NumField path="calc.eqA" label="Hệ số gia tốc nền A (đã nhân hệ số nền As)" unit="g" min={0.01} max={1} step={0.01} />
            <SelField
              path="calc.eqKm"
              label="Cách lấy hệ số động đất ngang kh"
              stack
              options={[
                ['half', 'kh = 0,5A (tường chuyển vị 25–50 mm)'],
                ['full', 'kh = A (tường không chuyển vị)'],
                ['tay', 'Nhập trực tiếp'],
              ]}
            />
            {c.eqKm === 'tay' ? (
              <NumField path="calc.eqKh" label="Hệ số động đất ngang kh" unit="" min={0} max={1} step={0.01} />
            ) : null}
            <NumField path="calc.eqKv" label="Hệ số động đất đứng kv (hướng lên; 0 = bỏ qua)" unit="" min={0} max={0.5} step={0.01} />
            <NumField path="calc.eqG" label="Hệ số hoạt tải trong tổ hợp Đặc biệt γEQ" unit="" min={0} max={1} step={0.05} />
            <div className="hint">
              Tổ hợp Đặc biệt I-a, I-b: hệ số tải trọng thường xuyên như TTGH Cường độ, EQ = 1,0, φ
              kết cấu BTCT = 1,0, φ trượt = 1,0, φ sức kháng đỡ = 0,8; lệch tâm cho phép nội suy
              theo γEQ (nền đá giữ 0,45B). Chưa kể áp lực nước động.
            </div>
          </>
        ) : null}
      </CalcAccordion>

      {/* 6. Ổn định tổng thể */}
      <CalcAccordion
        id="6"
        title={'6. Ổn định tổng thể' + (gsOut ? '  ·  đã phân tích' : c.bsOn ? '  ·  đang bật' : '')}
        initialOpen
      >
        <ChkField
          path="calc.bsOn"
          label="Tính vào kết luận: cung trượt tròn Bishop theo TCVN 11823-11, Điều 6.2.3 (FS ≥ 1/φ)"
        />
        {c.bsOn ? (
          <NumField path="calc.bsPhiR" label="Hệ số sức kháng φ (FS tối thiểu = 1/φ)" unit="" min={0.3} max={1} step={0.05} />
        ) : null}
        <NumField path="calc.bsT" label="Bề dày lớp nền được xét dưới đáy bản đáy T (cung trượt)" unit="m" min={1} max={30} step={0.5} />
        <div className="hint">
          Hệ số an toàn yêu cầu cho phân tích ổn định tổng thể (tham khảo, phương pháp ứng suất cho
          phép – không tính vào kết luận chung):
        </div>
        <NumField path="calc.fsSl" label="Trượt phẳng theo đáy móng (tải tiêu chuẩn)" unit="" min={1} max={5} step={0.05} />
        <NumField path="calc.fsOt" label="Lật quanh mũi (tải tiêu chuẩn)" unit="" min={1} max={5} step={0.05} />
        {c.eqOn ? (
          <>
            <NumField path="calc.fsSlE" label="Trượt phẳng khi có động đất" unit="" min={1} max={5} step={0.05} />
            <NumField path="calc.fsOtE" label="Lật quanh mũi khi có động đất" unit="" min={1} max={5} step={0.05} />
          </>
        ) : null}
        <NumField path="calc.fsGs" label="Cung trượt Bishop và giảm cường độ FEM" unit="" min={1} max={5} step={0.05} />

        <button type="button" className="wide gsRun" disabled={gsBusy} onClick={() => runGsNow(false)}>
          {gsBusy ? 'Đang tính…' : 'Tính lại ổn định tổng thể'}
        </button>

        <div className="gsbox">
          {gsBusy ? (
            <div className="hint">Đang tính…</div>
          ) : !gsOut ? (
            <div className="hint">
              <Glyphs text={formatGsStatusText(project, gsBusy)} />
            </div>
          ) : 'err' in gsOut && gsOut.err ? (
            <div className="hint">Không chạy được: {gsOut.err}</div>
          ) : !gsRows ? null : (
            <>
              {gsStale ? (
                <div className="hint">
                  <Glyphs text="⚠ Số liệu đã đổi sau lần tính – sắp tự tính lại." />
                </div>
              ) : null}
              <table>
                <thead>
                  <tr>
                    <th>Phương pháp tính</th>
                    <th>Fs</th>
                    <th>Yêu cầu</th>
                  </tr>
                </thead>
                <tbody>
                  {gsRows.rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {r.nm}
                        {r.note ? (
                          <>
                            <br />
                            <small>{r.note}</small>
                          </>
                        ) : null}
                      </td>
                      <td
                        className={
                          r.fs == null ? undefined : r.ok ? 'ok' : r.info ? 'inf' : 'bad'
                        }
                      >
                        {r.fs == null ? '-' : r.fs > 99 ? '> 99' : fmt2(r.fs)}
                      </td>
                      <td>≥ {fmt2(r.req)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {gsRows.ok != null ? (
                <div className={`${gsRows.ok ? 'ok' : 'bad'} gst`}>
                  Trạng thái: {gsRows.ok ? 'ỔN ĐỊNH' : 'KHÔNG ỔN ĐỊNH'}
                  {gsRows.complete ? '' : ' (mới xét các hạng mục đã tính)'}
                </div>
              ) : null}
              {gsRows.miss.length > 0 ? (
                <div className="hint">Chưa có: {gsRows.miss.map((r) => r.nm).join('; ')}.</div>
              ) : null}
            </>
          )}
        </div>

        <button type="button" className="wide" onClick={() => setCalcSub('gs')}>
          Xem tab Ổn định tổng thể
        </button>
        <div className="hint">
          {'Phân tích gồm: hệ số an toàn trượt phẳng và lật quanh mũi (tải tiêu chuẩn), cung trượt Bishop' +
            (c.wOn ? ' với áp lực nước lỗ rỗng theo lời giải thấm 2D (mục 4)' : '') +
            '; kèm phân tích FEM 2D đất – tường (mục 8): vùng chảy dẻo, chuyển vị và lưới biến dạng (hệ số an toàn giảm cường độ nếu đánh dấu ô thử ở mục 8). Các biểu đồ (áp lực nước lỗ rỗng khi bật nước, vùng chảy dẻo, cung trượt Bishop, chuyển vị và lưới biến dạng) hiện ở tab Ổn định tổng thể, bảng tính và Word. Tự tính khi số liệu đứng yên (bảng tính, in và Word luôn có kết quả); nút chỉ để tính lại ngay. Tải trọng ở trạng thái tiêu chuẩn, tường là vật thể cứng (cung trượt), không kể sườn, neo.'}
        </div>
      </CalcAccordion>

      {/* 7. Mô hình phần tử hữu hạn 3D (FE) */}
      <CalcAccordion
        id="7"
        title={'7. Mô hình phần tử hữu hạn 3D (FE)' + (c.feOn ? '  ·  đang bật' : '')}
      >
        <ChkField
          path="calc.feOn"
          label={
            'Chạy mô hình phần tử hữu hạn tấm 3D của một phân đoạn tường (thân + bản đáy' +
            (project.type === 'rib' ? ' + sườn' : '') +
            ')'
          }
        />
        {c.feOn ? (
          <>
            <SelField
              path="calc.feBasis"
              label="Cách dùng kết quả"
              stack
              options={[
                [
                  'fe',
                  project.type === 'rib'
                    ? 'Nội lực FE dùng để kiểm toán sườn và tính vào kết luận'
                    : 'Tính vào kết luận chung',
                ],
                ['hand', 'Chỉ đối chiếu (tính tay là cơ sở kiểm toán)'],
              ]}
            />
            <NumField path="calc.feN" label="Kích thước phần tử lưới" unit="m" min={0.25} max={1.5} step={0.05} />
            <div className="hint" id="feStat">
              <Glyphs text={feStatus} />
            </div>
            <button type="button" className="wide" onClick={() => setCalcSub('fe')}>
              Xem nội lực mô hình tấm (biểu đồ màu M, V, N)
            </button>
            <div className="hint">
              Lưới phần tử tấm (màng + uốn) theo mặt giữa; tải trọng và tổ hợp lấy từ lõi tính, phản
              lực nền tuyến tính tự cân bằng. Kết quả không phụ thuộc cốt thép nên đổi Φ, a không
              phải tính lại.
            </div>
          </>
        ) : null}
      </CalcAccordion>

      {/* 8. FEM 2D đất – tường */}
      <CalcAccordion
        id="8"
        title={
          '8. FEM 2D đất – tường (tham khảo)' +
          (c.femOn ? '  ·  có mục chi tiết trong bảng tính' : '')
        }
      >
        <ChkField
          path="calc.femOn"
          label="Đưa mục FEM 2D chi tiết (bảng theo giai đoạn thi công, áp lực đáy bản đáy…) vào bảng tính và Word"
        />
        <SelField
          path="calc.femMesh"
          label="Mật độ lưới"
          stack
          options={[
            ['n', 'Lưới mịn (≈ 3000 phần tử, vài giây)'],
            ['c', 'Lưới thô (≈ 1000 phần tử, nhanh hơn, kém chính xác)'],
          ]}
        />
        <NumField path="calc.femEb" label="Mô đun đàn hồi của đất đắp E" unit="MPa" min={2} max={200} step={1} />
        <NumField
          path="calc.femEf"
          label="Mô đun đàn hồi của nền E (0 = tự chọn theo loại nền)"
          unit="MPa"
          min={0}
          max={50000}
          step={1}
        />
        <NumField path="calc.femPsi" label="Góc giãn nở của đất ψ" unit="độ" min={0} max={30} step={1} />
        <NumField path="calc.femLifts" label="Số lớp đắp sau lưng tường" unit="lớp" min={1} max={10} step={1} />
        <ChkField
          path="calc.femSrm"
          label="Thử hệ số an toàn giảm cường độ (nhạy lưới, tốn thêm thời gian) – chỉ tham khảo"
        />
        <button type="button" className="wide" id="femRun" disabled={femBusy} onClick={runFemNow}>
          {femBusy ? 'Đang tính…' : 'Chạy lại phân tích'}
        </button>
        <div className="hint" id="femStat">
          <Glyphs text={femStatus} />
        </div>
        <div className="hint">
          Phân tích FEM 2D luôn tự chạy trong luồng nền khi số liệu đứng yên (không treo giao diện;
          nút để chạy lại ngay) để mục Ổn định tổng thể có bản đồ vùng chảy dẻo, chuyển vị và lưới
          biến dạng. Nước ngầm (mục 4) xuất hiện sau khi thi công xong, ứng suất có hiệu. Tiếp xúc
          tường – đất dính kết; không kể neo, khoá chống trượt – nên không tính vào kết luận chung.
        </div>
      </CalcAccordion>

      {/* 9. Vật liệu & lớp bảo vệ */}
      <CalcAccordion id="9" title="9. Vật liệu & lớp bảo vệ (dùng chung bản vẽ)">
        <TxtField path="concrete" label="Mác bê tông" />
        <NumField path="calc.fc" label="Cường độ f'c (MPa; 0 = quy đổi theo mác)" unit="MPa" min={0} max={80} step={1} />
        <TxtField path="steel" label="Cấp thép" />
        <NumField path="cover" label="Lớp bê tông bảo vệ" unit="cm" min={2} max={15} step={0.5} />
        <NumField path="calc.gc" label="Trọng lượng riêng bê tông γc" unit="kN/m³" min={22} max={26} step={0.5} />
        <NumField path="calc.ag" label="Cỡ hạt cốt liệu lớn nhất" unit="mm" min={5} max={50} step={1} />
        <SelField
          path="calc.ge"
          label="Điều kiện tiếp xúc khi kiểm soát nứt (Điều 7.3.4)"
          numeric
          stack
          options={[
            [0.75, 'Loại 2 – tiếp xúc đất, nước (γe = 0,75)'],
            [1, 'Loại 1 (γe = 1,00)'],
          ]}
        />
        {project.type !== 'rib' ? (
          <SelField
            path="calc.ift"
            label="Mối nối thi công chân tường – bản đáy"
            stack
            options={[
              ['n', 'Bê tông cũ sạch, không tạo nhám'],
              ['r', 'Bê tông cũ sạch, tạo nhám 6 mm'],
              ['m', 'Đổ liền khối'],
            ]}
          />
        ) : null}
      </CalcAccordion>

      {/* 10. Cốt thép & đề xuất */}
      <CalcAccordion id="10" title="10. Cốt thép & đề xuất" initialOpen>
        <div className="cbars">
          {rbList.map(([id, nm, path, kind]) => {
            const barObj = getProjectPath(project, path) as { d: number; a: number; n?: number } | undefined;
            if (!barObj) return null;
            const sugItem: EngineSuggestItem | undefined = suggestItems.find((x) => x.id === id);

            return (
              <div key={id} className="cb" data-id={id}>
                <div className="cbn">
                  <span
                    className={
                      'cbs' + (sugItem ? (sugItem.ok ? ' ok' : ' bad') : '')
                    }
                  >
                    {sugItem ? <Sym ch={sugItem.ok ? '✓' : '✗'} /> : ''}
                  </span>{' '}
                  {nm}
                </div>
                <div className="cbi">
                  <select
                    value={barObj.d}
                    onChange={(e) => setPath(`${path}.d`, parseInt(e.target.value, 10))}
                  >
                    {DIAS.map((d) => (
                      <option key={d} value={d}>
                        Φ{d}
                      </option>
                    ))}
                  </select>
                  {kind === 'n' ? (
                    <>
                      <span> × </span>
                      <DraftCalcNum
                        value={barObj.n || 2}
                        min={1}
                        max={8}
                        step={1}
                        isInt
                        onCommit={(v) => setPath(`${path}.n`, v)}
                      />
                      <i>thanh/nhóm</i>
                    </>
                  ) : (
                    <>
                      <span> a </span>
                      <DraftCalcNum
                        value={barObj.a}
                        min={5}
                        max={40}
                        step={0.5}
                        onCommit={(v) => setPath(`${path}.a`, v)}
                      />
                      <i>cm</i>
                    </>
                  )}
                </div>
                <div className="cbg">
                  {sugItem && !sugItem.ok ? (
                    sugItem.sug ? (
                      <>
                        <span className="sg">
                          {sugItem.sug.a != null
                            ? `Đề xuất Φ${sugItem.sug.d} a ${fmt(sugItem.sug.a, 1)} cm `
                            : `Đề xuất Φ${sugItem.sug.d} × ${sugItem.sug.n} thanh/nhóm `}
                        </span>
                        <button
                          type="button"
                          className="ap"
                          onClick={() => applyRebarFixes([sugItem])}
                        >
                          Áp dụng
                        </button>
                      </>
                    ) : (
                      <span className="sg bad">{sugItem.why || 'Chưa có phương án'}</span>
                    )
                  ) : null}
                </div>
              </div>
            );
          })}

          <div className="cball">
            {fixableItems.length > 1 ? (
              <button
                type="button"
                className="ap wide"
                onClick={() => applyRebarFixes(fixableItems)}
              >
                Áp dụng tất cả đề xuất ({fixableItems.length})
              </button>
            ) : null}
          </div>

          <div className="hint">
            {'Φ, a (hoặc số thanh) nhập tại đây hoặc ở mục Cốt thép của bản vẽ là cùng một số liệu. Đề xuất chọn Φ, a nhỏ nhất đạt mọi điều kiện (uốn, cốt thép tối thiểu, nứt, cắt, co ngót' +
              (project.type === 'rib' ? ', giằng' : ', ma sát cắt mối nối') +
              '); nhấn Áp dụng để đổi cả bản vẽ 2D, 3D và bảng thống kê.'}
          </div>
        </div>

        <div>
          <button type="button" className="wide" disabled={heelHintBusy} onClick={runHeelHint}>
            Gợi ý kích thước ổn định
          </button>
          <div className="hint" id="calcHint">
            <Glyphs text={hintText} />
          </div>
        </div>
      </CalcAccordion>

      {/* 11. Bảng tính */}
      <CalcAccordion id="11" title="11. Bảng tính">
        <SelField
          path="calc.dec"
          label="Dấu thập phân"
          stack
          options={[
            ['.', 'Dấu chấm (1,234.56)'],
            [',', 'Dấu phẩy (1.234,56)'],
          ]}
        />
      </CalcAccordion>

      {/* 12. Móng cọc BTCT (mô đun mở rộng, tùy chọn) */}
      <CalcAccordion id="12" title="12. Móng cọc BTCT" initialOpen={false}>
        <PilePanel />
      </CalcAccordion>
    </div>
  );
};
