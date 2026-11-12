import React from 'react';
import {
  allChecks,
  calcFeStale,
  fmt,
  fmt2,
  getFeCache,
  isCalcValid,
} from '../engine';
import { useAppStore } from '../state/appStore';
import { Glyphs, Sym } from './Icon';

function KpiValue({ v }: { v: string }): JSX.Element {
  const i = v.indexOf(' ');
  if (i < 0) return <b>{v}</b>;
  return (
    <b>
      {v.slice(0, i)} <span className="u">{v.slice(i + 1)}</span>
    </b>
  );
}

export const SidebarMetrics: React.FC = () => {
  const { project, viewMode, barsRes, quantitiesRes, calcResult, feRev } = useAppStore();
  void feRev;

  if (viewMode === 'calc') {
    const R = calcResult;
    if (!R) {
      return (
        <>
          <div id="sum" className="sum" />
          <div id="warn" className="warn">
            <div className="wt">
              <Glyphs text="⚠ Không tính được: " />
            </div>
          </div>
        </>
      );
    }
    if ('error' in R && R.error !== undefined) {
      return (
        <>
          <div id="sum" className="sum" />
          <div id="warn" className="warn">
            <div className="wt">
              <Glyphs text={`⚠ Không tính được: ${R.error || ''}`} />
            </div>
          </div>
        </>
      );
    }
    if ('unsupported' in R && R.unsupported) {
      return (
        <>
          <div id="sum" className="sum" />
          <div id="warn" className="warn">
            <div className="wt">{R.msg}</div>
          </div>
        </>
      );
    }
    if (!isCalcValid(R)) {
      return (
        <>
          <div id="sum" className="sum" />
          <div id="warn" className="warn" />
        </>
      );
    }

    const checks = allChecks(project, R);
    const bad = checks.filter((x) => !x.ok && !x.info);
    const inf = checks.filter((x) => !x.ok && x.info);
    const feStale = calcFeStale(project);
    const feCache = getFeCache();
    const feErr = feCache.fe && 'err' in feCache.fe ? (feCache.fe as { err?: string }).err : undefined;

    return (
      <>
        <div id="sum" className="sum">
          {checks.map((x) => {
            const xv = x.v ?? 0;
            const cls = 'card ck ' + (x.ok ? 'ok' : x.info ? 'inf' : 'bad');
            return (
              <div
                key={x.id}
                className={cls}
                title={
                  x.tip
                    ? x.tip
                    : x.info
                    ? 'Đối chiếu bằng mô hình FE, không tính vào kết luận (đổi ở mục 7)'
                    : 'Hệ số sử dụng = nhu cầu / khả năng (≤ 1 là đạt)'
                }
              >
                <small>{x.t}</small>
                <b>
                  <Sym ch={x.ok ? '✓' : x.info ? '!' : '✗'} />{' '}
                  {xv > 99 ? '> 99' : fmt2(xv)}
                </b>
                <i className="ub" aria-hidden="true">
                  <i style={{ width: `${Math.round(Math.max(0, Math.min(1, xv)) * 100)}%` }} />
                </i>
              </div>
            );
          })}
        </div>
        <div id="warn" className="warn">
          {feStale ? (
            <div className="wi">
              … Mô hình FE đang tính, kết quả sẽ cập nhật sau giây lát
            </div>
          ) : feErr && project.calc?.feOn ? (
            <div className="wt">
              <Glyphs text={`⚠ Mô hình FE không chạy được: ${feErr}`} />
            </div>
          ) : null}

          {inf.length > 0 && (
            <div className="wi">
              ! Mô hình FE (đối chiếu) cho hệ số sử dụng{' '}
              {(inf[0].v ?? 0) > 99 ? '> 99' : fmt2(inf[0].v ?? 0)} &gt; 1 – xem mục FE trong bảng
              tính
            </div>
          )}

          {bad.length > 0 ? (
            <>
              <div className="wt">
                <Glyphs text={`⚠ ${bad.length} hạng mục chưa đạt`} />
              </div>
              {bad.map((x) => {
                const xv = x.v ?? 0;
                return (
                  <div key={x.id} className="wi">
                    {x.t} – hệ số sử dụng {xv > 99 ? '> 99' : fmt2(xv)}
                  </div>
                );
              })}
            </>
          ) : (
            <div className="ok">
              <Glyphs text="✓ Đạt tất cả các hạng mục kiểm toán" />
            </div>
          )}
        </div>
      </>
    );
  }

  const cards: Array<[string, string]> = [
    ['Bê tông', `${fmt2(quantitiesRes.vol)} m³`],
    ['Ván khuôn', `${fmt2(quantitiesRes.form.tot)} m²`],
    ['Bê tông lót', `${fmt2(quantitiesRes.blind)} m³`],
    ['Cốt thép', `${fmt(quantitiesRes.totKg, 0)} kg`],
    ['Hàm lượng', `${fmt(quantitiesRes.ratio, 1)} kg/m³`],
  ];
  // Móng cọc (tùy chọn): thêm 2 thẻ khi bật; tắt thì danh sách thẻ giữ nguyên.
  if (quantitiesRes.pile) {
    cards.push(
      ['Số cọc', `${quantitiesRes.pile.n} cọc`],
      ['Bê tông cọc', `${fmt2(quantitiesRes.pile.vol)} m³`],
    );
  }
  // Cừ tràm (tùy chọn): thêm 2 thẻ khi bật.
  if (quantitiesRes.cu) {
    cards.push(
      ['Cừ tràm', `${quantitiesRes.cu.n} cây`],
      ['Tổng dài cừ', `${fmt(quantitiesRes.cu.totLen, 0)} m`],
    );
  }

  return (
    <>
      <div id="sum" className="sum">
        {cards.map(([label, val]) => (
          <div key={label} className="card">
            <small>{label}</small>
            <KpiValue v={val} />
          </div>
        ))}
      </div>
      <div id="warn" className="warn">
        {barsRes.warn.length > 0 ? (
          <>
            <div className="wt">
              <Glyphs text={`⚠ ${barsRes.warn.length} cảnh báo`} />
            </div>
            {barsRes.warn.map((msg, idx) => (
              <div key={`${idx}-${msg}`} className="wi">
                {msg}
              </div>
            ))}
          </>
        ) : (
          <div className="ok">
            <Glyphs text="✓ Không có cảnh báo về khoảng cách, lớp bảo vệ, chiều dài thanh" />
          </div>
        )}
      </div>
    </>
  );
};
