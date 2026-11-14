/**
 * BangTinhCauCong Web App — Bootstrap & Client Entry Point
 *
 * Bootstraps the React 18 root, loads offline Vietnamese TTF font styles,
 * and registers all default visual report hooks (SVG figures, 3D Plotly, MathJax).
 *
 * Phân hệ "Cầu cống" của site LEDAT-BIM (trang `/cau-cong/`); trang này là một tài liệu HTML riêng
 * nên toàn bộ DOM / CSS / listener của nó tách biệt với phân hệ Tường chắn.
 *
 * Clean-room standalone implementation with zero external CDN URLs.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { applyTheme } from './components/SuiteHeader.tsx';
import { run } from './engine/orchestrator.ts';
import { loadMathJax } from './graphics/texMath.ts';
import { registerDefaultVisualHooks } from './reports/index.ts';
import { readTheme } from '../shared/theme.ts';
import './styles/app.css';
import '../shared/modswitch.css';
import './styles/suite.css';

// Giao diện sáng/tối áp trước khi vẽ để không bị nháy màu
applyTheme(readTheme());

// Initialize default SVG / 3D report hooks
registerDefaultVisualHooks();

// Công thức trên màn hình: nạp MathJax cục bộ (public/vendor/mathjax) rồi dựng lại các phần tử `.m`;
// chưa nạp xong / ngoại tuyến thì `mathAll()` vẫn hiện bản chữ Unicode dự phòng.
void loadMathJax();

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

// Tính một lượt ngay khi mở trang để các ô kết quả (Ec, fr, Ag, Ig…) có số liệu của dữ liệu mẫu;
// trước đây chúng để trống cho tới lần sửa ô nhập đầu tiên.
window.setTimeout(() => {
  try {
    run();
  } catch (err) {
    console.error('[culvert] initial run failed:', err);
  }
}, 400);
