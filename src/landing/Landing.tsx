import React, { useCallback, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { LOGO_PATH, LOGO_VIEWBOX } from '../shared/brand';
import { siteBase } from '../shared/ModuleSwitch';
import { readTheme, writeTheme, type ThemeMode } from '../shared/theme';
import { applyLandingTheme } from './theme';
import { Backdrop } from './Backdrop';

/** Khóa localStorage của hai phân hệ (chỉ ĐỌC để gợi ý "tiếp tục làm việc"). */
const WALLS_DRAFT_KEY = 'tuong-chan-btct:draft';
const CULVERT_MODE_KEY = 'ckn_mode';
const HOGA_DRAFT_KEY = 'ledat-hoga:draft';

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

function hogaResume(): string | null {
  const raw = lsGet(HOGA_DRAFT_KEY);
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as { title?: unknown; rows?: unknown };
    if (!Array.isArray(d.rows)) return null;
    const name = typeof d.title === 'string' && d.title ? `“${d.title}” · ` : '';
    return `Có bản nháp chưa lưu: ${name}${d.rows.length} ga`;
  } catch {
    return null;
  }
}

interface CardDef {
  id: 'walls' | 'culvert' | 'hoga' | 'pavement' | 'toando';
  path: string;
  title: string;
  tag: string;
  icon: 'wall' | 'calc' | 'manhole' | 'road' | 'layers';
  /** Mô tả một dòng (giữ ngắn — trang chủ chỉ để chọn phân hệ). */
  desc: string;
  resume: string | null;
}

const BRAND = 'LEDAT-BIM';
/** Chữ cái đầu tiên của "BIM": từ đây trở đi chữ chạy gradient (sáng lần lượt B → I → M). */
const BIM_FROM = 6;
const TAGLINE = 'Structural Solutions';

/** Một chữ của chữ thương hiệu: chuyển động vào và gradient nằm trên hai phần tử khác nhau (một phần tử chỉ có một animation). */
function brandLetter(ch: string, k: number): React.ReactNode {
  return (
    <span key={k} aria-hidden="true" className="lp-letter" style={{ animationDelay: `${1.25 + k * 0.07}s` }}>
      {k >= BIM_FROM ? (
        <span className="wm-g" style={{ animationDelay: `${-1.2 + (k - BIM_FROM) * 0.3}s` }}>
          {ch}
        </span>
      ) : (
        ch
      )}
    </span>
  );
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
        desc: 'Bản vẽ CAD, mô hình 3D, kiểm toán tường chắn',
        resume: wallsResume(),
      },
      {
        id: 'culvert',
        path: 'cau-cong/',
        title: 'Cầu cống',
        tag: 'Bảng tính kết cấu · Thủy văn thủy lực',
        icon: 'calc',
        desc: 'Nhịp, mố, trụ, cống hộp, cống tròn, thủy văn',
        resume: culvertResume(),
      },
      {
        id: 'hoga',
        path: 'ho-ga/',
        title: 'Hố ga BTCT',
        tag: 'Bản vẽ · Bóc khối lượng · Chiết tính thép',
        icon: 'manhole',
        desc: 'Vẽ A3, bóc khối lượng, chiết tính thép hố ga',
        resume: hogaResume(),
      },
      {
        id: 'pavement',
        path: 'mat-duong/',
        title: 'Kết cấu mặt đường',
        tag: 'TCCS 37 · 38 · 39 / TCĐBVN',
        icon: 'road',
        desc: 'Mặt đường cứng BTXM, mềm đa lớp & chỉ số SN',
        resume: null,
      },
      {
        id: 'toando',
        path: 'toan-do/',
        title: 'Kiểm toán áo đường',
        tag: '22TCN 211-06 · TCCS 38:2022',
        icon: 'layers',
        desc: 'Kiểm toán áo đường mềm, cải tạo Ch.10 & tra toán đồ 3-1..3-6',
        resume: null,
      },
    ],
    [],
  );

  const base = siteBase();

  return (
    <div className="lp" data-theme={theme}>
      <Backdrop />
      <button
        id="bTheme"
        type="button"
        className="lp-icon lp-theme"
        aria-pressed={theme === 'dark'}
        aria-label="Đổi giao diện sáng / tối"
        title={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
        onClick={toggle}
      >
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
      </button>

      <main className="lp-main">
        {/* Thương hiệu lớn: dấu hiệu tự vẽ nét rồi tô đặc, chữ hiện từng chữ, dòng phụ giãn đúng bằng bề ngang chữ. */}
        <div className="lp-lockup">
          <span className="lp-mark">
            <span className="lp-halo" aria-hidden="true" />
            <svg viewBox={LOGO_VIEWBOX} aria-hidden="true" focusable="false">
              <path d={LOGO_PATH} fill="none" stroke="currentColor" strokeWidth={8} strokeLinejoin="round" pathLength={1} className="lp-draw" />
              <path d={LOGO_PATH} fill="currentColor" fillRule="evenodd" className="lp-fill" />
            </svg>
          </span>
          <div className="lp-word">
            <h1 aria-label={BRAND}>{[...BRAND].map((ch, k) => brandLetter(ch, k))}</h1>
            <span className="lp-tagline" aria-label={TAGLINE}>
              {[...TAGLINE].map((ch, i) => (
                <span key={i} aria-hidden="true">
                  {ch === ' ' ? ' ' : ch}
                </span>
              ))}
            </span>
          </div>
        </div>

        <section className="lp-pick" aria-label="Chọn phân hệ">
          {cards.map((c) => (
            <a key={c.id} className="lp-card" data-mod={c.id} href={base + c.path}>
              <span className="lp-card-ico" aria-hidden="true">
                <Icon name={c.icon} size={24} />
              </span>
              <span className="lp-card-body">
                <h2>{c.title}</h2>
                <span className="lp-card-tag">{c.tag}</span>
                <span className="lp-card-desc">{c.desc}</span>
                {c.resume ? <span className="lp-resume">{c.resume}</span> : null}
              </span>
              <span className="lp-go" aria-hidden="true">
                <Icon name="chevron" size={16} />
              </span>
            </a>
          ))}
        </section>

        <p className="lp-note">
          Năm phân hệ chạy ngay trên trình duyệt, tính theo <b>TCVN 11823:2017</b>, <b>22TCN 211-06</b> &amp; <b>TCCS 37/38/39</b>. Dữ liệu nằm
          trên máy của bạn — lưu và mở lại bằng tệp dự án.
        </p>
      </main>

      <footer className="lp-foot">© LEDAT</footer>
    </div>
  );
};
