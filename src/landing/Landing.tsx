import React, { useCallback, useMemo, useState } from 'react';
import { BrandMark, Icon } from '../components/Icon';
import { siteBase } from '../shared/ModuleSwitch';
import { readTheme, writeTheme, type ThemeMode } from '../shared/theme';
import { applyLandingTheme } from './theme';

/** Khóa localStorage của hai phân hệ (chỉ ĐỌC để gợi ý "tiếp tục làm việc"). */
const WALLS_DRAFT_KEY = 'tuong-chan-btct:draft';
const CULVERT_MODE_KEY = 'ckn_mode';

const CULVERT_MODE_LABEL: Record<string, string> = {
  cau: 'Cầu: kết cấu nhịp, mố, cọc',
  ch: 'Cống hộp BTCT',
  ct: 'Cống tròn BTCT',
  tc: 'Tường chắn trọng lực',
  tl: 'Tường chắn chữ L BTCT',
  tv: 'Thủy văn cầu',
  tvc: 'Thủy văn cống',
};

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function wallsResume(): string | null {
  const raw = lsGet(WALLS_DRAFT_KEY);
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as { t?: unknown; name?: unknown };
    if (typeof d.t !== 'number') return null;
    const when = new Date(d.t).toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
    const name = typeof d.name === 'string' && d.name ? `“${d.name}” · ` : '';
    return `Có bản nháp chưa lưu: ${name}${when}`;
  } catch {
    return null;
  }
}

function culvertResume(): string | null {
  const m = lsGet(CULVERT_MODE_KEY);
  const hasData = !!lsGet('ckn11823v5');
  if (!hasData) return null;
  return `Đang làm dở: ${(m && CULVERT_MODE_LABEL[m]) || CULVERT_MODE_LABEL.cau}`;
}

interface CardDef {
  id: 'walls' | 'culvert';
  path: string;
  title: string;
  tag: string;
  icon: 'wall' | 'calc';
  points: string[];
  cta: string;
  resume: string | null;
}

export const Landing: React.FC = () => {
  const [theme, setTheme] = useState<ThemeMode>(readTheme);

  const toggle = useCallback(() => {
    setTheme((cur) => {
      const next: ThemeMode = cur === 'dark' ? 'light' : 'dark';
      writeTheme(next);
      applyLandingTheme(next);
      return next;
    });
  }, []);

  const cards = useMemo<CardDef[]>(
    () => [
      {
        id: 'walls',
        path: 'tuong-chan/',
        title: 'Tường chắn BTCT',
        tag: 'Bản vẽ 2D · Mô hình 3D · Kiểm toán',
        icon: 'wall',
        points: [
          '4 mẫu tường: chữ T ngược, có sườn, khối kè, neo đá',
          '5 cụm bản vẽ CAD — xuất DXF, SVG, PDF, bảng thép CSV',
          'Mô hình 3D chân thực, cốt thép từng thanh, cắt lát',
          'Bảng tính TCVN 11823:2017, xuất Word; móng cọc, cừ tràm, tính lún',
        ],
        cta: 'Mở Tường chắn',
        resume: wallsResume(),
      },
      {
        id: 'culvert',
        path: 'cau-cong/',
        title: 'Cầu cống',
        tag: 'Bảng tính kết cấu · Thủy văn thủy lực',
        icon: 'calc',
        points: [
          'Kết cấu nhịp, mố, trụ; móng cọc, cọc khoan nhồi, móng nông',
          'Cống hộp, cống tròn, tường chắn trọng lực và chữ L',
          'Thủy văn thủy lực cầu, cống; phân chia lưu vực từ DEM',
          'Xuất Excel, PDF; bộ kiểm chứng phần mềm đối chiếu chuẩn',
        ],
        cta: 'Mở Cầu cống',
        resume: culvertResume(),
      },
    ],
    [],
  );

  const base = siteBase();

  return (
    <div className="lp" data-theme={theme}>
      <header className="lp-top">
        <div className="lp-brand">
          <span className="lp-logo" aria-hidden="true">
            <BrandMark />
          </span>
          <b>LEDAT-BIM</b>
        </div>
        <button
          id="bTheme"
          type="button"
          className="lp-icon"
          aria-pressed={theme === 'dark'}
          aria-label="Đổi giao diện sáng / tối"
          title={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
          onClick={toggle}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
      </header>

      <main className="lp-main">
        <section className="lp-hero">
          <h1>Bản vẽ, mô hình 3D và bảng tính kết cấu</h1>
          <p>
            Hai phân hệ chạy ngay trên trình duyệt, tính theo <b>TCVN 11823:2017</b>. Dữ liệu nằm trên máy của
            bạn — lưu và mở lại bằng tệp dự án.
          </p>
        </section>

        <section className="lp-cards" aria-label="Chọn phân hệ">
          {cards.map((c) => (
            <a key={c.id} className="lp-card" data-mod={c.id} href={base + c.path}>
              <span className="lp-card-ico" aria-hidden="true">
                <Icon name={c.icon} size={26} />
              </span>
              <span className="lp-card-tag">{c.tag}</span>
              <h2>{c.title}</h2>
              <ul>
                {c.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              {c.resume ? <span className="lp-resume">{c.resume}</span> : null}
              <span className="lp-cta">
                {c.cta}
                <Icon name="chevron" size={16} />
              </span>
            </a>
          ))}
        </section>
      </main>

      <footer className="lp-foot">LEDAT-BIM · tính toán và bản vẽ chạy hoàn toàn trong trình duyệt</footer>
    </div>
  );
};
