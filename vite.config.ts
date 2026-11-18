import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const page = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

/** `/cau-cong`, `/tuong-chan`, `/ho-ga`, `/mat-duong`, `/toan-do` (thiếu dấu `/` cuối) → thêm `/` ở dev và preview (Vercel dùng `rewrites` trong vercel.json). */
type Connect = { use: (fn: (req: { url?: string }, res: any, next: () => void) => void) => void };
const culvertSlash = () => {
  const mw: Parameters<Connect['use']>[0] = (req, res, next) => {
    const m = req.url ? /^\/(cau-cong|tuong-chan|ho-ga|mat-duong|toan-do)(\?.*)?$/.exec(req.url) : null;
    if (req.url && m) {
      res.statusCode = 302;
      res.setHeader('Location', req.url.replace('/' + m[1], '/' + m[1] + '/'));
      res.end();
      return;
    }
    next();
  };
  return {
    name: 'culvert-trailing-slash',
    // Không trả về giá trị: Vite coi hàm trả về là hook chạy SAU các middleware nội bộ.
    configureServer(server: { middlewares: Connect }) {
      server.middlewares.use(mw);
    },
    configurePreviewServer(server: { middlewares: Connect }) {
      server.middlewares.use(mw);
    },
  };
};

export default defineConfig({
  plugins: [react(), culvertSlash()],
  worker: {
    format: 'es',
  },
  build: {
    // Một site, sáu trang: `/` (trang chủ), `/tuong-chan/`, `/cau-cong/`, `/ho-ga/`, `/mat-duong/`, `/toan-do/`.
    // Mỗi trang có tài liệu HTML riêng nên id, class `body.*` và listener toàn cục của các ứng dụng không đụng nhau.
    rollupOptions: {
      input: {
        landing: page('./index.html'),
        walls: page('./tuong-chan/index.html'),
        culvert: page('./cau-cong/index.html'),
        hoga: page('./ho-ga/index.html'),
        pavement: page('./mat-duong/index.html'),
        toando: page('./toan-do/index.html'),
      },
    },
    chunkSizeWarningLimit: 6000,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
