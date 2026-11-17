import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SHOT_DIR = path.resolve(ROOT, '..', 'analysis-kcad', 'merged-screenshots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const PORT = 4183;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function findChrome() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('No Chrome/Edge executable found');
}

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--host', '127.0.0.1', '--strictPort'], {
  cwd: ROOT,
  shell: true,
  stdio: 'ignore',
});

let browser;
try {
  await waitForServer(`${BASE_URL}/`);
  browser = await chromium.launch({
    executablePath: findChrome(),
    headless: true,
    args: ['--no-sandbox', '--disable-gpu-sandbox'],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();

  const consoleErrors = [];
  const httpErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));
  page.on('response', (res) => {
    if (res.status() >= 400) httpErrors.push(`${res.status()} ${res.url()}`);
  });

  // P-0: Landing page has 4 modules linking to tuong-chan/, cau-cong/, ho-ga/, mat-duong/
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.lp-card');
  await page.waitForTimeout(2200);
  const cards = await page.$$eval('.lp-card', (els) => els.map((e) => ({ mod: e.dataset.mod, href: e.getAttribute('href') })));
  if (cards.length !== 4 || !cards[3].href?.endsWith('mat-duong/')) {
    throw new Error(`Unexpected landing cards: ${JSON.stringify(cards)}`);
  }
  await page.screenshot({ path: path.join(SHOT_DIR, '0_landing.png') });

  // Navigate to /mat-duong/ via the landing card
  await Promise.all([
    page.waitForURL('**/mat-duong/**'),
    page.click('.lp-card[data-mod="pavement"]'),
  ]);
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('#overall');

  // P-1: Standard selector without banner photo & default TCCS 39 Rigid view (light mode)
  const bannerState = await page.evaluate(() => ({
    hasPhoto: document.querySelectorAll('.stdnav-photo, #stdNav img').length > 0,
    stdBtns: document.querySelectorAll('#stdNav .stdbtn').length,
  }));
  if (bannerState.hasPhoto || bannerState.stdBtns !== 3) {
    throw new Error(`Unexpected standard selector state: ${JSON.stringify(bannerState)}`);
  }

  const rigidVerdict = await page.locator('#overall').textContent();
  if (!rigidVerdict?.includes('KẾT CẤU ĐẠT YÊU CẦU theo TCCS 39')) {
    throw new Error(`Unexpected rigid verdict: ${rigidVerdict}`);
  }
  const activeSwitch = await page.locator('.modsw a[data-mod="pavement"]').getAttribute('aria-current');
  if (activeSwitch !== 'page') throw new Error(`Expected pavement aria-current=page, got ${activeSwitch}`);
  await page.screenshot({ path: path.join(SHOT_DIR, '1_mat_duong_light.png') });

  // P-2: TCVN dropdown
  await page.click('#btnTCVN');
  const menuHidden = await page.locator('#tcvnMenu').getAttribute('hidden');
  if (menuHidden !== null) throw new Error('#tcvnMenu did not open');
  await page.keyboard.press('Escape');

  // P-3: Drain & Joint tabs
  await page.click('.tab[data-tab="drain"]');
  await page.waitForSelector('#mod-drain:not([hidden])');
  const drainText = await page.locator('#d_out').textContent();
  if (!drainText?.includes('1,6800') || !drainText?.includes('4,500')) {
    throw new Error(`Unexpected drain output: ${drainText}`);
  }

  await page.click('.tab[data-tab="joint"]');
  await page.waitForSelector('#mod-joint:not([hidden])');
  const jointText = await page.locator('#j_out').textContent();
  if (!jointText?.includes('14×700×700 mm') || !jointText?.includes('Ø30 mm')) {
    throw new Error(`Unexpected joint output: ${jointText}`);
  }

  // Return to rigid & test Word / Excel download
  await page.click('.tab[data-tab="rigid"]');
  const [wordDl] = await Promise.all([page.waitForEvent('download'), page.click('#btnWord')]);
  if (!wordDl.suggestedFilename().endsWith('.doc')) {
    throw new Error(`Unexpected Word filename: ${wordDl.suggestedFilename()}`);
  }
  const [xlsDl] = await Promise.all([page.waitForEvent('download'), page.click('#btnXls')]);
  if (!xlsDl.suggestedFilename().endsWith('.xlsx')) {
    throw new Error(`Unexpected Excel filename: ${xlsDl.suggestedFilename()}`);
  }

  // P-4: TCCS 38 Flex & TCCS 37 + Dark theme verification
  await page.click('#bTheme');
  const themeAfterToggle = await page.evaluate(() => ({
    attr: document.documentElement.dataset.theme,
    stored: localStorage.getItem('tuong-chan-btct:theme'),
  }));
  if (themeAfterToggle.attr !== 'dark' || themeAfterToggle.stored !== 'dark') {
    throw new Error(`Theme toggle failed: ${JSON.stringify(themeAfterToggle)}`);
  }

  await page.click('.stdbtn[data-std="38"]');
  await page.waitForSelector('#mod-flex:not([hidden])');
  const flexTc1 = await page.locator('#f_tc1out').textContent();
  const flexOverall = await page.locator('#f_overall').textContent();
  if (!flexTc1?.includes('198,5') || !flexTc1?.includes('221,') || !flexOverall?.includes('KẾT CẤU CHƯA ĐẠT')) {
    throw new Error(`Unexpected TCCS 38 output: ${flexTc1} | ${flexOverall}`);
  }
  const vehFit = await page.evaluate(() => {
    const box = document.getElementById('f_vehtbody')?.getBoundingClientRect();
    const ni = document.querySelector('#f_vehtbody input[data-vk="ni"]')?.getBoundingClientRect();
    const del = document.querySelector('#f_vehtbody button[data-vdel="0"]')?.getBoundingClientRect();
    return {
      boxRight: Math.round(box?.right ?? 0),
      niRight: Math.round(ni?.right ?? 0),
      delRight: Math.round(del?.right ?? 0),
      niWidth: Math.round(ni?.width ?? 0),
    };
  });
  if (vehFit.niWidth < 45 || vehFit.delRight > vehFit.boxRight + 2) {
    throw new Error(`TCCS 38 vehicle table clipped: ${JSON.stringify(vehFit)}`);
  }
  await page.locator('#f_vehtbody').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(SHOT_DIR, '2_tccs38_veh_dark.png') });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(SHOT_DIR, '2_tccs38_dark.png') });

  await page.click('.stdbtn[data-std="37"]');
  await page.waitForSelector('#mod-sn37:not([hidden])');
  const snNewText = await page.locator('#g_snout').textContent();
  if (!snNewText?.includes('4,616')) {
    throw new Error(`Unexpected TCCS 37 New SN: ${snNewText?.slice(0, 200)}`);
  }
  await page.click('.g-sub[data-sub="ol"]');
  const olText = await page.locator('#g_ol_result').textContent();
  if (!olText?.includes('5,7')) throw new Error(`Unexpected TCCS 37 Overlay: ${olText}`);

  await page.click('.g-sub[data-sub="low"]');
  const lowText = await page.locator('#g_low_sn').textContent();
  if (!lowText?.includes('2,4–2,6')) throw new Error(`Unexpected TCCS 37 Low: ${lowText}`);
  await page.screenshot({ path: path.join(SHOT_DIR, '3_tccs37_dark.png') });

  // P-5: Cross-module navigation keeps dark theme
  await Promise.all([
    page.waitForURL('**/tuong-chan/**'),
    page.click('.modsw a[data-mod="walls"]'),
  ]);
  const wallsTheme = await page.evaluate(() => localStorage.getItem('tuong-chan-btct:theme'));
  if (wallsTheme !== 'dark') throw new Error(`Theme not preserved across modules: ${wallsTheme}`);

  // P-6: Mobile 390px layout check on /mat-duong/
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE_URL}/mat-duong/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#overall');
  const overflowInfo = await page.evaluate(() => {
    const vw = window.innerWidth;
    const offenders = [...document.querySelectorAll('*')]
      .map((el) => ({ tag: el.tagName, cls: el.className, id: el.id, right: Math.round(el.getBoundingClientRect().right) }))
      .filter((x) => x.right > vw)
      .slice(0, 6);
    return { overflow: document.documentElement.scrollWidth - vw, offenders };
  });
  if (overflowInfo.overflow > 2) {
    throw new Error(`Mobile horizontal overflow on /mat-duong/: ${overflowInfo.overflow}px -> ${JSON.stringify(overflowInfo.offenders)}`);
  }
  await page.screenshot({ path: path.join(SHOT_DIR, '4_mobile_dark.png') });

  if (consoleErrors.length > 0) throw new Error(`Console errors: ${consoleErrors.join(' | ')}`);
  if (httpErrors.length > 0) throw new Error(`HTTP errors: ${httpErrors.join(' | ')}`);

  console.log('E2E_PAVEMENT_PASS: 7/7 checks passed, 5 screenshots captured, 0 console/HTTP errors');
} finally {
  if (browser) await browser.close();
  if (preview.pid) {
    spawnSync('taskkill', ['/pid', String(preview.pid), '/T', '/F'], { stdio: 'ignore' });
  }
}
