import React from 'react';
import { cuDefaults, cuFromCalc, cuGrid, fmt, isCalcValid, type EngineProject } from '../engine';
import { useAppStore } from '../state/appStore';
import { NumField, OptNumField } from './FieldControls';

/**
 * Bảng nhập móng cừ tràm (mô đun mở rộng). Đặt ở hai nơi dùng chung dữ liệu `project.cu`:
 * mục "2d" của tab bản vẽ và mục 13 của tab Tính toán.
 */
export const CuTramPanel: React.FC = () => {
  const { project, updateProject, calcResult } = useAppStore();
  const q = (project as EngineProject).cu;
  const on = Boolean(q && q.on);

  const toggle = (checked: boolean) =>
    updateProject((d) => {
      if (checked) {
        if (!d.cu) d.cu = cuDefaults();
        d.cu.on = true;
      } else if (d.cu) {
        d.cu.on = false;
      }
    });

  const toggleBox = (
    <label className="chk">
      <input type="checkbox" checked={on} data-path="cu.on" onChange={(e) => toggle(e.target.checked)} />
      {' Gia cố nền dưới bản đáy bằng cừ tràm'}
    </label>
  );

  if (!q || !on) {
    return (
      <>
        {toggleBox}
        <div className="hint">
          Mô đun mở rộng cho nền đất yếu: tính sức chịu tải của khối móng cừ tràm, sức chịu tải từng cây
          và số cây cần trên 1 m², kiểm tra đất dưới mũi cừ; mô phỏng 3D lưới cừ dưới bản đáy. Khi tắt,
          mọi kết quả của tường giữ nguyên.
        </div>
      </>
    );
  }

  const B = isCalcValid(calcResult) ? calcResult.g.B : null;
  const Lu = project.Lu / 100;
  const g = B ? cuGrid(q, B, Lu) : null;
  const r = cuFromCalc(project as EngineProject, calcResult);

  return (
    <>
      {toggleBox}

      <div className="pgrp">
        <div className="pgrp-h">Cừ tràm</div>
        <NumField path="cu.d" label="Đường kính thân trung bình" unit="cm" min={3} max={20} step={0.5} />
        <NumField path="cu.L" label="Chiều dài cừ" unit="m" min={1} max={8} step={0.1} />
        <NumField path="cu.n" label="Mật độ đóng" unit="cây/m²" min={4} max={64} step={1} />
        {g ? (
          <div className="calc" id="cuInfo">
            Lưới {g.nx} × {g.nz} = {g.n} cây trong một đơn nguyên · bước ≈ {fmt(g.sx * 100, 0)} ×{' '}
            {fmt(g.sz * 100, 0)} cm · tổng dài {fmt(g.n * q.L, 0)} m
          </div>
        ) : null}
      </div>

      <div className="pgrp">
        <div className="pgrp-h">Đất yếu quanh và dưới cừ</div>
        <NumField path="cu.hm" label="Chiều sâu chôn móng (đáy bản đáy dưới mặt đất)" unit="m" min={0} max={10} step={0.1} />
        <NumField path="cu.phi" label="Góc ma sát trong φ" unit="độ" min={0} max={45} step={0.5} />
        <NumField path="cu.gamma" label="Dung trọng γ" unit="kN/m³" min={1} max={25} step={0.1} />
        <NumField path="cu.c" label="Lực dính c" unit="kPa" min={0} max={200} step={0.5} />
        <OptNumField path="cu.gammaAbove" label="Dung trọng đất trên đáy móng γ’ (trống = γ)" unit="kN/m³" min={1} max={25} step={0.1} />
      </div>

      <div className="pgrp">
        <div className="pgrp-h">Hệ số tính toán</div>
        <NumField path="cu.fsTip" label="Hệ số an toàn – chống mũi khối cừ" unit="" min={1} max={5} step={0.1} />
        <NumField path="cu.fsSide" label="Hệ số an toàn – bám dính xung quanh" unit="" min={1} max={5} step={0.1} />
        <NumField path="cu.Rtip" label="Sức chống của đất dưới mũi cừ R" unit="kPa" min={0} max={5000} step={25} />
        <NumField path="cu.mR" label="Hệ số làm việc ở mũi cừ mR" unit="" min={0.1} max={1.5} step={0.05} />
        <NumField path="cu.mf" label="Hệ số làm việc mặt bên mf" unit="" min={0.1} max={1.5} step={0.05} />
        <NumField path="cu.m1" label="m1 (công thức Rtc)" unit="" min={0.5} max={1.5} step={0.05} />
        <NumField path="cu.m2" label="m2 (công thức Rtc)" unit="" min={0.5} max={1.5} step={0.05} />
        <NumField path="cu.ktc" label="ktc (nền tự nhiên)" unit="" min={0.5} max={1.5} step={0.05} />
        <NumField path="cu.ktcBlock" label="ktc (đất dưới mũi cừ)" unit="" min={0.5} max={1.5} step={0.05} />
        <label className="chk">
          <input
            type="checkbox"
            checked={q.ignoreShallow}
            data-path="cu.ignoreShallow"
            onChange={(e) => updateProject((d) => { if (d.cu) d.cu.ignoreShallow = e.target.checked; })}
          />
          {' Sức kháng nền của móng nông chỉ để tham khảo (nền đã gia cố)'}
        </label>
      </div>

      {r ? (
        <div className="calc" id="cuRes">
          Khối cừ: q<sub>tk</sub> = {fmt(r.block.qtk, 1)} kPa · một cây: Q<sub>c</sub> = {fmt(r.single.Qc, 2)} kN · cần{' '}
          {r.nReq} cây/m² (đang chọn {q.n}) · đất dưới mũi: {fmt(r.sigBase, 1)} / {fmt(r.RBase, 1)} kPa
        </div>
      ) : (
        <div className="hint">Chưa có kết quả tính tường nên chưa kiểm tra được cừ tràm.</div>
      )}
      <div className="hint">
        Số liệu đất mặc định chỉ là ví dụ. Kết quả nên được kiểm chứng bằng thí nghiệm nén tĩnh trên 1 m² cừ
        tràm; cừ phải nằm dưới mực nước ngầm thấp nhất để không mục.
      </div>
    </>
  );
};
