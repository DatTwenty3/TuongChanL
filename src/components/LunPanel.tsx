import React from 'react';
import { cuOn, fmt, lunDefaults, lunFromCalc, lunNewLayer, type EngineProject } from '../engine';
import { useAppStore } from '../state/appStore';
import type { LunLayer } from '../types/project';
import { CellNum, NumField, SelField } from './FieldControls';
import { Icon } from './Icon';

type LayerKey = 'thk' | 'gamma' | 'e0' | 'Cv' | 'Cc' | 'Cr' | 'Pc';

const FIELDS: Array<[LayerKey, string, number]> = [
  ['thk', 'Dày (m)', 0.5],
  ['gamma', 'γ (kN/m³)', 0.1],
  ['e0', 'e₀', 0.01],
  ['Cv', 'Cv (10⁻⁴ cm²/s)', 0.1],
  ['Cc', 'Cc', 0.01],
  ['Cr', 'Cr', 0.005],
  ['Pc', 'Pc (kPa)', 1],
];

/** Bảng nhập tính lún cố kết của nền dưới bản đáy (mô đun mở rộng) – mục 14 của tab Tính toán. */
export const LunPanel: React.FC = () => {
  const { project, updateProject, calcResult } = useAppStore();
  const P = project as EngineProject;
  const q = P.lun;
  const on = Boolean(q && q.on);

  const toggle = (checked: boolean) =>
    updateProject((d) => {
      if (checked) {
        if (!d.lun) d.lun = lunDefaults();
        d.lun.on = true;
      } else if (d.lun) {
        d.lun.on = false;
      }
    });

  const toggleBox = (
    <label className="chk">
      <input type="checkbox" checked={on} data-path="lun.on" onChange={(e) => toggle(e.target.checked)} />
      {' Tính lún cố kết của nền dưới bản đáy'}
    </label>
  );

  if (!q || !on) {
    return (
      <>
        {toggleBox}
        <div className="hint">
          Mô đun mở rộng: lún cố kết theo phương pháp phân tầng lấy tổng với Cc, Cr, Pc của từng lớp; tổng lún S = m·Sc so
          với độ lún cho phép; dự báo lún theo thời gian. Khi tắt, mọi kết quả của tường giữ nguyên.
        </div>
      </>
    );
  }

  const mutLayer = (id: string, fn: (l: LunLayer) => void) =>
    updateProject((d) => {
      const l = d.lun?.layers.find((x) => x.id === id);
      if (l) fn(l);
    });
  const r = lunFromCalc(P, calcResult);
  const hasCu = cuOn(P);

  return (
    <>
      {toggleBox}

      <div className="pgrp">
        <div className="pgrp-h">Điều kiện chung</div>
        <NumField path="lun.hw" label="Mực nước ngầm dưới mặt đất tự nhiên" unit="m" min={0} max={50} step={0.1} />
        {hasCu ? (
          <div className="hint">Chiều sâu chôn móng lấy theo mục Cừ tràm; tải gây lún đặt tại mũi cừ.</div>
        ) : (
          <NumField path="lun.hm" label="Đáy bản đáy dưới mặt đất tự nhiên" unit="m" min={0} max={10} step={0.1} />
        )}
        <label className="chk">
          <input
            type="checkbox"
            checked={q.backfill}
            data-path="lun.backfill"
            onChange={(e) =>
              updateProject((d) => {
                if (d.lun) d.lun.backfill = e.target.checked;
              })
            }
          />
          {' Kể tải của đất đắp sau gót tường'}
        </label>
      </div>

      <div className="pgrp">
        <div className="pgrp-h">Địa tầng (từ đáy bản đáy trở xuống)</div>
        {q.layers.map((l, i) => (
          <div className="player" key={l.id} data-lun-layer={l.id}>
            <div className="player-h">
              <span className="sn">{i + 1}</span>
              <input
                type="text"
                value={l.name}
                aria-label={`Tên lớp ${i + 1}`}
                onChange={(e) => mutLayer(l.id, (x) => (x.name = e.target.value))}
              />
              <span />
              <button
                type="button"
                className="pbtn"
                title="Xóa lớp này"
                aria-label={`Xóa lớp ${i + 1}`}
                disabled={q.layers.length <= 1}
                onClick={() =>
                  updateProject((d) => {
                    if (d.lun && d.lun.layers.length > 1) d.lun.layers = d.lun.layers.filter((x) => x.id !== l.id);
                  })
                }
              >
                <Icon name="close" size={13} />
              </button>
            </div>
            <div className="pgrid">
              {FIELDS.map(([key, label, step]) => (
                <label className="pcell" key={key}>
                  <span>{label}</span>
                  <CellNum
                    value={l[key]}
                    step={step}
                    min={0}
                    ariaLabel={`${label} – lớp ${i + 1}`}
                    onCommit={(v) =>
                      mutLayer(l.id, (x) => {
                        if (v != null) x[key] = v;
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
        <button
          type="button"
          className="wide"
          onClick={() =>
            updateProject((d) => {
              if (d.lun) d.lun.layers.push(lunNewLayer({ name: `Lớp ${d.lun.layers.length + 1}` }));
            })
          }
        >
          <Icon name="plus" size={13} /> Thêm lớp đất
        </button>
        <div className="hint">Lớp không lún (cát chặt, đất tốt): đặt Cc = 0; lớp không cố kết theo thời gian: đặt Cv = 0.</div>
      </div>

      <div className="pgrp">
        <div className="pgrp-h">Thông số tính</div>
        <NumField path="lun.dz" label="Bề dày phân tố" unit="m" min={0.1} max={2} step={0.1} />
        <NumField path="lun.stop" label="Dừng tính khi σz/σvz nhỏ hơn" unit="" min={0.05} max={0.5} step={0.01} />
        <NumField path="lun.m" label="Hệ số m (S = m·Sc)" unit="" min={1} max={1.7} step={0.05} />
        <NumField path="lun.Slim" label="Độ lún giới hạn cho phép" unit="cm" min={1} max={100} step={1} />
        <SelField
          path="lun.drain"
          label="Thoát nước cố kết"
          options={[
            ['1', 'Một chiều'],
            ['2', 'Hai chiều'],
          ]}
          transform={(v) => (v === '2' ? 2 : 1)}
        />
        <NumField path="lun.years" label="Số năm dự báo" unit="năm" min={1} max={100} step={1} />
      </div>

      {r ? (
        <div className="calc" id="lunRes">
          Sc = {fmt(r.Sc * 100, 1)} cm · S = {fmt(r.S * 100, 1)} cm (cho phép {fmt(q.Slim, 0)} cm) · vùng tính lún{' '}
          {fmt(r.Za, 1)} m · sau {q.years} năm lún {fmt((r.time[r.time.length - 1]?.St ?? 0) * 100, 1)} cm
        </div>
      ) : (
        <div className="hint">Chưa có kết quả tính tường nên chưa tính được độ lún.</div>
      )}
      <div className="hint">Số liệu địa tầng mặc định chỉ là ví dụ – nhập theo kết quả thí nghiệm nén cố kết của công trình.</div>
    </>
  );
};
