import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  C_MARKS,
  DIAS,
  D_ROLE_UI,
  D_TAB,
  ROLE_NAME,
  ancOn,
  beamOn,
  blindT,
  ckey,
  dIdxOf,
  dLabel,
  fmt,
  geom,
  isC,
  isD,
  keyBlocked,
  keyOn,
  presetCanti,
  presetKe,
  presetRib,
  presetWall4,
  rolesOf,
  type EngineProject,
} from '../engine';
import { useAppStore } from '../state/appStore';
import { KE_HS, NumField, QuickHRow, SelField, TxtField, keFirst, keLabel } from './FieldControls';

type FieldDef = [string, string, string, number, number, number];

const GEO_FIELDS: FieldDef[] = [
  ['H', 'Chiều cao thân tường H (từ mặt bản đáy)', 'cm', 100, 2000, 5],
  ['tst', 'Bề dày thân tường – đỉnh', 'cm', 15, 200, 1],
  ['tsb', 'Bề dày thân tường – chân', 'cm', 15, 400, 1],
  ['toe', 'Chiều dài mũi bản đáy (0 = chữ L thuần)', 'cm', 0, 600, 5],
  ['heel', 'Chiều dài gót bản đáy', 'cm', 20, 1500, 5],
  ['tBase', 'Bề dày bản đáy', 'cm', 30, 300, 5],
  ['tTip', 'Bề dày mút mũi', 'cm', 15, 300, 1],
  ['Lu', 'Chiều dài đơn nguyên', 'cm', 300, 2500, 10],
];
const GEO_FIELDS_D: FieldDef[] = GEO_FIELDS.filter((f) => f[0] !== 'tTip');
const GEO_FIELDS_C: FieldDef[] = [
  ['toeFlat', 'Đoạn mút mũi dày đều (cạnh mũi)', 'cm', 0, 300, 5],
  ['haunch', 'Vút chéo sau chân thân (phía gót)', 'cm', 0, 100, 5],
  ['tTipH', 'Bề dày bản đáy tại mút gót', 'cm', 15, 300, 1],
];
const KEY_FIELDS_C: FieldDef[] = [
  ['key.w', 'Bề rộng chân khay (mũi bản đáy)', 'cm', 20, 100, 5],
  ['key.d', 'Chiều sâu chân khay (dưới đáy móng)', 'cm', 40, 400, 10],
];
const KEY_FIELDS: FieldDef[] = [
  ['key.w', 'Bề rộng chân khóa', 'cm', 20, 300, 5],
  ['key.d', 'Chiều sâu chân khóa', 'cm', 20, 300, 5],
  ['key.dx', 'Lệch so với tim thân tường', 'cm', -300, 300, 5],
];
const RIB_FIELDS: FieldDef[] = [
  ['rib.t', 'Bề dày sườn', 'cm', 20, 100, 5],
  ['rib.gap', 'Khoảng hở giữa 2 sườn', 'cm', 100, 600, 5],
  ['rib.edge', 'Khoảng chừa 2 đầu đơn nguyên (tối thiểu)', 'cm', 0, 300, 5],
  ['rib.drop', 'Đỉnh sườn thấp hơn đỉnh tường', 'cm', 0, 300, 5],
];
const RIB_FIELDS_C: FieldDef[] = [['rib.end', 'Đầu sườn lùi so với mút gót', 'cm', 0, 100, 5]];
const A_FIELDS: FieldDef[] = [
  ['fil', 'Vút chéo chân thân (hai mặt)', 'cm', 0, 100, 5],
  ['cap.w', 'Mũ đầu tường – bề rộng tính từ mặt trước (0 = không mũ)', 'cm', 0, 300, 5],
  ['cap.hv', 'Mũ đầu tường – đoạn cao đứng', 'cm', 0, 100, 5],
  ['cap.hs', 'Mũ đầu tường – đoạn vát', 'cm', 0, 100, 5],
];
const A_BEAM_FIELDS: FieldDef[] = [
  ['beam.w', 'Dầm biên – bề rộng đáy', 'cm', 20, 150, 5],
  ['beam.d', 'Dầm biên – chiều sâu dưới đáy bản', 'cm', 20, 150, 5],
];
const D_FIELDS: FieldDef[] = [
  ['vtop', 'Đoạn mặt sau thân thẳng đứng ở đỉnh (phía dưới vát tới chân thân)', 'cm', 0, 300, 5],
  ['pvc.d', 'Ống thoát nước PVC – đường kính', 'mm', 30, 150, 5],
  ['pvc.a', 'Ống thoát nước PVC – bước dọc đơn nguyên', 'cm', 50, 400, 10],
  [
    'anc.L',
    'Thép neo b7 – chiều dài (tổng, 1 thanh; nửa trong đá, nửa trong bản đáy)',
    'cm',
    40,
    200,
    10,
  ],
];

const DraftRebarNum: React.FC<{
  value: number;
  width: number;
  min?: number;
  max?: number;
  step?: number;
  isInt?: boolean;
  onCommit: (v: number) => void;
}> = ({ value, width, min = 1, max, step = 1, isInt, onCommit }) => {
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
      style={{ width }}
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

function CadAccordion({
  id,
  title,
  defaultOpen = true,
  children,
}: {
  id: string;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const { cadAccordions, setCadAccordion } = useAppStore();
  const open = cadAccordions[id] ?? defaultOpen;
  return (
    <details
      open={open}
      onToggle={(e) => {
        const next = e.currentTarget.open;
        if (next !== open) setCadAccordion(id, next);
      }}
    >
      <summary>{title}</summary>
      <div className="body">{children}</div>
    </details>
  );
}

function TemplateThumb({ p }: { p: EngineProject }) {
  const g = useMemo(() => geom(p), [p]);
  const s = 100 / Math.max(g.B + 20, g.yTop + (g.key ? g.key.d : 0) + 10);
  const H0 = 80;
  const X = (x: number) => (6 + x * s).toFixed(1);
  const Y = (y: number) => (H0 - 6 - y * s).toFixed(1);
  const pts = (q: ReadonlyArray<readonly [number, number]>) =>
    q.map((v) => `${X(v[0])},${Y(v[1])}`).join(' ');

  return (
    <svg viewBox="0 0 120 80" width="100%" height="64">
      <polygon points={pts(g.out)} fill="#dbe9f4" stroke="#17222e" strokeWidth="1" />
      {g.hyp ? (
        <polygon
          points={pts(g.hyp.tri)}
          fill="#c5d9ea"
          stroke="#17222e"
          strokeWidth=".7"
          strokeDasharray="2 1.5"
        />
      ) : null}
      <line
        x1="2"
        y1={Y(g.yTop)}
        x2="116"
        y2={Y(g.yTop)}
        stroke="#9ab"
        strokeWidth=".4"
        strokeDasharray="1.5 1.5"
      />
    </svg>
  );
}

export const SidebarCadPanel: React.FC = () => {
  const {
    project,
    lastH1,
    barsRes,
    updateProject,
    setTemplatePreset,
    toggleAnc,
  } = useAppStore();

  const kSelVal = isC(project) && project.keIdx != null ? keFirst(project.keIdx) : KE_HS[0][1];
  const dSelVal = isD(project) ? dIdxOf(project) : 1;

  const previewB = useMemo(() => presetCanti(lastH1 * 100), [lastH1]);
  const previewA = useMemo(() => presetRib(), []);
  const previewC = useMemo(() => presetKe({}, kSelVal), [kSelVal]);
  const previewD = useMemo(() => presetWall4({}, dSelVal), [dSelVal]);

  const kBlk = keyBlocked(project);
  const aOn = ancOn(project);
  const kName = isC(project) ? 'chân khay' : 'khóa chống cắt';
  const kWhy = aOn
    ? `Nền đá có thép neo: neo thay cho ${kName}. Bỏ chọn "Nền đá: cắm thép neo vào đá" để dùng lại.`
    : 'Mẫu 2 có dầm biên ở 2 đầu bản đáy: dầm biên thay cho khóa chống cắt. Tắt dầm biên (mục 2b) để dùng khóa.';

  const g = barsRes.g;

  const typeSegmented = (
    <div className="seg">
      {(
        [
          ['canti', 'Không sườn'],
          ['rib', 'Có sườn'],
        ] as const
      ).map(([v, label]) => (
        <button
          key={v}
          type="button"
          className={project.type === v ? 'on' : undefined}
          onClick={() => updateProject((draft) => { draft.type = v; })}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const keyCheckbox = (
    <label className="chk" title={kBlk ? kWhy : undefined}>
      <input
        type="checkbox"
        checked={Boolean(project.key.on && !kBlk)}
        disabled={kBlk}
        onChange={(e) =>
          updateProject((draft) => {
            draft.key.on = e.target.checked;
          })
        }
      />
      {isC(project)
        ? kBlk
          ? ' Chân khay ở mũi bản đáy (không dùng khi có neo đá)'
          : ' Có chân khay ở mũi bản đáy'
        : kBlk
          ? ` Chân khóa chống cắt (không dùng khi có ${aOn ? 'neo đá' : 'dầm biên – mục 2b'})`
          : ' Có chân khóa chống cắt'}
    </label>
  );

  const ancCheckbox = (
    <label
      className="chk"
      title="Khi nền là đá: khoan cấy thép neo vào đá, thay cho khóa chống cắt / chân khay. Bảng tính dùng đúng đường kính, chiều dài, lưới neo của bản vẽ."
    >
      <input type="checkbox" checked={aOn} onChange={(e) => toggleAnc(e.target.checked)} />
      {isD(project)
        ? ' Nền đá: cắm thép neo vào đá'
        : ` Nền đá: cắm thép neo vào đá (thay ${kName}${project.tpl === 'A' ? ', dầm biên' : ''})`}
    </label>
  );

  return (
    <div id="panel">
      {/* 0. Chọn mẫu bản vẽ */}
      <CadAccordion id="0" title="0. Chọn mẫu bản vẽ">
          <div className="presets">
            <div className="hint">
              Chọn mẫu để nạp kích thước + cốt thép mặc định đúng bản vẽ CAD (chiều cao không có
              trong mẫu thì lấy mẫu gần nhất); sau đó sửa tự do:
            </div>
            <div className="tpls">
              {/* Mẫu 1 (B) */}
              <div
                className={'tpl' + (project.tpl === 'B' ? ' on' : '')}
                onClick={() => setTemplatePreset((meta) => presetCanti(lastH1 * 100, meta), true)}
              >
                <TemplateThumb p={previewB} />
                <b>Mẫu 1 · Chữ T ngược</b>
                <small>H = 4÷13 m, có khóa chống cắt</small>
                <select
                  id="preH"
                  value={lastH1}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const h = parseFloat(e.target.value);
                    setTemplatePreset((meta) => presetCanti(h * 100, meta));
                  }}
                >
                  {[4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((h) => (
                    <option key={h} value={h}>
                      H = {h} m
                    </option>
                  ))}
                </select>
              </div>

              {/* Mẫu 2 (A) */}
              <div
                className={'tpl' + (project.tpl === 'A' ? ' on' : '')}
                onClick={() => setTemplatePreset((meta) => presetRib(meta), true)}
              >
                <TemplateThumb p={previewA} />
                <b>Mẫu 2 · Có sườn</b>
                <small>h = 8,2 m, B = 8,5 m, mũ đầu tường, dầm biên 50×50, 4 sườn</small>
              </div>

              {/* Mẫu 3 (C) */}
              <div
                className={'tpl' + (project.tpl === 'C' ? ' on' : '')}
                onClick={() => setTemplatePreset((meta) => presetKe(meta, kSelVal), true)}
              >
                <TemplateThumb p={previewC} />
                <b>Mẫu 3 · Khối kè có sườn</b>
                <small>
                  Chọn chiều cao H = {fmt(KE_HS[0][0] / 100, 2)} ÷{' '}
                  {fmt(KE_HS[KE_HS.length - 1][0] / 100, 2)} m ({KE_HS.length} mức), có / không
                  chân khay, L = 11,8 m, 5 sườn
                </small>
                <select
                  id="preK"
                  value={kSelVal}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const idx = parseInt(e.target.value, 10);
                    setTemplatePreset((meta) => presetKe(meta, idx));
                  }}
                >
                  {KE_HS.map(([, i]) => (
                    <option key={i} value={i}>
                      {keLabel({ H: KE_HS.find(([, idx]) => idx === i)?.[0] ?? 0 })}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mẫu 4 (D) */}
              <div
                className={'tpl' + (project.tpl === 'D' ? ' on' : '')}
                onClick={() => setTemplatePreset((meta) => presetWall4(meta, dSelVal), true)}
              >
                <TemplateThumb p={previewD} />
                <b>Mẫu 4 · Chữ T ngược neo đá</b>
                <small>
                  6 bản vẽ H = 3,0 / 4,5 / 6,0 (bản dày 0,8 hoặc 1,0 m) / 6,5 / 8,0 m; mặt sau vát,
                  neo D32 vào nền đá, ống PVC thoát nước; H ≥ 6,5 m có 4 sườn
                </small>
                <select
                  id="preD"
                  value={dSelVal}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const idx = parseInt(e.target.value, 10);
                    setTemplatePreset((meta) => presetWall4(meta, idx));
                  }}
                >
                  {D_TAB.map((r, i) => (
                    <option key={r.id} value={i}>
                      {dLabel(r)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <QuickHRow />
          </div>
      </CadAccordion>

      {/* 1. Kiểu tường */}
      <CadAccordion id="1" title="1. Kiểu tường">
          {isC(project) ? (
            <>
              <div className="hint">
                Khối kè BTCT có sườn: 5 sườn trên 1 đơn nguyên. Chọn chiều cao H ở mục 0 để nạp
                đúng kích thước + cốt thép mặc định của bản vẽ CAD ở chiều cao đó; chân khay
                (40×200 cm) và các kích thước đều sửa được bên dưới.
              </div>
              {keyCheckbox}
              {ancCheckbox}
            </>
          ) : isD(project) ? (
            <>
              <div className="hint">
                Tường chữ T ngược BTCT, mặt sau vát, neo D32 khoan cấy vào nền đá. Chọn chiều cao H
                ở mục 0 để nạp đúng kích thước + cốt thép của bản vẽ CAD: H = 8,0 và 6,5 m có 4
                sườn (đơn nguyên 11 m); H ≤ 6,0 m không sườn (đơn nguyên 24,98 m).
              </div>
              {D_TAB[dIdxOf(project)].ribH > 0 ? typeSegmented : null}
              {ancCheckbox}
            </>
          ) : (
            <>
              {typeSegmented}
              {keyCheckbox}
              {ancCheckbox}
            </>
          )}
      </CadAccordion>

      {/* 2. Kích thước mặt cắt */}
      <CadAccordion id="2" title="2. Kích thước mặt cắt">
          {(isD(project) ? GEO_FIELDS_D : GEO_FIELDS).map(([path, label, unit, min, max, step]) => (
            <NumField key={path} path={path} label={label} unit={unit} min={min} max={max} step={step} />
          ))}
          {isC(project)
            ? GEO_FIELDS_C.map(([path, label, unit, min, max, step]) => (
                <NumField
                  key={path}
                  path={path}
                  label={label}
                  unit={unit}
                  min={min}
                  max={max}
                  step={step}
                />
              ))
            : null}
          <div className="calc" id="calcB">
            Tổng bề rộng bản đáy B = {fmt(g.B)} cm · cao tổng cộng = {fmt(g.yTop)} cm
          </div>
      </CadAccordion>

      {/* 2b. Chi tiết mẫu 2 */}
      {project.tpl === 'A' ? (
        <CadAccordion id="2b_A" title="2b. Chi tiết mẫu 2 (vút, mũ đầu tường, dầm biên)">
            {A_FIELDS.map(([path, label, unit, min, max, step]) => (
              <NumField
                key={path}
                path={path}
                label={label}
                unit={unit}
                min={min}
                max={max}
                step={step}
              />
            ))}
            <label
              className="chk"
              title={
                aOn
                  ? 'Nền đá có thép neo: neo thay cho dầm biên và khóa chống cắt.'
                  : undefined
              }
            >
              <input
                type="checkbox"
                checked={Boolean(project.beam?.on && !aOn)}
                disabled={aOn}
                onChange={(e) =>
                  updateProject((draft) => {
                    if (!draft.beam) draft.beam = { on: e.target.checked, w: 50, d: 50 };
                    else draft.beam.on = e.target.checked;
                  })
                }
              />
              {' Có dầm biên ở 2 đầu bản đáy' + (aOn ? ' (không dùng khi có neo đá)' : '')}
            </label>
            {beamOn(project)
              ? A_BEAM_FIELDS.map(([path, label, unit, min, max, step]) => (
                  <NumField
                    key={path}
                    path={path}
                    label={label}
                    unit={unit}
                    min={min}
                    max={max}
                    step={step}
                  />
                ))
              : null}
        </CadAccordion>
      ) : null}

      {/* 2b. Chi tiết mẫu 4 */}
      {isD(project) ? (
        <CadAccordion id="2b_D" title="2b. Chi tiết Mẫu 4 (mặt sau thân, neo đá, ống thoát nước)">
            {D_FIELDS.filter((f) => aOn || !/^anc\./.test(f[0])).map(
              ([path, label, unit, min, max, step]) => (
                <NumField
                  key={path}
                  path={path}
                  label={label}
                  unit={unit}
                  min={min}
                  max={max}
                  step={step}
                />
              ),
            )}
        </CadAccordion>
      ) : null}

      {/* 3. Thép neo cắm đá (when !D && aOn) */}
      {!isD(project) && aOn ? (
        <CadAccordion id="3_anc" title={`3. Thép neo cắm đá (thay ${kName})`}>
            <NumField path="anc.L" label="Chiều dài neo (tổng, 1 thanh)" unit="cm" min={30} max={400} step={5} />
            <div className="calc" id="calcAn">
              {g.an
                ? `Lưới ${g.an.xs.length} × ${g.an.zs.length} = ${g.an.xs.length * g.an.zs.length} thanh neo · trong bản đáy ${fmt(g.an.Lc)} cm, dưới đáy bản ${fmt(g.an.Lb)} cm (ăn vào đá ${fmt(Math.max(0, g.an.Lb - blindT(project)))} cm)`
                : ''}
            </div>
            <div className="hint">
              Đường kính và bước neo sửa ở mục 5 (Cốt thép). Lưới a × a theo cả bề rộng bản đáy và
              chiều dài đơn nguyên, cách mép ≥ 25 cm; đầu trên neo nằm trong bản đáy (cách mặt bản
              ≥ lớp bảo vệ), đầu dưới ăn vào đá qua lớp bê tông lót.
            </div>
        </CadAccordion>
      ) : null}

      {/* 3. Chân khay / Chân khóa */}
      {keyOn(project) ? (
        <CadAccordion id="3_key" title={isC(project) ? '3. Chân khay' : '3. Chân khóa chống cắt'}>
            {(isC(project) ? KEY_FIELDS_C : KEY_FIELDS).map(([path, label, unit, min, max, step]) => (
              <NumField
                key={path}
                path={path}
                label={label}
                unit={unit}
                min={min}
                max={max}
                step={step}
              />
            ))}
        </CadAccordion>
      ) : null}

      {/* 4. Sườn tăng cường */}
      {project.type === 'rib' ? (
        <CadAccordion id="4" title="4. Sườn tăng cường">
            {RIB_FIELDS.map(([path, label, unit, min, max, step]) => (
              <NumField
                key={path}
                path={path}
                label={label}
                unit={unit}
                min={min}
                max={max}
                step={step}
              />
            ))}
            {isC(project) || isD(project)
              ? RIB_FIELDS_C.map(([path, label, unit, min, max, step]) => (
                  <NumField
                    key={path}
                    path={path}
                    label={label}
                    unit={unit}
                    min={min}
                    max={max}
                    step={step}
                  />
                ))
              : null}
            <div className="calc" id="calcR">
              Số sườn trên 1 đơn nguyên: {g.ribs.length} · cách tim{' '}
              {fmt(project.rib.gap + project.rib.t)} cm
            </div>
        </CadAccordion>
      ) : null}

      {/* 4b. Đất đắp sau tường */}
      <CadAccordion id="4b" title="4b. Đất đắp sau tường">
          <SelField
            path="fillMode"
            label="Dạng đất đắp trên thân tường"
            options={[
              ['none', 'Đắp ngang bằng đỉnh tường'],
              ['flat', 'Vai đất đắp ngang (cao hơn đỉnh)'],
              ['1', 'Chân mái đất đắp dốc 1/1'],
              ['1.5', 'Chân mái đất đắp dốc 1/1,5'],
            ]}
          />
          {project.fillMode !== 'none' ? (
            <NumField
              path="fillH"
              label={
                project.fillMode === 'flat'
                  ? 'Chiều cao đất đắp trên đỉnh tường'
                  : 'Chiều cao mái đất đắp (rồi đắp ngang)'
              }
              unit="cm"
              min={20}
              max={2000}
              step={10}
            />
          ) : null}
          <div className="hint">
            Dùng chung với tab Tính toán: đường mặt đất đắp phía sau tường trên bản vẽ cũng là mặt
            đất tính áp lực đất.
          </div>
      </CadAccordion>

      {/* 5. Cốt thép */}
      <CadAccordion id="5" title="5. Cốt thép (sửa theo kết quả tính)">
          <div id="rbtab">
            <table className="rb">
              <thead>
                <tr>
                  <th>Mác</th>
                  <th>Thép</th>
                  <th>D (mm)</th>
                  <th>Bước a (cm)</th>
                </tr>
              </thead>
              <tbody>
                {rolesOf(project).map((k) => {
                  const r = project.rb[k];
                  if (!r) return null;
                  const b = barsRes.bars.find((x) => x.key === k);
                  const mark = isC(project)
                    ? k === 'an'
                      ? '17'
                      : (C_MARKS.find((m) => ckey(m) === k) ?? '–')
                    : isD(project)
                      ? (D_ROLE_UI[k]?.[0] ?? '–')
                      : b
                        ? b.mark
                        : '–';
                  const name = isD(project) ? (D_ROLE_UI[k]?.[1] ?? k) : (ROLE_NAME[k] ?? k);

                  let cell: React.ReactNode;
                  if (k === 'r1' && !isD(project)) {
                    cell = (
                      <span>
                        <DraftRebarNum
                          value={r.n ?? 2}
                          width={40}
                          isInt
                          onCommit={(v) =>
                            updateProject((d) => {
                              d.rb[k].n = v;
                            })
                          }
                        />
                        {' thanh/sườn · '}
                        <DraftRebarNum
                          value={r.ng ?? 2}
                          width={36}
                          isInt
                          onCommit={(v) =>
                            updateProject((d) => {
                              d.rb[k].ng = v;
                            })
                          }
                        />
                        {' nhóm cắt dần'}
                      </span>
                    );
                  } else if (k === 'c13') {
                    cell = (
                      <span>
                        <DraftRebarNum
                          value={r.n ?? 2}
                          width={52}
                          isInt
                          onCommit={(v) =>
                            updateProject((d) => {
                              d.rb[k].n = v;
                            })
                          }
                        />
                        {' thanh/sườn'}
                      </span>
                    );
                  } else if (k === 'e1') {
                    cell = (
                      <span>
                        <DraftRebarNum
                          value={r.n ?? 8}
                          width={52}
                          isInt
                          onCommit={(v) =>
                            updateProject((d) => {
                              d.rb[k].n = v;
                            })
                          }
                        />
                        {' thanh/dầm'}
                      </span>
                    );
                  } else if (k === 'c5a') {
                    cell = (
                      <span>
                        <DraftRebarNum
                          value={r.n ?? 2}
                          width={52}
                          isInt
                          onCommit={(v) =>
                            updateProject((d) => {
                              d.rb[k].n = v;
                            })
                          }
                        />
                        {' thanh'}
                      </span>
                    );
                  } else if (k === 't1') {
                    cell = (
                      <span>
                        <DraftRebarNum
                          value={r.a ?? 100}
                          width={48}
                          onCommit={(v) =>
                            updateProject((d) => {
                              d.rb[k].a = v;
                            })
                          }
                        />
                        {' × '}
                        <DraftRebarNum
                          value={r.ah ?? 100}
                          width={48}
                          onCommit={(v) =>
                            updateProject((d) => {
                              d.rb[k].ah = v;
                            })
                          }
                        />
                      </span>
                    );
                  } else if (k === 'r3') {
                    cell = (
                      <span>
                        <DraftRebarNum
                          value={r.a ?? 20}
                          width={60}
                          onCommit={(v) =>
                            updateProject((d) => {
                              d.rb[k].a = v;
                            })
                          }
                        />{' '}
                        <input
                          type="checkbox"
                          checked={r.on !== false}
                          onChange={(e) =>
                            updateProject((d) => {
                              d.rb[k].on = e.target.checked;
                            })
                          }
                        />
                        {' có'}
                      </span>
                    );
                  } else {
                    cell = (
                      <DraftRebarNum
                        value={r.a ?? 20}
                        width={70}
                        onCommit={(v) =>
                          updateProject((d) => {
                            d.rb[k].a = v;
                          })
                        }
                      />
                    );
                  }

                  return (
                    <tr key={k}>
                      <td className="mk">{mark}</td>
                      <td className="nm">{name}</td>
                      <td>
                        <select
                          value={r.d}
                          onChange={(e) => {
                            const d = parseInt(e.target.value, 10);
                            updateProject((draft) => {
                              draft.rb[k].d = d;
                            });
                          }}
                        >
                          {DIAS.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>{cell}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="hint">
              Mặc định lấy theo bản vẽ tham khảo. Khi có kết quả tính toán, đổi D và bước a – bản
              vẽ, bảng thống kê và khối lượng tự cập nhật.
            </div>
          </div>
      </CadAccordion>

      {/* 6. Vật liệu & trình bày */}
      <CadAccordion id="6" title="6. Vật liệu & trình bày" defaultOpen={false}>
          <NumField path="cover" label="Lớp bê tông bảo vệ" unit="cm" min={2} max={15} step={0.5} />
          <label className="chk">
            <input
              type="checkbox"
              checked={project.blindOn !== false}
              onChange={(e) =>
                updateProject((draft) => {
                  draft.blindOn = e.target.checked;
                })
              }
            />
            {' Có bê tông lót móng (rộng đúng bằng móng)'}
          </label>
          {project.blindOn !== false ? (
            <NumField path="tBlind" label="Bề dày bê tông lót" unit="cm" min={5} max={30} step={1} />
          ) : null}
          <label className="chk">
            <input
              type="checkbox"
              checked={project.formEnds !== false}
              onChange={(e) =>
                updateProject((draft) => {
                  draft.formEnds = e.target.checked;
                })
              }
            />
            {' Ván khuôn: tính cả 2 mặt đầu đơn nguyên (khe lún)'}
          </label>
          <TxtField path="concrete" label="Mác bê tông" />
          <TxtField path="steel" label="Cấp thép" />
          <SelField
            path="dimLeg"
            label="Chân dim"
            options={[
              ['cut', 'Cắt ở mép ngoài hình (mặc định)'],
              ['full', 'Kéo tới điểm đo'],
            ]}
          />
          <SelField
            path="paper"
            label="Khổ giấy dự kiến (để chọn tỷ lệ tự động)"
            options={[
              ['A3', 'A3'],
              ['A2', 'A2'],
              ['A1', 'A1'],
              ['A0', 'A0'],
            ]}
          />
          <SelField
            path="scale"
            label="Tỷ lệ bản vẽ"
            numeric
            options={[
              [0, 'Tự động'],
              [10, '1/10'],
              [20, '1/20'],
              [25, '1/25'],
              [30, '1/30'],
              [35, '1/35'],
              [40, '1/40'],
              [50, '1/50'],
              [60, '1/60'],
              [70, '1/70'],
              [75, '1/75'],
              [80, '1/80'],
              [100, '1/100'],
              [150, '1/150'],
              [200, '1/200'],
            ]}
          />
      </CadAccordion>
    </div>
  );
};
