import React from 'react';

/**
 * Thanh chuyển phân hệ dùng chung của site LEDAT-BIM.
 *
 * Hai phân hệ là hai trang HTML riêng (`/tuong-chan/` và `/cau-cong/`; `/` là trang chủ) nên chuyển phân hệ = điều hướng trang:
 * id, class `body.*` và listener toàn cục của hai ứng dụng không bao giờ cùng tồn tại trong một tài liệu.
 * Màu lấy từ token của trang chủ (`--acc`, `--ink`, `--line`, `--glass-2`) — xem `modswitch.css`.
 */
export type ModuleId = 'walls' | 'culvert';

interface ModuleDef {
  id: ModuleId;
  /** Nhãn đầy đủ (hiện khi đủ chỗ, và là tooltip). */
  label: string;
  /** Nhãn ngắn khi header hẹp. */
  short: string;
  /** Đường dẫn tương đối so với gốc site (không có `/` đầu). */
  path: string;
  hint: string;
  icon: string;
}

export const MODULES: readonly ModuleDef[] = [
  {
    id: 'walls',
    label: 'Tường chắn BTCT',
    short: 'Tường chắn',
    path: 'tuong-chan/',
    hint: 'Bản vẽ 2D · mô hình 3D · kiểm toán tường chắn BTCT, móng cọc, cừ tràm, lún',
    icon: 'M9 3h5v12h7v5H3v-5h6z',
  },
  {
    id: 'culvert',
    label: 'Cầu cống',
    short: 'Cầu cống',
    path: 'cau-cong/',
    hint: 'Bảng tính kết cấu cầu, cống, tường chắn, thủy văn thủy lực theo TCVN 11823:2017',
    icon: 'M3 8h18 M5 8v4 M19 8v4 M3 20h18 M6 20c0-5 12-5 12 0 M12 8v5',
  },
];

/** Gốc site (Vite `base`, mặc định `/`), luôn kết thúc bằng `/`. */
export function siteBase(): string {
  const raw = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  return raw.endsWith('/') ? raw : raw + '/';
}

const HOME_ICON = 'M3 11l9-8 9 8 M5 10v10h14V10 M10 20v-6h4v6';

export const ModuleSwitch: React.FC<{ current: ModuleId }> = ({ current }) => (
  // `div[role=navigation]` thay vì `<nav>`: CSS của phân hệ Tường chắn định vị tuyệt đối mọi `nav` (thanh tab).
  <div className="modsw" role="navigation" aria-label="Chọn phân hệ">
    <a href={siteBase()} data-mod="home" className="modsw-home" title="Trang chủ LEDAT-BIM" aria-label="Trang chủ">
      <svg
        className="modsw-ico"
        width={15}
        height={15}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        {HOME_ICON.split(' M').map((d, i) => (
          <path key={i} d={i === 0 ? d : 'M' + d} />
        ))}
      </svg>
    </a>
    {MODULES.map((m) => (
      <a
        key={m.id}
        href={siteBase() + m.path}
        data-mod={m.id}
        title={`${m.label} — ${m.hint}`}
        aria-current={m.id === current ? 'page' : undefined}
      >
        <svg
          className="modsw-ico"
          width={15}
          height={15}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          {m.icon.split(' M').map((d, i) => (
            <path key={i} d={i === 0 ? d : 'M' + d} />
          ))}
        </svg>
        <span className="modsw-full">{m.label}</span>
        <span className="modsw-short">{m.short}</span>
      </a>
    ))}
  </div>
);
