/**
 * Giao diện sáng / tối dùng chung cho cả hai phân hệ (cùng một khóa localStorage nên đổi ở một trang
 * thì trang kia mở ra cùng giao diện). Khóa và mặc định khớp `state/appStore.ts` của phân hệ tường chắn.
 */
export type ThemeMode = 'light' | 'dark';

export const THEME_KEY = 'tuong-chan-btct:theme';

export function readTheme(): ThemeMode {
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_KEY) : null;
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    /* chế độ riêng tư: dùng mặc định */
  }
  return 'light';
}

export function writeTheme(mode: ThemeMode): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(THEME_KEY, mode);
  } catch {
    /* hết dung lượng / chế độ riêng tư: bỏ qua */
  }
}
