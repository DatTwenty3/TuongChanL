import { readTheme, type ThemeMode } from '../shared/theme';

/** Áp giao diện lên `<html>` (CSS trang chủ khóa theo `html[data-theme]`). */
export function applyLandingTheme(mode: ThemeMode = readTheme()): void {
  document.documentElement.dataset.theme = mode;
}
