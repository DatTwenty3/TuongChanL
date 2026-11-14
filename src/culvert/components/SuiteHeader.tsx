/**
 * Thanh trên cùng của phân hệ Cầu cống — cùng ngôn ngữ thiết kế với header của phân hệ Tường chắn:
 * logo + tên LEDAT-BIM, nút chuyển phân hệ và công tắc giao diện sáng / tối (chung khóa localStorage).
 */

import { useCallback, useEffect, useState } from 'react';
import { BrandMark, Icon } from '../../components/Icon.tsx';
import { ModuleSwitch } from '../../shared/ModuleSwitch.tsx';
import { readTheme, writeTheme, type ThemeMode } from '../../shared/theme.ts';

/** Áp giao diện lên `<html>` (CSS của phân hệ khóa theo `html[data-theme]`). */
export function applyTheme(mode: ThemeMode): void {
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = mode;
}

export function SuiteHeader() {
  const [theme, setTheme] = useState<ThemeMode>(readTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((cur) => {
      const next: ThemeMode = cur === 'dark' ? 'light' : 'dark';
      writeTheme(next);
      return next;
    });
  }, []);

  return (
    <header className="suite-bar" data-theme={theme}>
      <div className="brand">
        <span className="logo" aria-hidden="true">
          <BrandMark />
        </span>
        <div>
          <b>LEDAT-BIM</b>
          <small>Bảng tính cầu cống · TCVN 11823:2017 · LEDAT</small>
        </div>
      </div>

      <ModuleSwitch current="culvert" />

      <div className="suite-end">
        <button
          id="bTheme"
          type="button"
          className="icononly"
          aria-pressed={theme === 'dark'}
          title={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
          aria-label="Đổi giao diện sáng / tối"
          onClick={toggleTheme}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
      </div>
    </header>
  );
}
