import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { PDFDocument } from 'pdf-lib';
import { chromium } from 'playwright-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEBAPP_DIR = path.resolve(__dirname, '../..');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PREVIEW_PORT = 4179;
const BASE_URL = `http://127.0.0.1:${PREVIEW_PORT}/tuong-chan/`;

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function parseZipAndVerify(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65558); i--) {
    if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x05 && buf[i + 3] === 0x06) {
      eocd = i;
      break;
    }
  }
  assert.ok(eocd >= 0, 'ZIP EOCD missing');
  const cdCount = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const files = new Map();
  let pos = cdOffset;
  for (let i = 0; i < cdCount; i++) {
    assert.equal(buf.readUInt32LE(pos), 0x02014b50, 'Bad central directory header');
    const method = buf.readUInt16LE(pos + 10);
    const expectedCrc = buf.readUInt32LE(pos + 16);
    const compSize = buf.readUInt32LE(pos + 20);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const lfhOff = buf.readUInt32LE(pos + 42);
    const name = buf.subarray(pos + 46, pos + 46 + nameLen).toString('utf8');
    pos += 46 + nameLen + extraLen + commentLen;

    assert.equal(buf.readUInt32LE(lfhOff), 0x04034b50, `Bad local file header for ${name}`);
    const lNameLen = buf.readUInt16LE(lfhOff + 26);
    const lExtraLen = buf.readUInt16LE(lfhOff + 28);
    const dataStart = lfhOff + 30 + lNameLen + lExtraLen;
    const compData = buf.subarray(dataStart, dataStart + compSize);
    const rawData = method === 0 ? compData : method === 8 ? zlib.inflateRawSync(compData) : null;
    assert.ok(rawData !== null, `Unsupported compression method ${method} for ${name}`);
    assert.equal(crc32(rawData), expectedCrc, `CRC mismatch for ${name}`);
    files.set(name, rawData);
  }
  return files;
}

function parseDxfBasic(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  const pairs = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    pairs.push([Number(lines[i].trim()), lines[i + 1]]);
  }
  const layers = [];
  const blocks = [];
  const entities = [];
  let acadVer = '';
  let insUnits = -1;
  let section = '';
  let inLayerTable = false;
  for (let i = 0; i < pairs.length; i++) {
    const [c, v] = pairs[i];
    if (c === 0 && v === 'SECTION') {
      section = pairs[i + 1]?.[1] ?? '';
    } else if (section === 'HEADER' && c === 9 && v === '$ACADVER') {
      acadVer = pairs[i + 1]?.[1] ?? '';
    } else if (section === 'HEADER' && c === 9 && v === '$INSUNITS') {
      insUnits = Number(pairs[i + 1]?.[1]);
    } else if (section === 'TABLES' && c === 0 && v === 'TABLE' && pairs[i + 1]?.[1] === 'LAYER') {
      inLayerTable = true;
    } else if (section === 'TABLES' && inLayerTable && c === 0 && v === 'ENDTAB') {
      inLayerTable = false;
    } else if (section === 'TABLES' && inLayerTable && c === 0 && v === 'LAYER') {
      layers.push(pairs[i + 1]?.[1] ?? '');
    } else if (section === 'BLOCKS' && c === 0 && v === 'BLOCK') {
      const bName = pairs.slice(i + 1, i + 10).find(([cc]) => cc === 2)?.[1] ?? '';
      blocks.push(bName);
    } else if (section === 'ENTITIES' && c === 0 && v !== 'ENDSEC' && v !== 'VERTEX' && v !== 'SEQEND') {
      const obj = { type: v };
      for (let j = i + 1; j < pairs.length && pairs[j][0] !== 0; j++) {
        obj[pairs[j][0]] = pairs[j][1];
      }
      entities.push(obj);
    }
  }
  const lastPair = pairs[pairs.length - 1];
  return {
    endedWithEof: lastPair && lastPair[0] === 0 && lastPair[1] === 'EOF',
    acadVer,
    insUnits,
    layers,
    blocks,
    entities,
  };
}

function checkPngHeader(buf) {
  assert.ok(buf.length > 1000, `PNG too small: ${buf.length} bytes`);
  assert.equal(
    buf.subarray(0, 8).toString('hex'),
    '89504e470d0a1a0a',
    'Invalid PNG signature',
  );
  assert.equal(buf.subarray(12, 16).toString('ascii'), 'IHDR', 'Missing PNG IHDR');
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  assert.ok(width > 100 && height > 100, `Invalid PNG dimensions ${width}x${height}`);
  // Ensure IDAT exists and isn't tiny blank image
  assert.ok(buf.includes(Buffer.from('IDAT')), 'Missing PNG IDAT chunk');
  return { width, height };
}

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

async function captureDownload(page, triggerFn, downloadDir, prefix) {
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), triggerFn()]);
  const filename = download.suggestedFilename();
  const outPath = path.join(downloadDir, `${prefix}_${filename}`);
  await download.saveAs(outPath);
  const bytes = fs.readFileSync(outPath);
  return { filename, outPath, bytes };
}

function accordionByPrefix(page, prefix) {
  const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return page.locator('#panel details').filter({
    has: page.locator('summary', { hasText: new RegExp(`^\\s*${esc}`) }),
  });
}

async function getAccordionOpen(page, prefix) {
  const det = accordionByPrefix(page, prefix);
  assert.equal(await det.count(), 1, `Expected unique accordion matching "${prefix}"`);
  return det.evaluate((el) => el.open);
}

async function setAccordionOpen(page, prefix, wantOpen) {
  const det = accordionByPrefix(page, prefix);
  const cur = await getAccordionOpen(page, prefix);
  if (cur !== wantOpen) {
    await det.locator('> summary').click();
    await page.waitForTimeout(30);
    assert.equal(
      await det.evaluate((el) => el.open),
      wantOpen,
      `Accordion "${prefix}" did not transition to open=${wantOpen}`,
    );
  }
}

async function verifyDocxBytes(page, bytes, label) {
  assert.equal(bytes.subarray(0, 2).toString('ascii'), 'PK', `${label}: missing PK header`);
  const zipEntries = parseZipAndVerify(bytes);
  assert.ok(zipEntries.has('[Content_Types].xml'), `${label}: missing [Content_Types].xml`);
  assert.ok(zipEntries.has('_rels/.rels'), `${label}: missing _rels/.rels`);
  assert.ok(zipEntries.has('word/document.xml'), `${label}: missing word/document.xml`);
  assert.ok(zipEntries.has('word/styles.xml'), `${label}: missing word/styles.xml`);
  assert.ok(zipEntries.has('word/settings.xml'), `${label}: missing word/settings.xml`);
  assert.ok(zipEntries.has('word/footer1.xml'), `${label}: missing word/footer1.xml`);

  const rootRels = zipEntries.get('_rels/.rels').toString('utf8');
  assert.ok(
    rootRels.includes('Id="rId2"') &&
      rootRels.includes('Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties"') &&
      rootRels.includes('Target="docProps/core.xml"'),
    `${label}: _rels/.rels rId2 core-properties URI mismatch: ${rootRels}`,
  );

  const docXml = zipEntries.get('word/document.xml').toString('utf8');
  assert.ok(docXml.includes('<m:oMath>'), `${label}: missing <m:oMath>`);
  assert.ok(docXml.includes('<w:tbl>'), `${label}: missing <w:tbl>`);
  assert.ok(docXml.includes('TCVN 11823'), `${label}: missing TCVN 11823 text`);
  assert.equal(/\bNaN\b/.test(docXml), false, `${label}: stray "NaN" found in word/document.xml`);

  const appXml = zipEntries.get('docProps/app.xml')?.toString('utf8') || '';
  assert.ok(
    appXml.includes('<Application>LEDAT-BIM</Application>'),
    `${label}: unexpected docProps/app.xml: ${appXml}`,
  );
  assert.equal(/Thợ Vẽ/i.test(appXml), false, `${label}: legacy branding found in docProps/app.xml`);

  for (const [entryName, entryBuf] of zipEntries.entries()) {
    if (/\.(xml|rels)$/i.test(entryName)) {
      const xmlErr = await page.evaluate((xmlStr) => {
        const doc = new DOMParser().parseFromString(xmlStr, 'application/xml');
        const pe = doc.querySelector('parsererror');
        return pe ? pe.textContent : null;
      }, entryBuf.toString('utf8'));
      assert.equal(xmlErr, null, `${label}: invalid XML in ${entryName}: ${xmlErr}`);
    }
  }

  const mediaKeys = [...zipEntries.keys()].filter((k) => k.startsWith('word/media/image'));
  assert.ok(mediaKeys.length >= 3, `${label}: expected >= 3 embedded images, got ${mediaKeys.length}`);
  for (const mk of mediaKeys) {
    assert.ok(
      zipEntries.get(mk).length > 1000,
      `${label}: DOCX image ${mk} unexpectedly small (${zipEntries.get(mk).length} B)`,
    );
  }
  return { zipEntries, docXml, mediaKeys };
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
    // Ignore if already exited
  }
}

async function run() {
  assert.ok(fs.existsSync(CHROME_PATH), `Chrome not found at ${CHROME_PATH}`);
  const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tcl_e2e_'));

  const viteBin = path.join(WEBAPP_DIR, 'node_modules', 'vite', 'bin', 'vite.js');
  const previewProc = spawn(
    process.execPath,
    [viteBin, 'preview', '--port', String(PREVIEW_PORT), '--host', '127.0.0.1', '--strictPort'],
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
  const results = [];
  const defects = [];
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const httpErrors = [];

  const record = (name, pass, detail) => {
    results.push({ name, pass, detail });
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name} — ${detail}`);
  };

  try {
    await waitForServer(BASE_URL, 15000);

    browser = await chromium.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
        '--no-sandbox',
      ],
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
    page.on('response', (res) => {
      if (res.status() >= 400) {
        httpErrors.push(`${res.status()} ${res.url()}`);
      }
    });

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // =========================================================================
    // E2E-1: Initial Default Mau 1 (H=500 cm) KPI, Badge, Licensing audit
    // =========================================================================
    await page.waitForSelector('#sum .card b');
    const tplAttr = await page.locator('.app-shell').getAttribute('data-tpl');
    const cards = await page.locator('#sum .card').evaluateAll((els) =>
      els.map((el) => `${el.querySelector('small')?.textContent?.trim()}: ${el.querySelector('b')?.textContent?.trim()}`),
    );
    const warnOk = (await page.locator('#warn .ok').textContent())?.trim() ?? '';
    const badgeInit = (await page.locator('#calcBadge').textContent())?.trim() ?? '';
    const sinfoInit = (await page.locator('#sinfo').textContent())?.trim() ?? '';
    const initDirty = await page.locator('#bSave').getAttribute('data-dirty');
    const bodyText = await page.locator('body').innerText();

    assert.equal(tplAttr, 'B');
    assert.deepEqual(cards, [
      'Bê tông: 21,50 m³',
      'Ván khuôn: 64,64 m²',
      'Bê tông lót: 1,50 m³',
      'Cốt thép: 2370 kg',
      'Hàm lượng: 110,2 kg/m³',
    ]);
    assert.ok(warnOk.includes('Không có cảnh báo'));
    assert.equal(badgeInit, '✗ 3');
    assert.ok(
      sinfoInit.includes('tỷ lệ 1/20') && sinfoInit.includes('rộng 766 × cao 419 mm'),
      `Unexpected #sinfo: "${sinfoInit}"`,
    );
    assert.equal(initDirty, null);

    const forbiddenUiRe = /kích hoạt(?!\s+tường)|bản quyền|mã máy|dùng thử|license|hwid|Thợ Vẽ/i;
    assert.equal(forbiddenUiRe.test(bodyText), false, 'Licensing/trial/legacy brand text found in UI');
    const brandSub = (await page.locator('header .brand small').textContent())?.trim() ?? '';
    assert.equal(
      brandSub,
      'Bản vẽ 2D · mô hình 3D · kiểm toán TCVN 11823 · LEDAT',
      `Unexpected brand subtitle: "${brandSub}"`,
    );
    record(
      'E2E-1 Initial Mau 1 KPI & Licensing Cleanliness',
      true,
      `cards=[${cards.join('; ')}], badge="${badgeInit}", sinfo="${sinfoInit}"`,
    );

    // =========================================================================
    // E2E-2: All 5 CAD Sheets SVG rendering + Zoom / Pan / Fit / Dblclick
    // =========================================================================
    const sheetStats = [];
    for (let i = 0; i < 5; i++) {
      await page.locator('#tabs button').nth(i).click();
      await page.waitForTimeout(40);
      const stat = await page.locator('#stage svg').evaluate((svg) => {
        const r = svg.getBoundingClientRect();
        const bb = svg.getBBox();
        return {
          rw: Math.round(r.width),
          rh: Math.round(r.height),
          bw: Math.round(bb.width),
          bh: Math.round(bb.height),
          vb: svg.getAttribute('viewBox'),
        };
      });
      assert.ok(stat.rw > 200 && stat.rh > 150, `Sheet ${i + 1} empty rect: ${JSON.stringify(stat)}`);
      assert.ok(stat.bw > 100 && stat.bh > 100, `Sheet ${i + 1} empty bbox: ${JSON.stringify(stat)}`);
      sheetStats.push(`S${i + 1}:${stat.bw}x${stat.bh}`);
    }

    // Back to Sheet 1 & test zoom, pan, bFit, dblclick
    await page.locator('#tabs button').nth(0).click();
    const parseVb = (s) => s.split(/\s+/).map(Number);
    const vb0 = parseVb((await page.locator('#stage svg').getAttribute('viewBox')) || '');
    const stageBox = await page.locator('#stage svg').boundingBox();
    assert.ok(stageBox);
    const cx = stageBox.x + stageBox.width / 2;
    const cy = stageBox.y + stageBox.height / 2;

    await page.mouse.move(cx, cy);
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(40);
    const vbZoom = parseVb((await page.locator('#stage svg').getAttribute('viewBox')) || '');
    assert.ok(vbZoom[2] < vb0[2] * 0.95, `Wheel zoom did not zoom in: ${vbZoom[2]} vs ${vb0[2]}`);

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 80, cy + 50, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(40);
    const vbPan = parseVb((await page.locator('#stage svg').getAttribute('viewBox')) || '');
    assert.ok(
      Math.abs(vbPan[0] - vbZoom[0]) > 1 || Math.abs(vbPan[1] - vbZoom[1]) > 1,
      `Pan did not change viewBox: ${vbPan} vs ${vbZoom}`,
    );

    await page.locator('#bFit').click();
    await page.waitForTimeout(40);
    const vbFit = parseVb((await page.locator('#stage svg').getAttribute('viewBox')) || '');
    assert.ok(Math.abs(vbFit[2] - vb0[2]) < 1, `Fit button did not reset viewBox: ${vbFit} vs ${vb0}`);

    await page.mouse.move(cx, cy);
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(30);
    await page.mouse.dblclick(cx, cy);
    await page.waitForTimeout(40);
    const vbDbl = parseVb((await page.locator('#stage svg').getAttribute('viewBox')) || '');
    assert.ok(Math.abs(vbDbl[2] - vb0[2]) < 1, `Dblclick did not reset viewBox: ${vbDbl} vs ${vb0}`);

    record('E2E-2 CAD 5 Sheets + Zoom/Pan/Fit/Dblclick', true, sheetStats.join(', '));

    // =========================================================================
    // E2E-2b: #sinfo Overflow Banner (H=1300 / A3 / scale=10) & Accordion Persistence
    // =========================================================================
    await page.selectOption('#preH', '13');
    await setAccordionOpen(page, '6. Vật liệu', true);
    await page.selectOption('select[data-path="paper"]', 'A3');
    await page.selectOption('select[data-path="scale"]', '10');
    await page.waitForTimeout(40);
    const sinfoOverflow = (await page.locator('#sinfo').textContent())?.trim() ?? '';
    assert.ok(
      sinfoOverflow.includes('1/10') && sinfoOverflow.includes('⚠ vượt khổ A3'),
      `Expected #sinfo A3 overflow banner at H=1300 scale=10, got "${sinfoOverflow}"`,
    );
    await page.locator('#tabs button').nth(3).click(); // Sheet 4 (noScale)
    await page.waitForTimeout(30);
    const sinfoSheet4 = (await page.locator('#sinfo').textContent())?.trim() ?? '';
    assert.equal(sinfoSheet4.includes('⚠ vượt khổ'), false, `Sheet 4 (noScale) should not show paper overflow: "${sinfoSheet4}"`);

    await page.locator('#tabs button').nth(0).click();
    await page.selectOption('select[data-path="scale"]', '0');
    await page.selectOption('select[data-path="paper"]', 'A1');
    await page.selectOption('#preH', '5');
    await setAccordionOpen(page, '6. Vật liệu', false);
    await page.waitForTimeout(40);
    const sinfoRestored = (await page.locator('#sinfo').textContent())?.trim() ?? '';
    assert.ok(
      sinfoRestored.includes('tỷ lệ 1/20') && !sinfoRestored.includes('⚠ vượt khổ'),
      `Expected #sinfo restored to 1/20, got "${sinfoRestored}"`,
    );

    // Verify CAD & Calc sidebar accordion state persists across calc <-> 2d switches
    assert.equal(await getAccordionOpen(page, '1. Kiểu tường'), true);
    assert.equal(await getAccordionOpen(page, '6. Vật liệu'), false);
    await setAccordionOpen(page, '1. Kiểu tường', false);
    await setAccordionOpen(page, '6. Vật liệu', true);

    await page.locator('#tabCalc').click();
    await page.waitForTimeout(60);
    assert.equal(await getAccordionOpen(page, '1. Đất đắp'), true);
    assert.equal(await getAccordionOpen(page, '8. FEM 2D'), false);
    await setAccordionOpen(page, '1. Đất đắp', false);
    await setAccordionOpen(page, '8. FEM 2D', true);

    await page.locator('#tabs button').nth(0).click();
    await page.waitForTimeout(40);
    assert.equal(await getAccordionOpen(page, '1. Kiểu tường'), false, 'CAD accordion "1. Kiểu tường" state lost across tab switch');
    assert.equal(await getAccordionOpen(page, '6. Vật liệu'), true, 'CAD accordion "6. Vật liệu" state lost across tab switch');

    await page.locator('#tabCalc').click();
    await page.waitForTimeout(40);
    assert.equal(await getAccordionOpen(page, '1. Đất đắp'), false, 'Calc accordion "1. Đất đắp" state lost across tab switch');
    assert.equal(await getAccordionOpen(page, '8. FEM 2D'), true, 'Calc accordion "8. FEM 2D" state lost across tab switch');

    // Restore canonical accordion defaults before subsequent tests
    await setAccordionOpen(page, '1. Đất đắp', true);
    await setAccordionOpen(page, '8. FEM 2D', false);
    await page.locator('#tabs button').nth(0).click();
    await page.waitForTimeout(40);
    await setAccordionOpen(page, '1. Kiểu tường', true);
    await setAccordionOpen(page, '6. Vật liệu', false);

    record(
      'E2E-2b #sinfo Paper Overflow & Sidebar Accordion Persistence',
      true,
      `overflow="${sinfoOverflow}", CAD/Calc accordion state persisted across 2d<->calc switches`,
    );

    // =========================================================================
    // E2E-3: Template Switching (A, C, D, B) + Live Check of ok.all Bug
    // =========================================================================
    await page.locator('.tpls .tpl').nth(1).click();
    assert.equal(await page.locator('.app-shell').getAttribute('data-tpl'), 'A');
    const calcRText = (await page.locator('#calcR').textContent()) || '';
    assert.ok(calcRText.includes('4'), `Template A rib text unexpected: ${calcRText}`);

    await page.locator('.tpls .tpl').nth(2).click();
    assert.equal(await page.locator('.app-shell').getAttribute('data-tpl'), 'C');
    await page.selectOption('#preK', String(await page.locator('#preK option').nth(2).getAttribute('value')));

    await page.locator('.tpls .tpl').nth(3).click();
    assert.equal(await page.locator('.app-shell').getAttribute('data-tpl'), 'D');
    await page.selectOption('#preD', '3'); // D60b passing flat wall on rock!
    await page.waitForTimeout(50);

    // Inspect live UI behavior for D60b ok.all bug
    const d60bBadge = (await page.locator('#calcBadge').textContent())?.trim() ?? '';
    await page.locator('#tabCalc').click();
    await page.waitForTimeout(100);
    const d60bSidebarOk = (await page.locator('#warn').innerText()).trim();
    const d60bReportKl = await page.locator('.csheet p.kl').evaluateAll((els) => ({
      text: els[els.length - 1]?.textContent?.trim() ?? '',
      cls: els[els.length - 1]?.className ?? '',
    }));

    const d60bBugExposed =
      d60bBadge === '✓' &&
      d60bSidebarOk.includes('Đạt tất cả') &&
      /KHÔNG ĐẠT/i.test(d60bReportKl.text);

    record(
      'E2E-3 Template Switching (A, C, D)',
      true,
      `Switched B->A->C->D(D60b); D60b badge="${d60bBadge}", report p.kl="${d60bReportKl.text}"`,
    );
    if (d60bBugExposed) {
      defects.push({
        id: 'BUG-1',
        location: 'src/engine/calcCore.ts#L1951-1954',
        detail: `Template D (D60b) passes all individual checks (#calcBadge="${d60bBadge}", #warn="✓ Đạt tất cả"), yet Calc report footer displays "${d60bReportKl.text}" (${d60bReportKl.cls}) because calcCore sets ok.all=false before Object.values(ok).every(Boolean).`,
      });
      record(
        'E2E-3b Live Calc Conclusion Parity Check (D60b ok.all)',
        false,
        `CONTRADICTION EXPOSED: badge="${d60bBadge}" vs report="${d60bReportKl.text}" (src/engine/calcCore.ts#L1951-1954)`,
      );
    } else {
      record(
        'E2E-3b Live Calc Conclusion Parity Check (D60b ok.all)',
        true,
        `badge="${d60bBadge}", report="${d60bReportKl.text}"`,
      );
    }

    // Return to 2d + Mau 1 (H=5m) cleanly
    await page.locator('#tabs button').nth(0).click();
    await page.locator('.tpls .tpl').nth(0).click();
    await page.selectOption('#preH', '5');
    await page.waitForTimeout(50);

    // =========================================================================
    // E2E-4: 3D WebGL Tab + Slice Controls + Legend + PNG Download
    // =========================================================================
    await page.locator('#tab3d').click();
    await page.waitForTimeout(150);
    assert.equal(await page.locator('#v3d').isVisible(), true);
    assert.equal(await page.locator('#v3msg').isVisible(), false, 'WebGL error message shown');

    const glBox = await page.locator('#gl').boundingBox();
    assert.ok(glBox && glBox.width > 200 && glBox.height > 200, `Bad #gl bbox: ${JSON.stringify(glBox)}`);

    const v3Groups = await page.locator('#v3list .lg').count();
    const v3Sum = (await page.locator('#v3sum').textContent())?.trim() ?? '';
    assert.ok(v3Groups >= 7, `Too few 3D bar groups: ${v3Groups}`);
    assert.ok(v3Sum.includes('2370 kg thép'), `3D summary mismatch: ${v3Sum}`);

    // Verify rendered #gl canvas is non-blank by screenshotting #gl and checking PNG size + distinct bytes
    const glShot = await page.locator('#gl').screenshot();
    const glPngMeta = checkPngHeader(glShot);

    // Slice axis, slider, flip & legend toggle
    // Tùy chọn hiển thị nằm trong bảng bật lên của thanh công cụ nổi (mặc định đóng)
    if (!(await page.locator('#v3clipAxis').isVisible())) {
      await page.locator('#v3barToggle').click();
    }
    await page.selectOption('#v3clipAxis', 'x');
    await page.locator('#v3clipT').fill('0.5');
    await page.locator('#v3clipT').dispatchEvent('change');
    const flipChk = page.locator('#v3clipRow input[type="checkbox"]');
    await flipChk.check();
    assert.equal(await page.locator('#v3clipRow').evaluate((el) => el.classList.contains('off')), false);
    assert.equal(await flipChk.isChecked(), true);

    const firstLegChk = page.locator('#v3list .lg input[type="checkbox"]').first();
    await firstLegChk.uncheck();
    assert.equal(await firstLegChk.isChecked(), false);
    await page.locator('#v3leg button:has-text("Không")').click();
    await page.locator('#v3leg button:has-text("Tất cả")').click();
    await page.locator('#v3bar button:has-text("Phối cảnh trước")').click();
    await page.selectOption('#v3clipAxis', '');

    // Verify #v3tip idle hidden & 3D group isolation + genuine pointer click on #v3foc button + Escape key
    assert.equal(await page.locator('#v3tip').isVisible(), false, '#v3tip should be hidden while idle');
    await page.locator('#v3list .lg').nth(1).locator('.mk').click();
    assert.equal(await page.locator('#v3list .lg.sel').count(), 1, 'Expected 1 selected .lg row on isolation');
    const v3focText = (await page.locator('#v3foc').textContent())?.trim() ?? '';
    assert.ok(
      v3focText.includes('Cô lập mác') && v3focText.includes('Hiện tất cả (Esc)'),
      `Unexpected #v3foc text: "${v3focText}"`,
    );
    await page.locator('#v3foc button').click();
    assert.equal(await page.locator('#v3list .lg.sel').count(), 0, '#v3foc button click did not clear focus');
    assert.equal(((await page.locator('#v3foc').textContent()) || '').trim(), '');

    await page.locator('#v3list .lg').nth(0).locator('.mk').click();
    assert.equal(await page.locator('#v3list .lg.sel').count(), 1);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#v3list .lg.sel').count(), 0, 'Escape key did not clear 3D focus');

    // Real 3D PNG Download via header #bPng
    const pngDl = await captureDownload(page, () => page.locator('#bPng').click(), downloadDir, '3d');
    const dlPngMeta = checkPngHeader(pngDl.bytes);
    assert.ok(pngDl.filename.endsWith('_3D.png'));
    assert.ok(pngDl.bytes.length > 5000, `3D PNG unexpectedly tiny (${pngDl.bytes.length} bytes)`);

    record(
      'E2E-4 3D WebGL Scene, Slice/Legend/Focus Controls & PNG Export',
      true,
      `groups=${v3Groups}, sum="${v3Sum}", focusBtn+Esc=ok, canvas=${glPngMeta.width}x${glPngMeta.height}, dl=${pngDl.filename} (${pngDl.bytes.length} B, ${dlPngMeta.width}x${dlPngMeta.height})`,
    );

    // =========================================================================
    // E2E-5: Calc Sub-tabs, Slope, FE3D, FEM2D Worker, Decimal Toggle, Ap dung
    // =========================================================================
    await page.locator('#tabCalc').click();
    await page.waitForTimeout(100);

    // Wait for auto Bishop Slope + run explicit Slope
    await page.locator('#panel button.gsRun').click();
    await page.waitForFunction(
      () => /Fs:/.test(document.querySelector('.gsStat')?.textContent || ''),
      undefined,
      { timeout: 25000 },
    );

    // Switch sub-tabs: Bảng tính -> Ổn định tổng thể -> Bố trí thép
    await page.locator('.csub button:has-text("Ổn định tổng thể")').click();
    await page.waitForTimeout(80);
    const gsStatText = (await page.locator('.gsStat').textContent())?.trim() ?? '';
    assert.ok(gsStatText.includes('Fs:'), `Missing Fs in .gsStat: ${gsStatText}`);
    const gsSvgCount = await page.locator('.csheet svg').count();
    assert.ok(gsSvgCount >= 1, 'Slope tab rendered zero SVGs');

    await page.locator('.csub button:has-text("Bố trí thép")').click();
    await page.waitForTimeout(80);
    const rbSvgCount = await page.locator('.csheet svg').count();
    assert.ok(rbSvgCount >= 1, 'Rebar schedule tab rendered zero SVGs');

    await page.locator('.csub button:has-text("Bảng tính")').click();

    // Test Section 7: 3D Shell FE + FeViewPanel persistence (q='V', k='SD') across fe -> sheet -> fe & fe -> 2d -> calc
    await setAccordionOpen(page, '7. Mô hình', true);
    await page.locator('input[data-path="calc.feOn"]').check();
    await page.waitForFunction(
      () => /Đã tính:/.test(document.querySelector('#feStat')?.textContent || ''),
      undefined,
      { timeout: 25000 },
    );
    const feStatText = (await page.locator('#feStat').textContent())?.trim() ?? '';
    await page.locator('.csub button:has-text("Nội lực mô hình tấm")').click();
    await page.waitForSelector('.feview .fefig svg');
    const feSvgBox = await page.locator('.feview .fefig svg').boundingBox();
    assert.ok(feSvgBox && feSvgBox.width > 200 && feSvgBox.height > 150, `FE contour SVG bad box`);

    await page.locator('.fetool select').nth(0).selectOption('V');
    await page.locator('.fetool select').nth(1).selectOption('SD');
    await page.waitForTimeout(40);
    assert.equal(await page.locator('.fetool select').nth(0).inputValue(), 'V');
    assert.equal(await page.locator('.fetool select').nth(1).inputValue(), 'SD');
    const feExtraSd = (await page.locator('.feextra').textContent()) || '';
    assert.ok(feExtraSd.includes('Sử dụng I'), 'FE extra tables did not switch to SD');

    await page.locator('.csub button:has-text("Bảng tính")').click();
    await page.locator('.csub button:has-text("Nội lực mô hình tấm")').click();
    await page.waitForSelector('.feview .fefig svg');
    assert.equal(await page.locator('.fetool select').nth(0).inputValue(), 'V', 'FeViewPanel q lost across fe->sheet->fe');
    assert.equal(await page.locator('.fetool select').nth(1).inputValue(), 'SD', 'FeViewPanel k lost across fe->sheet->fe');

    await page.locator('#tabs button').nth(0).click();
    await page.waitForTimeout(30);
    await page.locator('#tabCalc').click();
    await page.waitForSelector('.feview .fefig svg');
    assert.equal(await page.locator('.fetool select').nth(0).inputValue(), 'V', 'FeViewPanel q lost across 2d->calc');
    assert.equal(await page.locator('.fetool select').nth(1).inputValue(), 'SD', 'FeViewPanel k lost across 2d->calc');

    // Uncheck feOn to return to clean Bảng tính state
    await page.locator('input[data-path="calc.feOn"]').uncheck();
    await page.locator('.csub button:has-text("Bảng tính")').click();
    await setAccordionOpen(page, '7. Mô hình', false);

    // Test Section 8: FEM 2D Web Worker (coarse mesh)
    await setAccordionOpen(page, '8. FEM 2D', true);
    await page.selectOption('select[data-path="calc.femMesh"]', 'c');
    await page.waitForFunction(
      () => {
        const b = document.querySelector('#femRun');
        return b && !b.hasAttribute('disabled');
      },
      undefined,
      { timeout: 45000 },
    );
    await page.locator('#femRun').click();
    await page.waitForFunction(
      () => {
        const txt = document.querySelector('#femStat')?.textContent || '';
        return /Kết quả \(/.test(txt) && !/Số liệu đã đổi/.test(txt);
      },
      undefined,
      { timeout: 45000 },
    );
    const femStatText = (await page.locator('#femStat').textContent())?.trim() ?? '';
    assert.ok(femStatText.includes('Kết quả ('), `FEM 2D status unexpected: ${femStatText}`);

    // Decimal ',' / '.' toggle (Section 11) + Zero NaN check on Calc sheet & Rebar tab
    await setAccordionOpen(page, '11. Bảng tính', true);
    const sheetBeforeDec = (await page.locator('.csheet').textContent()) || '';
    assert.equal(/\bNaN\b/.test(sheetBeforeDec), false, 'Found stray NaN in .csheet (dot decimal)');
    await page.selectOption('select[data-path="calc.dec"]', ',');
    await page.waitForTimeout(50);
    const sheetCommaDec = (await page.locator('.csheet').textContent()) || '';
    assert.notEqual(sheetCommaDec, sheetBeforeDec, 'Decimal comma toggle did not re-render sheet');
    assert.ok(/\d,\d{2}/.test(sheetCommaDec), 'Expected comma-formatted decimals in .csheet');
    assert.equal(/\bNaN\b/.test(sheetCommaDec), false, 'Found stray NaN in .csheet (comma decimal)');

    await page.locator('.csub button:has-text("Bố trí thép")').click();
    await page.waitForTimeout(40);
    const rbCommaTxt = (await page.locator('.csheet').textContent()) || '';
    assert.ok(/\d,\d/.test(rbCommaTxt), 'Expected comma-formatted decimals in Bố trí thép tab');
    assert.equal(/\bNaN\b/.test(rbCommaTxt), false, 'Found stray NaN in Bố trí thép tab');
    await page.locator('.csub button:has-text("Bảng tính")').click();
    await page.selectOption('select[data-path="calc.dec"]', '.');
    await setAccordionOpen(page, '11. Bảng tính', false);

    // Click "Gợi ý kích thước ổn định" (heel hint) on default Mau 1
    await page.locator('#panel button:has-text("Gợi ý kích thước ổn định")').click();
    await page.waitForFunction(
      () => /Tăng gót|đã đạt|Không đạt/.test(document.querySelector('#calcHint')?.textContent || ''),
      undefined,
      { timeout: 10000 },
    );
    const heelHintText = (await page.locator('#calcHint').textContent())?.trim() ?? '';
    assert.ok(heelHintText.length > 10, `Unexpected #calcHint: ${heelHintText}`);

    // Make foundation pass (heel=300 in CAD tab, phif=35, cf=50 in Calc) & weaken s1 rebar so "Áp dụng" fixes it to ✓
    await page.locator('input[data-path="calc.phif"]').fill('35');
    await page.locator('input[data-path="calc.cf"]').fill('50');
    await page.locator('#tabs button').nth(0).click();
    await page.locator('input[data-path="heel"]').fill('300');
    await page.locator('#tabCalc').click();
    await page.waitForTimeout(80);
    await page.selectOption('#panel .cb[data-id="s1"] select', '12');
    await page.locator('#panel .cb[data-id="s1"] input[type="number"]').fill('30');
    await page.waitForTimeout(60);

    const badgeBeforeFix = (await page.locator('#calcBadge').textContent())?.trim() ?? '';
    const apBtnCount = await page.locator('#panel .cb[data-id="s1"] button.ap').count();
    assert.ok(apBtnCount === 1, `Expected Áp dụng button on s1 (badge="${badgeBeforeFix}"), found ${apBtnCount}`);
    await page.locator('#panel .cb[data-id="s1"] button.ap').click();
    await page.waitForTimeout(100);
    const badgeAfterFix = (await page.locator('#calcBadge').textContent())?.trim() ?? '';
    const dirtyAfterFix = await page.locator('#bSave').getAttribute('data-dirty');
    assert.equal(badgeAfterFix, '✓', `Expected #calcBadge "✓" after Áp dụng, got "${badgeAfterFix}"`);
    assert.equal(dirtyAfterFix, '1', 'Expected dirty flag after Áp dụng');

    // Verify Bug #1 on fixed Mau 1 H=5m too:
    const m1KlAfterFix = await page.locator('.csheet p.kl').evaluateAll((els) => ({
      text: els[els.length - 1]?.textContent?.trim() ?? '',
      cls: els[els.length - 1]?.className ?? '',
    }));
    const m1WarnAfterFix = (await page.locator('#warn').innerText()).trim();

    record(
      'E2E-5 Calc Solvers (Slope, FE3D, FEM2D Worker, Dec Toggle, HeelHint, Áp dụng)',
      true,
      `gs="${gsStatText.slice(0, 50)}...", fe="${feStatText}", fem="${femStatText.slice(0, 55)}...", hint="${heelHintText.slice(0, 40)}...", badge="${badgeBeforeFix}"->"${badgeAfterFix}"`,
    );
    const bug1Contradiction =
      m1WarnAfterFix.includes('Đạt tất cả') && /KHÔNG ĐẠT/i.test(m1KlAfterFix.text);
    if (bug1Contradiction) {
      defects.push({
        id: 'BUG-1',
        location: 'src/engine/calcCore.ts#L1951-1954',
        detail: `Mau 1 (H=5m, heel=300, phif=35, cf=50) after clicking "Áp dụng" passes all 9 checks (#calcBadge="✓", #warn="✓ Đạt tất cả các hạng mục kiểm toán"), yet Calc report conclusion displays "${m1KlAfterFix.text}" (${m1KlAfterFix.cls}).`,
      });
      record(
        'E2E-5b Live Calc Conclusion Parity Check (Mau 1 passing ok.all)',
        false,
        `CONTRADICTION EXPOSED: badge="${badgeAfterFix}", sidebar="✓ Đạt tất cả", report p.kl="${m1KlAfterFix.text}" (src/engine/calcCore.ts#L1951-1954)`,
      );
    } else {
      record(
        'E2E-5b Live Calc Conclusion Parity Check (Mau 1 passing ok.all)',
        true,
        `badge="${badgeAfterFix}", report="${m1KlAfterFix.text}"`,
      );
    }

    // Re-run Slope & FEM quickly so state is ready for Calc PDF & Word export, and wait for settle
    await page.locator('#panel button.gsRun').click();
    await page.waitForFunction(
      () => /Fs:/.test(document.querySelector('.gsStat')?.textContent || ''),
      undefined,
      { timeout: 25000 },
    );

    // =========================================================================
    // E2E-6: Parameter Reactivity, Save/Open .tcl.json Roundtrip & All Exports
    // =========================================================================
    // Reset to clean Mau 1 H=5m via template click, verify KPI changes after H edit, save & reload
    await page.locator('#tabs button').nth(0).click();
    await page.locator('.tpls .tpl').nth(0).click();
    await page.selectOption('#preH', '5');
    await page.waitForTimeout(50);

    await page.locator('input[data-path="H"]').fill('550');
    await page.locator('input[data-path="H"]').dispatchEvent('change');
    await page.waitForTimeout(50);
    assert.equal(await page.locator('#bSave').getAttribute('data-dirty'), '1');
    const cardsH550 = await page.locator('#sum .card').evaluateAll((els) =>
      els.map((el) => el.querySelector('b')?.textContent?.trim()),
    );
    assert.notEqual(cardsH550[0], '21,50 m³', 'Concrete metric did not update reactively for H=550');

    // Save .tcl.json
    const jsonDl = await captureDownload(page, () => page.locator('#bSave').click(), downloadDir, 'proj');
    assert.ok(jsonDl.filename.endsWith('.tcl.json'));
    const jsonPayload = JSON.parse(jsonDl.bytes.toString('utf8'));
    assert.equal(jsonPayload.app, 'tuong-chan-L');
    assert.equal(jsonPayload.v, 1);
    assert.equal(jsonPayload.p.H, 550);
    assert.equal(await page.locator('#bSave').getAttribute('data-dirty'), null, 'Dirty state did not clear on Save');

    // Mutate H to 700, then open saved .tcl.json via #fOpen
    await page.locator('input[data-path="H"]').fill('700');
    await page.locator('input[data-path="H"]').dispatchEvent('change');
    assert.equal(await page.locator('#bSave').getAttribute('data-dirty'), '1');

    await page.setInputFiles('#fOpen', jsonDl.outPath);
    await page.waitForSelector('#toast.show.ok');
    assert.equal(await page.locator('input[data-path="H"]').inputValue(), '550');
    const cardsRestored = await page.locator('#sum .card').evaluateAll((els) =>
      els.map((el) => el.querySelector('b')?.textContent?.trim()),
    );
    assert.deepEqual(cardsRestored, cardsH550, 'Metrics not restored cleanly after .tcl.json upload');
    assert.equal(await page.locator('#bSave').getAttribute('data-dirty'), null, 'Dirty state should be clean after Open');

    // Visit Sheet 1 -> Sheet 2 -> Sheet 1, then trigger CAD exports
    await page.locator('#tabs button').nth(1).click();
    await page.waitForTimeout(30);
    await page.locator('#tabs button').nth(0).click();
    await page.waitForTimeout(30);

    // 1) DXF single sheet
    const dxfSingleDl = await captureDownload(page, () => page.locator('#bDxf').click(), downloadDir, 'dxf1');
    const dxf1 = parseDxfBasic(dxfSingleDl.bytes.toString('utf8'));
    assert.equal(dxf1.endedWithEof, true);
    assert.equal(dxf1.acadVer, 'AC1009');
    assert.equal(dxf1.insUnits, 4);
    assert.equal(dxf1.layers.length, 17);
    assert.ok(dxf1.entities.some((e) => e.type === 'DIMENSION'));

    // 2) DXF all 5 sheets stacked
    const dxfAllDl = await captureDownload(page, () => page.locator('#bDxfAll').click(), downloadDir, 'dxfall');
    const dxfAll = parseDxfBasic(dxfAllDl.bytes.toString('utf8'));
    assert.equal(dxfAll.endedWithEof, true);
    assert.equal(dxfAll.acadVer, 'AC1009');
    assert.equal(dxfAll.layers.length, 17);
    const dBlocks = dxfAll.blocks.filter((b) => /^\*D\d+$/.test(b));
    assert.ok(dBlocks.length > 10);
    assert.equal(new Set(dBlocks).size, dBlocks.length, 'Duplicate *D block names in stacked DXF');

    // 3) SVG
    const svgDl = await captureDownload(page, () => page.locator('#bSvg').click(), downloadDir, 'svg');
    const svgTxt = svgDl.bytes.toString('utf8');
    assert.ok(svgTxt.startsWith('<svg') && svgTxt.includes('xmlns="http://www.w3.org/2000/svg"') && svgTxt.trim().endsWith('</svg>'));

    // 4) CSV (UTF-8 BOM + expected columns & steel total)
    const csvDl = await captureDownload(page, () => page.locator('#bCsv').click(), downloadDir, 'csv');
    assert.equal(csvDl.bytes[0], 0xef);
    assert.equal(csvDl.bytes[1], 0xbb);
    assert.equal(csvDl.bytes[2], 0xbf);
    const csvTxt = csvDl.bytes.subarray(3).toString('utf8');
    assert.ok(csvTxt.includes('"Mac"') && csvTxt.includes('"Tong"'), `Unexpected CSV headers:\n${csvTxt.slice(0, 200)}`);
    const steelKgStr = cardsRestored[3].replace(/\s*kg$/, '');
    const tongMatch = /"Tong",[^,\r\n]*,[^,\r\n]*,[^,\r\n]*,[^,\r\n]*,[^,\r\n]*,[^,\r\n]*,[^,\r\n]*,"([0-9.]+)"/.exec(csvTxt);
    assert.ok(tongMatch && Math.abs(parseFloat(tongMatch[1]) - Number(steelKgStr)) <= 1, `CSV total ${tongMatch?.[1]} vs KPI ${steelKgStr}`);

    // 5) 2D CAD PDF
    const cadPdfDl = await captureDownload(page, () => page.locator('#bPdf').click(), downloadDir, 'cadpdf');
    assert.equal(cadPdfDl.bytes.subarray(0, 5).toString('ascii'), '%PDF-');
    const cadPdfDoc = await PDFDocument.load(cadPdfDl.bytes);
    assert.equal(cadPdfDoc.getPageCount(), 1);
    assert.ok(cadPdfDl.bytes.length > 5000);

    // 6) Calc PDF + 7) Calc Word (.docx)
    await page.locator('#tabCalc').click();
    await page.waitForTimeout(80);
    // Open Section 8 accordion and select coarse FEM mesh so Calc PDF/Docx completes promptly
    await setAccordionOpen(page, '8. FEM 2D', true);
    await page.selectOption('select[data-path="calc.femMesh"]', 'c');

    const calcPdfDl = await captureDownload(page, () => page.locator('#bPdf').click(), downloadDir, 'calcpdf');
    assert.equal(calcPdfDl.bytes.subarray(0, 5).toString('ascii'), '%PDF-');
    const calcPdfDoc = await PDFDocument.load(calcPdfDl.bytes);
    assert.ok(calcPdfDoc.getPageCount() >= 8, `Expected multi-page calc PDF >= 8 pages, got ${calcPdfDoc.getPageCount()}`);

    await page.waitForFunction(() => !document.querySelector('#bDocx')?.hasAttribute('disabled'), undefined, { timeout: 15000 });
    const docxDl = await captureDownload(page, () => page.locator('#bDocx').click(), downloadDir, 'docx');
    const m1Docx = await verifyDocxBytes(page, docxDl.bytes, 'Mau1_H550');

    record(
      'E2E-6 Roundtrip & All Real Downloads',
      true,
      `tcl.json=${jsonDl.bytes.length}B, dxf1=${dxfSingleDl.bytes.length}B, dxfall=${dxfAllDl.bytes.length}B (${dBlocks.length} *D blocks), svg=${svgDl.bytes.length}B, csv=${csvDl.bytes.length}B, cadPdf=${cadPdfDl.bytes.length}B (1p), calcPdf=${calcPdfDl.bytes.length}B (${calcPdfDoc.getPageCount()}p), docx=${docxDl.bytes.length}B (${m1Docx.zipEntries.size} zip files, rId2+XML valid, zero NaN, ${m1Docx.mediaKeys.length} imgs)`,
    );

    // =========================================================================
    // E2E-6b: Multi-Template Word (.docx) Exports (Mau 2 Ribbed & Mau 4 Rock Anchor)
    // =========================================================================
    await page.locator('#tabs button').nth(0).click();
    await page.locator('.tpls .tpl').nth(1).click();
    assert.equal(await page.locator('.app-shell').getAttribute('data-tpl'), 'A');
    await page.locator('#tabCalc').click();
    await page.waitForTimeout(80);
    await setAccordionOpen(page, '8. FEM 2D', true);
    await page.selectOption('select[data-path="calc.femMesh"]', 'c');
    await page.waitForFunction(() => !document.querySelector('#bDocx')?.hasAttribute('disabled'), undefined, { timeout: 15000 });
    const m2DocxDl = await captureDownload(page, () => page.locator('#bDocx').click(), downloadDir, 'docx_m2');
    const m2Docx = await verifyDocxBytes(page, m2DocxDl.bytes, 'Mau2_A_rib');
    assert.ok(/sườn|Sườn/.test(m2Docx.docXml), 'Mau 2 DOCX missing ribbed wall sections');

    await page.locator('#tabs button').nth(0).click();
    await page.locator('.tpls .tpl').nth(3).click();
    await page.selectOption('#preD', '0'); // D80
    assert.equal(await page.locator('.app-shell').getAttribute('data-tpl'), 'D');
    await page.locator('#tabCalc').click();
    await page.waitForTimeout(80);
    await page.selectOption('select[data-path="calc.femMesh"]', 'c');
    await page.waitForFunction(() => !document.querySelector('#bDocx')?.hasAttribute('disabled'), undefined, { timeout: 15000 });
    const m4DocxDl = await captureDownload(page, () => page.locator('#bDocx').click(), downloadDir, 'docx_m4');
    const m4Docx = await verifyDocxBytes(page, m4DocxDl.bytes, 'Mau4_D80');
    assert.ok(/neo|Neo/.test(m4Docx.docXml), 'Mau 4 DOCX missing rock anchor sections');

    record(
      'E2E-6b Multi-Template Word (.docx) Verification (Mau 2 & Mau 4)',
      true,
      `Mau2_A=${m2DocxDl.bytes.length}B (${m2Docx.zipEntries.size} files, ${m2Docx.mediaKeys.length} imgs, 0 NaN); Mau4_D80=${m4DocxDl.bytes.length}B (${m4Docx.zipEntries.size} files, ${m4Docx.mediaKeys.length} imgs, 0 NaN)`,
    );

    if (httpErrors.length > 0) {
      defects.push({
        id: 'BUG-2',
        location: 'TuongChanL-Web/index.html (missing favicon link / public/favicon.ico)',
        detail: `HTTP >= 400 errors during page load: ${httpErrors.join(', ')} causing console.error.`,
      });
    }
    const noRuntimeErrs =
      consoleErrors.length === 0 && pageErrors.length === 0 && failedRequests.length === 0 && httpErrors.length === 0;
    record(
      'E2E-0 Runtime Error Check (Console / PageError / Network)',
      noRuntimeErrs,
      noRuntimeErrs
        ? '0 console errors, 0 pageerrors, 0 failed network requests, 0 HTTP >=400 errors'
        : `consoleErrors=${JSON.stringify(consoleErrors)} httpErrors=${JSON.stringify(httpErrors)} pageErrors=${JSON.stringify(pageErrors)} failedRequests=${JSON.stringify(failedRequests)}`,
    );

    console.log('\n=== SUMMARY JSON ===');
    console.log(
      JSON.stringify(
        {
          total: results.length,
          passed: results.filter((r) => r.pass).length,
          failed: results.filter((r) => !r.pass).length,
          defects,
          consoleErrors,
          httpErrors,
          pageErrors,
          failedRequests,
        },
        null,
        2,
      ),
    );

    if (!noRuntimeErrs || results.some((r) => !r.pass)) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('E2E FATAL ERROR:', err);
    if (serverLogs) console.error('Server logs:\n', serverLogs);
    process.exitCode = 1;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    killProcessTree(previewProc);
    fs.rmSync(downloadDir, { recursive: true, force: true });
  }
}

run();
