import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { chromium } from 'playwright-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEBAPP_DIR = path.resolve(__dirname, '../..');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PREVIEW_PORT = 4191;
const ORIGIN = `http://127.0.0.1:${PREVIEW_PORT}`;

function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          resolve();
        } else if (Date.now() - start > timeoutMs) {
          reject(new Error(`Server returned ${res.statusCode}`));
        } else {
          setTimeout(attempt, 200);
        }
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
        } else {
          setTimeout(attempt, 200);
        }
      });
    };
    attempt();
  });
}

function killProcessTree(proc) {
  if (!proc || proc.killed) return;
  try {
    if (process.platform === 'win32') {
      execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      proc.kill('SIGKILL');
    }
  } catch {
    // ignore if already exited
  }
}

async function assertAllImagesLoaded(page, contextLabel) {
  await page
    .waitForFunction(
      () => Array.from(document.querySelectorAll('img')).every((img) => img.complete),
      undefined,
      { timeout: 5000 },
    )
    .catch(() => {});
  const broken = await page.evaluate(() =>
    Array.from(document.querySelectorAll('img'))
      .filter((img) => !img.complete || img.naturalWidth === 0)
      .map((img) => img.getAttribute('src') || img.alt || '(unknown)'),
  );
  assert.deepEqual(broken, [], `${contextLabel}: broken <img> elements: ${broken.join(', ')}`);
}

async function captureDownload(page, triggerFn, downloadDir, prefix) {
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), triggerFn()]);
  const filename = download.suggestedFilename();
  const outPath = path.join(downloadDir, `${prefix}_${filename}`);
  await download.saveAs(outPath);
  return { filename, bytes: fs.readFileSync(outPath) };
}

async function clickTreeItem(page, labelPart) {
  await page.locator('[role="treeitem"]').filter({ hasText: labelPart }).first().click();
  await page.waitForTimeout(40);
}

async function assertSubmenuUnclipped(page, label) {
  const menu = page.locator('.adm-rib-submenu');
  await menu.waitFor({ state: 'visible' });
  const info = await menu.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const btns = Array.from(el.querySelectorAll('button')).map((b) => {
      const br = b.getBoundingClientRect();
      const cx = br.left + br.width / 2;
      const cy = br.top + br.height / 2;
      const topEl = document.elementFromPoint(cx, cy);
      return {
        text: (b.textContent || '').trim(),
        w: br.width,
        h: br.height,
        top: br.top,
        bottom: br.bottom,
        left: br.left,
        right: br.right,
        clickable: Boolean(topEl && (topEl === b || b.contains(topEl))),
      };
    });
    return {
      position: getComputedStyle(el).position,
      rect: { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height },
      scrollH: el.scrollHeight,
      clientH: el.clientHeight,
      vw: window.innerWidth,
      vh: window.innerHeight,
      btns,
    };
  });
  assert.equal(info.position, 'fixed', `${label}: expected position:fixed, got ${info.position}`);
  assert.ok(info.scrollH <= info.clientH + 1, `${label}: submenu vertically clipped (${info.scrollH} > ${info.clientH})`);
  assert.ok(info.rect.top >= 0 && info.rect.bottom <= info.vh, `${label}: submenu out of viewport Y: ${JSON.stringify(info.rect)}`);
  assert.ok(info.rect.left >= 0 && info.rect.right <= info.vw, `${label}: submenu out of viewport X: ${JSON.stringify(info.rect)}`);
  assert.ok(info.btns.length >= 1, `${label}: expected >=1 submenu buttons`);
  for (const b of info.btns) {
    assert.ok(b.h > 10 && b.w > 20, `${label}: button "${b.text}" collapsed: ${JSON.stringify(b)}`);
    assert.ok(b.top >= info.rect.top - 1 && b.bottom <= info.rect.bottom + 1, `${label}: button "${b.text}" clipped by submenu`);
    assert.ok(b.clickable, `${label}: button "${b.text}" obscured at center`);
  }
  return info;
}

async function run() {
  assert.ok(fs.existsSync(CHROME_PATH), `Chrome not found at ${CHROME_PATH}`);
  const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toando_merged_e2e_'));

  const viteBin = path.join(WEBAPP_DIR, 'node_modules', 'vite', 'bin', 'vite.js');
  const previewProc = spawn(
    process.execPath,
    [viteBin, 'preview', '--host', '127.0.0.1', '--port', String(PREVIEW_PORT), '--strictPort'],
    { cwd: WEBAPP_DIR, stdio: ['ignore', 'pipe', 'pipe'] },
  );

  let serverLogs = '';
  previewProc.stdout.on('data', (d) => {
    serverLogs += d.toString();
  });
  previewProc.stderr.on('data', (d) => {
    serverLogs += d.toString();
  });

  let browser;
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const httpErrors = [];
  const results = [];

  const record = (name, detail) => {
    results.push({ name, detail });
    console.log(`[PASS] ${name} — ${detail}`);
  };

  try {
    await waitForServer(`${ORIGIN}/`, 15000);

    browser = await chromium.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'],
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      acceptDownloads: true,
    });
    context.on('response', (res) => {
      if (res.status() >= 400) {
        httpErrors.push(`${res.status()} ${res.url()}`);
      }
    });

    const page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const loc = msg.location()?.url ? ` @ ${msg.location().url}` : '';
        consoleErrors.push(`${msg.text()}${loc}`);
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message || String(err));
    });
    page.on('requestfailed', (req) => {
      failedRequests.push(`${req.url()} (${req.failure()?.errorText || 'failed'})`);
    });
    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'confirm') await dialog.accept();
      else if (dialog.type() === 'prompt') await dialog.accept('QA_Merged_Save.adm');
      else await dialog.dismiss();
    });

    // T-0: Landing page renders 5 module cards and navigates to /toan-do/
    await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.lp-card');
    const landingCards = await page.$$eval('.lp-card', (els) =>
      els.map((e) => ({ mod: e.getAttribute('data-mod'), href: e.getAttribute('href') })),
    );
    assert.deepEqual(
      landingCards.map((c) => c.mod),
      ['walls', 'culvert', 'hoga', 'pavement', 'toando'],
      `Unexpected landing cards: ${JSON.stringify(landingCards)}`,
    );
    assert.ok(landingCards[4].href?.endsWith('toan-do/'), `5th card href mismatch: ${landingCards[4].href}`);
    const toandoCardTitle = ((await page.locator('.lp-card[data-mod="toando"] h2').textContent()) ?? '').trim();
    assert.equal(toandoCardTitle, 'Kiểm toán áo đường', `5th card title mismatch: ${toandoCardTitle}`);
    const noteText = (await page.locator('.lp-note').textContent()) ?? '';
    assert.ok(noteText.includes('Năm phân hệ'), `Landing note mismatch: ${noteText}`);

    await Promise.all([
      page.waitForURL('**/toan-do/**'),
      page.click('.lp-card[data-mod="toando"]'),
    ]);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="window-title"]');

    const docTitle = await page.title();
    assert.equal(docTitle, 'LEDAT-BIM · Kiểm toán áo đường (TCCS 38:2022)', `Unexpected title: ${docTitle}`);
    const brandText = (await page.locator('.hdr .brand').textContent()) ?? '';
    assert.ok(brandText.includes('LEDAT-BIM') && brandText.includes('Kiểm toán áo đường'), `Header mismatch: ${brandText}`);
    const modSwitchLabel = ((await page.locator('.modsw a[data-mod="toando"] .modsw-full').textContent()) ?? '').trim();
    assert.equal(modSwitchLabel, 'Kiểm toán áo đường', `ModuleSwitch label mismatch: ${modSwitchLabel}`);
    assert.equal(await page.locator('.modsw a[data-mod="toando"]').getAttribute('aria-current'), 'page');
    assert.equal(await page.locator('[role="tab"]').count(), 1, 'Expected only 1 active tab in .adm-page-tabs');
    const initTabText = ((await page.locator('[role="tab"][aria-selected="true"]').textContent()) ?? '').trim();
    assert.ok(initTabText.includes('Thông tin dự án'), `Unexpected active tab: ${initTabText}`);
    await assertAllImagesLoaded(page, '/toan-do/ initial load');
    record('T-0 Landing (5 modules) -> /toan-do/ & LEDAT-BIM Header', '5 cards, ModuleSwitch active, 1 active tab pill, images ok');

    // T-1: Theme toggle #bTheme & persistence
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
    await page.click('#bTheme');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
    assert.equal(await page.evaluate(() => localStorage.getItem('tuong-chan-btct:theme')), 'dark');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="window-title"]');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
    await page.click('#bTheme');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
    record('T-1 Theme Toggle (#bTheme) & Reload Persistence', 'light -> dark -> reload(dark) -> light');

    // T-2: TreeNav, input tabs, edit layer & F5 verification
    await page.locator('#ed_CongTrinh').fill('Dự án QA Hợp nhất');
    await page.locator('[role="treeitem"]:has-text("Quy mô thiết kế")').click();
    await page.waitForSelector('[data-testid="tab-quy-mo"]');

    await page.locator('[role="treeitem"]:has-text("Lưu lượng xe và quy đổi")').click();
    await page.waitForSelector('[data-testid="tab-luu-luong"]');

    await page.locator('[role="treeitem"]:has-text("Đất nền")').click();
    await page.waitForSelector('[data-testid="tab-dat-nen"]');

    await page.locator('[role="treeitem"]:has-text("Thông số thiết kế áo đường")').click();
    await page.waitForSelector('[data-testid="tab-thong-so"]');
    await page.locator('button:has-text("Tham khảo")').click();
    await page.waitForSelector('[aria-label="Chọn loại tầng mặt theo TCCS 38:2022"]');
    await assertAllImagesLoaded(page, 'ThamKhaoTangMatModal');
    await page.locator('.adm-modal-close').click();

    await page.locator('[role="treeitem"]:has-text("Kết cấu áo đường - Phương án")').first().click();
    await page.waitForSelector('[data-testid="tab-ket-cau"]');
    await page.locator('button:has-text("Thêm lớp tầng mặt")').click();
    await page.locator('button:has-text("Thêm lớp tầng móng")').click();
    await page.locator('[data-testid="table-kcad"] tbody tr').first().locator('button:has-text("▾")').click();
    await page.waitForSelector('.adm-mat-dropdown');
    await page.locator('.adm-mat-opt:not(.group)').first().click();
    await page.locator('[data-testid="btn-save-kcad"]').click();
    await page.keyboard.press('F5');
    await page.waitForSelector('[data-testid="tab-verify-vong"]');
    record('T-2 TreeNav, Input Tabs, Layer Edit & F5 Verification', 'All input tabs, Tham khảo modal, layer add/pick/save, F5 ok');

    // T-3: Load Sample Projects (D.1 & Ch.10) + Verification Reports + Equation Images
    await page.locator('[data-testid="btn-load-sample"]').click();
    await page.waitForTimeout(80);
    const d1Title = (await page.locator('[data-testid="window-title"]').textContent()) ?? '';
    assert.ok(d1Title.includes('Phụ lục D.1'), `Unexpected D.1 sample title: ${d1Title}`);
    await page.keyboard.press('F5');
    await page.waitForSelector('[data-testid="tab-verify-vong"]');
    await assertAllImagesLoaded(page, 'Verify Độ võng (D.1)');
    const vongText = (await page.locator('[data-report="rv_Vong"]').textContent()) ?? '';
    assert.ok(vongText.includes('TCCS 38:2022/TCĐBVN'), 'rv_Vong missing TCCS 38:2022/TCĐBVN');

    await clickTreeItem(page, 'Cắt trượt');
    await page.waitForSelector('[data-testid="tab-verify-truot"]');
    assert.equal(await page.locator('[role="tab"]').count(), 1, 'Expected 1 active tab after switching to Cắt trượt');
    await assertAllImagesLoaded(page, 'Verify Cắt trượt (D.1)');

    await clickTreeItem(page, 'Kéo uốn');
    await page.waitForSelector('[data-testid="tab-verify-keo-uon"]');
    assert.equal(await page.locator('[role="tab"]').count(), 1, 'Expected 1 active tab after switching to Kéo uốn');
    await assertAllImagesLoaded(page, 'Verify Kéo uon (D.1)');

    await page.locator('[data-testid="btn-load-sample-ch10"]').click();
    await page.waitForTimeout(80);
    assert.ok(
      (await page.locator('[role="treeitem"]:has-text("Áo đường cũ (Chương 10)")').count()) >= 1,
      'Expected Áo đường cũ (Chương 10) node in TreeNav',
    );
    await clickTreeItem(page, 'Áo đường cũ (Chương 10)');
    await page.waitForSelector('[data-testid="tab-ao-duong-cu"]');
    assert.equal(await page.locator('[role="tab"]').count(), 1, 'Expected 1 active tab in Ch.10 mode');
    assert.ok(((await page.locator('[role="tab"]').textContent()) ?? '').includes('Áo đường cũ (Chương 10)'));
    await page.keyboard.press('F5');
    await page.waitForSelector('[data-testid="tab-verify-vong"]');
    record('T-3 Sample Projects (D.1 & Ch.10) + Reports + Equation Images', 'D.1 + Ch.10 (TreeNav) + Vong/Truot/KeoUon equation imgs ok');

    // T-4: Toán đồ 3-1..3-6 Images & Trace + Material DB
    await page.locator('.adm-ribbon-tab:has-text("CÔNG CỤ")').click();
    const tdOutputs = [];
    for (const id of ['3-1', '3-2', '3-3', '3-4', '3-5', '3-6']) {
      await page.locator(`.adm-rib-large-btn:has-text("Toán đồ ${id}")`).click();
      await page.waitForSelector(`[data-testid="tab-toando-${id}"]`);
      await assertAllImagesLoaded(page, `Toán đồ ${id}`);
      const imgW = await page.locator(`[data-testid="tab-toando-${id}"] img`).evaluate((im) => im.naturalWidth);
      assert.ok(imgW > 0, `Toán đồ ${id} image naturalWidth <= 0`);
      const lines = await page.locator(`[data-testid="tab-toando-${id}"] svg line`).count();
      assert.ok(lines >= 2, `Toán đồ ${id} expected >=2 trace lines, got ${lines}`);
      const outVal = await page.locator(`#td-${id}-out`).inputValue();
      assert.notEqual(outVal, '#N/A', `Toán đồ ${id} yielded #N/A`);
      tdOutputs.push(`${id}:${outVal}`);
    }

    await page.locator('.adm-rib-large-btn:has-text("Load database vật liệu")').click();
    await page.waitForSelector('[data-testid="tab-sua-vat-lieu"]');
    const matRows = await page.locator('[data-testid="table-edit-vat-lieu"] tbody tr').count();
    assert.equal(matRows, 86, `Expected 86 TCCS 38:2022 material rows, got ${matRows}`);

    // Verify "Lưu database vật liệu ▾" submenu renders unclipped and exports VatLieu.dat
    await page.locator('.adm-rib-large-btn:has-text("Lưu database vật liệu")').click();
    const vlMenuInfo = await assertSubmenuUnclipped(page, 'Lưu database vật liệu');
    const vlDl = await captureDownload(
      page,
      () => page.locator('.adm-rib-submenu button:has-text("Xuất file VatLieu.dat")').click(),
      downloadDir,
      'vl',
    );
    assert.equal(vlDl.bytes.subarray(0, 11).toString('ascii'), 'ADM ver 2.0');
    record(
      'T-4 Toán đồ 3-1..3-6 Images, Material DB & VL Submenu',
      `${tdOutputs.join(', ')}; MaterialDB=${matRows} rows; vlMenu=${vlMenuInfo.btns.length} opts unclipped, dat=${vlDl.bytes.byteLength}B`,
    );

    // T-5: Help Modals + Excel (.xlsx) & .adm Downloads
    await page.locator('.adm-ribbon-tab:has-text("GIÚP ĐỠ")').click();
    assert.equal(
      await page.locator('.adm-rib-large-btn:has-text("Về chương trình")').count(),
      0,
      'Expected "Về chương trình" button to be removed',
    );

    await page.locator('.adm-rib-large-btn:has-text("TCCS 38:2022")').click();
    await page.waitForSelector('[aria-label="Tiêu chuẩn TCCS 38:2022/TCĐBVN"]');
    await page.locator('[role="dialog"] button:has-text("Đóng")').click();

    await page.locator('.adm-ribbon-tab:has-text("HOME")').click();
    await page.locator('[data-testid="btn-load-sample"]').click();
    await page.waitForTimeout(80);

    const xlsxDl = await captureDownload(
      page,
      async () => {
        await page.locator('[data-testid="btn-export-excel"]').click();
        await page.waitForSelector('[aria-label="Xuất kết quả sang Excel"]');
        await page.locator('[aria-label="Xuất kết quả sang Excel"] button:has-text("OK")').click();
      },
      downloadDir,
      'xlsx',
    );
    assert.ok(xlsxDl.filename.endsWith('.xlsx'), `Unexpected xlsx filename: ${xlsxDl.filename}`);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(xlsxDl.bytes);
    assert.ok(wb.worksheets.length >= 1, 'Expected >=1 worksheet in exported .xlsx');
    let formulaCount = 0;
    for (const ws of wb.worksheets) {
      ws.eachRow((row) =>
        row.eachCell((c) => {
          if (c.value && typeof c.value === 'object' && 'formula' in c.value) formulaCount++;
        }),
      );
    }
    assert.ok(formulaCount >= 100, `Expected >=100 live formulas, got ${formulaCount}`);

    // Verify "Lưu ▾" ribbon submenu renders unclipped and exports .adm
    await page.locator('.adm-rib-dropdown-wrap .adm-rib-large-btn:has-text("Lưu")').click();
    const saveMenuInfo = await assertSubmenuUnclipped(page, 'Lưu');
    const admDl = await captureDownload(
      page,
      () => page.locator('.adm-rib-submenu button:has-text("Lưu dự án")').click(),
      downloadDir,
      'adm',
    );
    assert.equal(admDl.bytes.subarray(0, 11).toString('ascii'), 'ADM ver 2.0');
    record(
      'T-5 Help Modal, "Lưu ▾" Unclipped Submenu & Real Downloads (.xlsx + .adm)',
      `saveMenu=${saveMenuInfo.btns.length} opts unclipped, xlsx=${xlsxDl.bytes.byteLength}B (${formulaCount} formulas), adm=${admDl.bytes.byteLength}B`,
    );

    // T-6: Mobile 390px layout & Spot-check /tuong-chan/ and /mat-duong/
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${ORIGIN}/toan-do/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="window-title"]');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 2, `Mobile horizontal overflow on /toan-do/: ${overflow}px`);
    await page.locator('.adm-mobile-tree-btn').click();
    await page.waitForSelector('.adm-tree-pane.open');

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.click('#bTheme'); // set dark theme to verify cross-module persistence

    await Promise.all([
      page.waitForURL('**/tuong-chan/**'),
      page.click('.modsw a[data-mod="walls"]'),
    ]);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('#calcBadge');
    await page.waitForSelector('#v3d');
    await page.locator('#tabs > button').first().click();
    await page.waitForSelector('#stage svg');
    assert.equal(await page.locator('.app-shell').getAttribute('data-theme'), 'dark');

    await Promise.all([
      page.waitForURL('**/mat-duong/**'),
      page.click('.modsw a[data-mod="pavement"]'),
    ]);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('#overall');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
    record('T-6 Mobile 390px + Spot-check /tuong-chan/ & /mat-duong/', 'mobile overflow<=2px, walls & pavement load & keep dark theme');

    assert.deepEqual(consoleErrors, [], `Console errors: ${consoleErrors.join(' | ')}`);
    assert.deepEqual(pageErrors, [], `Page errors: ${pageErrors.join(' | ')}`);
    assert.deepEqual(failedRequests, [], `Failed requests: ${failedRequests.join(' | ')}`);
    assert.deepEqual(httpErrors, [], `HTTP >=400 errors: ${httpErrors.join(' | ')}`);

    console.log(`E2E_TOANDO_PASS: ${results.length}/${results.length} checks passed, 0 console/page/HTTP errors`);
  } catch (err) {
    console.error('E2E_TOANDO_FAIL:', err);
    if (serverLogs.trim()) console.error('Preview server logs:\n', serverLogs);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    killProcessTree(previewProc);
    fs.rmSync(downloadDir, { recursive: true, force: true });
  }
}

run();
