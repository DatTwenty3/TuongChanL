/**
 * E2E (Chrome headless) cho trang chủ + phân hệ Cầu cống trên bản build `dist/` (vite preview).
 * Phải `npm run build` trước. Chạy: `node tests/qa/e2e_culvert.mjs`
 * (E2E của phân hệ Tường chắn nằm ở `e2e_browser.mjs`.)
 */
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEBAPP_DIR = path.resolve(__dirname, '../..');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 4181;
const ORIGIN = `http://127.0.0.1:${PORT}`;

const STANDALONE_TABS = { ch: 5, ct: 3, tc: 3, tl: 3, tv: 1, tvc: 1 };

function zipNames(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65558); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  assert.ok(eocd >= 0, 'ZIP EOCD missing');
  const count = buf.readUInt16LE(eocd + 10);
  let pos = buf.readUInt32LE(eocd + 16);
  const names = [];
  for (let i = 0; i < count; i++) {
    assert.equal(buf.readUInt32LE(pos), 0x02014b50, 'Bad central directory header');
    const nl = buf.readUInt16LE(pos + 28);
    const el = buf.readUInt16LE(pos + 30);
    const cl = buf.readUInt16LE(pos + 32);
    names.push(buf.subarray(pos + 46, pos + 46 + nl).toString('utf8'));
    pos += 46 + nl + el + cl;
  }
  return names;
}

function killTree(proc) {
  if (!proc || proc.killed) return;
  try {
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
    else proc.kill('SIGKILL');
  } catch {
    /* đã thoát */
  }
}

function waitForServer(url, ms) {
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      http
        .get(url, (res) => {
          res.resume();
          resolve();
        })
        .on('error', () => {
          if (Date.now() - t0 > ms) reject(new Error('server timeout'));
          else setTimeout(tick, 300);
        });
    };
    tick();
  });
}

async function run() {
  assert.ok(fs.existsSync(CHROME_PATH), `Chrome not found at ${CHROME_PATH}`);
  assert.ok(fs.existsSync(path.join(WEBAPP_DIR, 'dist', 'cau-cong', 'index.html')), 'Chưa build: chạy `npm run build`');
  const dlDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc_e2e_'));
  const viteBin = path.join(WEBAPP_DIR, 'node_modules', 'vite', 'bin', 'vite.js');
  const preview = spawn(process.execPath, [viteBin, 'preview', '--port', String(PORT), '--host', '127.0.0.1', '--strictPort'], {
    cwd: WEBAPP_DIR,
    stdio: 'ignore',
  });

  const results = [];
  const consoleErrors = [];
  const httpErrors = [];
  const failed = [];
  const record = (name, ok, detail) => {
    results.push({ name, ok });
    console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name} — ${detail}`);
  };
  const step = async (name, fn) => {
    try {
      record(name, true, await fn());
    } catch (e) {
      record(name, false, e.message.split('\n')[0]);
    }
  };

  let browser;
  try {
    await waitForServer(ORIGIN + '/', 15000);
    browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'],
    });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    const page = await ctx.newPage();
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
    page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message + ' @ ' + page.url() + ' :: ' + String(e.stack || '').split(String.fromCharCode(10)).slice(1, 3).join(' <- ')));
    page.on('requestfailed', (r) => failed.push(r.url()));
    page.on('response', (r) => r.status() >= 400 && httpErrors.push(`${r.status()} ${r.url()}`));

    const theme = () => page.evaluate(() => document.documentElement.dataset.theme);

    await step('C-0 Trang chủ: 2 thẻ, giao diện sáng mặc định, đổi tối và nhớ', async () => {
      await page.goto(ORIGIN + '/');
      await page.waitForSelector('.lp-card');
      const cards = await page.$$eval('.lp-card', (a) => a.map((x) => x.getAttribute('href')));
      assert.deepEqual(cards, ['/tuong-chan/', '/cau-cong/']);
      assert.equal(await theme(), 'light');
      await page.click('#bTheme');
      assert.equal(await theme(), 'dark');
      await page.reload();
      assert.equal(await theme(), 'dark');
      await page.click('#bTheme');
      assert.equal(await theme(), 'light');
      return 'cards=' + cards.join(',');
    });

    await step('C-1 Chuyển phân hệ: trang chủ → Tường chắn → Cầu cống → trang chủ', async () => {
      await page.goto(ORIGIN + '/');
      const texUrls = [];
      const onResp = (r) => /\/tex\//.test(r.url()) && texUrls.push(r.url() + ' ' + (r.headers()['content-type'] || ''));
      page.on('response', onResp);
      await page.click('.lp-card[data-mod="walls"]');
      await page.waitForSelector('.app-shell[data-theme="light"]');
      await page.waitForLoadState('networkidle'); // đợi nạp xong ảnh vật liệu/HDRI của cảnh 3D trước khi rời trang
      assert.equal(new URL(page.url()).pathname, '/tuong-chan/');
      page.off('response', onResp);
      assert.ok(texUrls.length >= 16, 'ảnh vật liệu 3D đã nạp: ' + texUrls.length);
      assert.ok(texUrls.every((u) => !u.includes('/tuong-chan/tex/') && !/text\/html/.test(u)), 'ảnh vật liệu nạp sai đường dẫn: ' + texUrls.find((u) => /tuong-chan\/tex|text\/html/.test(u)));
      await page.click('.modsw a[data-mod="culvert"]');
      await page.waitForSelector('.cv-nav .tabs .tab');
      assert.equal(new URL(page.url()).pathname, '/cau-cong/');
      assert.equal(await theme(), 'light');
      await page.click('.modsw a[data-mod="home"]');
      await page.waitForSelector('.lp-card');
      assert.equal(new URL(page.url()).pathname, '/');
      return 'đường dẫn đúng, giao diện giữ nguyên';
    });

    await step('C-2 Cầu cống: nhóm mục, MathJax, kết quả tính sẵn, chấm trạng thái', async () => {
      await page.goto(ORIGIN + '/cau-cong/');
      await page.waitForSelector('.cv-nav .tabs .tab');
      await page.waitForTimeout(3500);
      const groups = await page.$$eval('.cv-nav .tabs .tgrp', (a) => a.map((x) => x.textContent.trim()));
      assert.ok(groups.length >= 5, 'nhóm mục: ' + groups.join('|'));
      assert.ok(groups.includes('Kết cấu nhịp') && groups.includes('Mố') && groups.includes('Trụ'));
      await page.click('.cv-nav .tab[data-t="5"]');
      await page.waitForTimeout(1500);
      const svgEq = await page.$$eval('#tab5 .m svg', (a) => a.length);
      assert.ok(svgEq > 10, 'công thức MathJax dạng SVG: ' + svgEq);
      const filled = await page.$$eval('#tab5 .row .val', (a) =>
        a.filter((v) => (v.querySelector('input,select') ? v.querySelector('input,select').value : v.textContent).trim()).length,
      );
      assert.ok(filled > 200, 'ô có số liệu sau khi mở trang: ' + filled);
      const dots = await page.$$eval('.cv-nav .tab[data-st]', (a) => a.length);
      assert.ok(dots >= 5, 'chấm trạng thái: ' + dots);
      return `nhóm=${groups.length}, công thức svg=${svgEq}, ô có số=${filled}, chấm=${dots}`;
    });

    await step('C-2b Bản quá độ có đủ 7 hình; dầm, đầu cọc, mũi cọc có đủ bảng / dòng diễn giải', async () => {
      await page.click('.cv-nav .tab[data-t="43"]');
      await page.waitForTimeout(1200);
      const figs = await page.$$eval('#tab43 svg.dg', (a) => a.map((s) => s.id + ':' + s.children.length));
      assert.equal(figs.length, 7, figs.join(' '));
      assert.ok(figs.every((f) => Number(f.split(':')[1]) > 10), 'hình trống: ' + figs.join(' '));
      const klQd = await page.textContent('#klQd');
      assert.match(klQd || '', /ĐẠT/);
      // dầm bản rỗng: bảng đặc trưng hình học + ô kết quả
      await page.click('.cv-nav .tab[data-t="8"]');
      await page.waitForTimeout(800);
      const sec = await page.$eval('#tbgSec', (e) => e.rows.length);
      assert.ok(sec >= 4, 'tbgSec: ' + sec);
      assert.ok(((await page.textContent('#o_g_Lh')) || '').trim().length > 0, 'o_g_Lh trống');
      // nội lực đầu cọc: 6 bảng
      await page.click('.cv-nav .tab[data-t="1"]');
      await page.waitForTimeout(800);
      for (const id of ['tbLoads', 'tbDisp', 'tbPF', 'tbSumMC', 'tbChk', 'tbMax']) {
        assert.ok((await page.$eval('#' + id, (e) => e.rows.length)) >= 3, 'bảng ' + id + ' trống');
      }
      // mũi cọc khoan nhồi: đủ dòng diễn giải (qu, GSI, A, qp,HB…)
      await page.click('.cv-nav .tab[data-t="2"]');
      await page.waitForTimeout(800);
      const tip = (await page.textContent('#s2tip')) || '';
      assert.ok(/Chỉ số GSI/.test(tip) && /qp,HB/.test(tip) && /Hệ số nhóm cọc/.test(tip), 'thiếu dòng diễn giải mũi cọc');
      return `hình=${figs.length}, tbgSec=${sec} dòng, 6 bảng đầu cọc, diễn giải mũi cọc đủ`;
    });

    await step('C-3 Ô tìm mục (không dấu) lọc đúng', async () => {
      const before = await page.$$eval('.cv-nav .tabs .tab:not([hidden]):not([data-qhide])', (a) => a.length);
      await page.fill('#cvNavQ', 'coc');
      await page.waitForTimeout(250);
      const shown = await page.$$eval('.cv-nav .tabs .tab:not([hidden]):not([data-qhide])', (a) => a.map((x) => x.textContent.trim()));
      assert.ok(shown.length >= 4, 'số mục: ' + shown.length);
      assert.ok(shown.every((t) => /cọc/i.test(t)), 'có mục không chứa "cọc": ' + shown.join('|'));
      await page.fill('#cvNavQ', '');
      await page.waitForTimeout(250);
      const all = await page.$$eval('.cv-nav .tabs .tab:not([hidden]):not([data-qhide])', (a) => a.length);
      assert.equal(all, before, 'sau khi xóa ô tìm: ' + all + ' ≠ ' + before);
      return `"coc" → ${shown.length} mục; xóa → ${all} mục`;
    });

    await step('C-4 Bảy loại bảng tính: số mục hiển thị đúng', async () => {
      const seen = [];
      for (const [mode, n] of Object.entries(STANDALONE_TABS)) {
        await page.selectOption('#appMode', mode);
        await page.waitForTimeout(600);
        const c = await page.$$eval('.cv-nav .tabs .tab:not([hidden]):not([data-qhide])', (a) => a.length);
        assert.equal(c, n, `${mode}: ${c} mục, kỳ vọng ${n}`);
        seen.push(`${mode}=${c}`);
      }
      await page.selectOption('#appMode', 'cau');
      await page.waitForTimeout(600);
      return seen.join(' ');
    });

    await step('C-5 Bộ kiểm chứng phần mềm (VT) trong trình duyệt: không có mục lỗi', async () => {
      await page.click('.cv-nav .tab[data-t="60"]');
      await page.click('#vt_run');
      await page.waitForFunction(() => /Tổng số kiểm tra/.test(document.getElementById('vt_sum')?.textContent || ''), null, {
        timeout: 60000,
      });
      const txt = await page.textContent('#vt_sum');
      const m = /Tổng số kiểm tra: (\d+) ; đạt: (\d+) ; không đạt: (\d+)/.exec(txt || '');
      assert.ok(m, 'định dạng: ' + txt);
      assert.equal(Number(m[3]), 0, txt);
      assert.equal(m[1], m[2], txt);
      assert.ok(Number(m[1]) >= 106, 'ít nhất 106 phép kiểm: ' + m[1]);
      return `${m[2]}/${m[1]} đạt`;
    });

    await step('C-6 Xuất Excel (.xlsx) và PDF hợp lệ', async () => {
      await page.click('.cv-nav .tab[data-t="7"]');
      const dl1 = page.waitForEvent('download', { timeout: 90000 });
      await page.click('#btnX');
      const d1 = await dl1;
      const p1 = path.join(dlDir, d1.suggestedFilename());
      await d1.saveAs(p1);
      const xb = fs.readFileSync(p1);
      assert.equal(xb.subarray(0, 2).toString(), 'PK');
      const names = zipNames(xb);
      assert.ok(names.includes('xl/workbook.xml') && names.filter((n) => n.startsWith('xl/worksheets/sheet')).length >= 3, 'cấu trúc xlsx');
      const dl2 = page.waitForEvent('download', { timeout: 120000 });
      await page.click('#btnP');
      const d2 = await dl2;
      const p2 = path.join(dlDir, d2.suggestedFilename());
      await d2.saveAs(p2);
      const pb = fs.readFileSync(p2);
      assert.equal(pb.subarray(0, 5).toString(), '%PDF-');
      const pdf = await PDFDocument.load(pb);
      assert.ok(pdf.getPageCount() >= 1);
      return `xlsx ${xb.length} B (${names.length} phần), pdf ${pb.length} B (${pdf.getPageCount()} trang)`;
    });

    await step('C-7 Lưu / mở số liệu (.json): khứ hồi giữ nguyên dữ liệu nhập', async () => {
      await page.fill('#pj1', 'DỰ ÁN KIỂM THỬ E2E');
      await page.fill('#pj5', 'Người tính E2E');
      const dl = page.waitForEvent('download', { timeout: 30000 });
      await page.click('#btnSv');
      const d = await dl;
      const pth = path.join(dlDir, 'save.json');
      await d.saveAs(pth);
      const raw = fs.readFileSync(pth, 'utf8');
      const obj = JSON.parse(raw);
      assert.ok(obj && typeof obj === 'object');
      assert.ok(raw.includes('DỰ ÁN KIỂM THỬ E2E'));
      await page.fill('#pj1', '');
      await page.setInputFiles('#fOp', pth);
      await page.waitForFunction(() => document.getElementById('pj1').value === 'DỰ ÁN KIỂM THỬ E2E', null, { timeout: 15000 });
      assert.equal(await page.inputValue('#pj5'), 'Người tính E2E');
      return `json ${raw.length} B, mở lại khôi phục pj1/pj5`;
    });

    await step('C-8 Điện thoại 390 px: không tràn ngang, có hàng tab', async () => {
      const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const mp = await mctx.newPage();
      await mp.goto(ORIGIN + '/cau-cong/');
      await mp.waitForSelector('.cv-nav .tabs .tab');
      await mp.waitForTimeout(2500);
      const o = await mp.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
        sheet: document.getElementById('sheet').getBoundingClientRect().width,
      }));
      await mctx.close();
      assert.ok(o.sw <= o.cw + 1, `tràn ngang ${o.sw}>${o.cw}`);
      assert.ok(o.sheet <= o.cw, 'tờ bảng tính rộng ' + o.sheet);
      return `viewport ${o.cw}, tờ bảng tính ${Math.round(o.sheet)} px`;
    });

    await step('C-0z Không lỗi console / mạng', async () => {
      assert.deepEqual(consoleErrors, [], 'console: ' + consoleErrors.join(' || '));
      assert.deepEqual(httpErrors, [], 'http: ' + httpErrors.join(' || '));
      assert.deepEqual(failed, [], 'failed: ' + failed.join(' || '));
      return '0 lỗi console, 0 HTTP >= 400, 0 request hỏng';
    });
  } finally {
    if (browser) await browser.close().catch(() => {});
    killTree(preview);
    fs.rmSync(dlDir, { recursive: true, force: true });
  }

  const failedN = results.filter((r) => !r.ok).length;
  console.log(`\n=== ${results.length - failedN}/${results.length} PASS ===`);
  process.exit(failedN ? 1 : 0);
}

run();
