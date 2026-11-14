/**
 * So sánh giao diện + kết quả tính của phân hệ Cầu cống (`/cau-cong/`) với BẢN GỐC chạy thật trong trình duyệt.
 *
 * Bản gốc được dựng lại từ các module đã trích an toàn (`analysis-cau-cong/modules/01..20.js` + `shell.html` + `styles.css`,
 * nối thành một trang tĩnh trong thư mục tạm) — cùng DOM, cùng id, cùng công thức. Hai trang được điều khiển bằng
 * cùng một chuỗi thao tác (đổi chế độ, mở từng tab, sửa ô nhập, bấm nút) rồi so từng pane: chữ, giá trị ô nhập,
 * số liệu trong hình SVG. Chênh lệch = chức năng thiếu / công thức lệch so với bản gốc.
 *
 * Chạy: `node tests/qa/ui_diff_original.mjs [--url http://localhost:5183/cau-cong/] [--quick] [--verbose]`
 * (cần máy chủ đang chạy ở --url: `npm run dev` hoặc `npx vite preview`; Chrome tại đường dẫn bên dưới).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const MODULES = path.resolve(ROOT, '../analysis-cau-cong/modules');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const args = process.argv.slice(2);
const argVal = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const URL_NEW = argVal('--url', 'http://localhost:5183/cau-cong/');
const QUICK = args.includes('--quick');
const VERBOSE = args.includes('--verbose');
const ONLY_MODES = argVal('--modes', '').split(',').filter(Boolean);
const PER_TAB_INPUTS = Number(argVal('--inputs', QUICK ? 6 : 40));
const WITH_BUTTONS = args.includes('--buttons');
const RESET_PER_TAB = !args.includes('--no-reset');
const SKIP_BTN = /dxf|zip|save|download|export|xlsx|pdf|csv|png|svg|file|print|copy|paste|clear|reset|default|ocr|dem|load|nap|tai|cap|ap_dung/i;

function buildReference() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc_ref_'));
  const mods = fs
    .readdirSync(MODULES)
    .filter((f) => /^[0-2]\d_.*\.js$/.test(f))
    .sort();
  const js = mods.map((f) => fs.readFileSync(path.join(MODULES, f), 'utf8')).join('\n');
  const css = fs.readFileSync(path.join(MODULES, 'styles.css'), 'utf8');
  const shell = fs.readFileSync(path.join(MODULES, 'shell.html'), 'utf8');
  const file = path.join(dir, 'ref.html');
  fs.writeFileSync(
    file,
    `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>REF</title><style>${css}</style></head><body>${shell}<script>${js}</script></body></html>`,
  );
  return { dir, url: pathToFileURL(file).href };
}

/** Chụp trạng thái mọi pane: chữ (bỏ công thức MathJax), giá trị ô nhập, chữ trong hình SVG. */
const SNAP = (ids) => {
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  const out = {};
  document.querySelectorAll('.pane[id^="tab"]').forEach((p) => {
    if (p.id === 'tab7' || (ids && !ids.includes(p.id))) return;
    const c = p.cloneNode(true);
    c.querySelectorAll('.m, script, style, .tra, .noprint svg.ico, [id$="p3d"], [id="bt"], [id$="_bt"], #qd_fA, #qd_fB').forEach((e) => e.remove());
    const svgs = {};
    c.querySelectorAll('svg').forEach((s, i) => {
      svgs[(s.id || 'svg' + i).replace(/\d{3,}/g, '#')] = [...s.querySelectorAll('text')].map((t) => norm(t.textContent || '')).join('|');
      s.remove();
    });
    const vals = [...p.querySelectorAll('input,select,textarea')]
      .filter((e) => e.id)
      .map((e) => (e.type === 'checkbox' || e.type === 'radio' ? e.id + '=' + e.checked : e.id + '=' + e.value));
    out[p.id] = { t: norm(c.textContent || ''), v: vals.join('\n'), s: svgs };
  });
  return out;
};

function words(s) {
  return s.split(' ').filter(Boolean);
}

function diffText(a, b) {
  if (a === b) return null;
  const A = words(a);
  const B = words(b);
  let i = 0;
  while (i < A.length && i < B.length && A[i] === B[i]) i++;
  let j = 0;
  while (j < A.length - i && j < B.length - i && A[A.length - 1 - j] === B[B.length - 1 - j]) j++;
  return `…${A.slice(Math.max(0, i - 3), i + 6).join(' ')} ⟂ ${B.slice(Math.max(0, i - 3), i + 6).join(' ')}…`;
}

function compareSnaps(ref, cur, label, report) {
  for (const id of Object.keys(ref)) {
    const r = ref[id];
    const c = cur[id];
    if (!c) {
      report.push(`${label} ${id}: thiếu pane`);
      continue;
    }
    const dt = diffText(r.t, c.t);
    if (dt) report.push(`${label} ${id} [chữ] ${dt}`);
    const dv = diffText(r.v.replace(/\n/g, ' '), c.v.replace(/\n/g, ' '));
    if (dv) report.push(`${label} ${id} [ô nhập] ${dv}`);
    for (const k of new Set([...Object.keys(r.s), ...Object.keys(c.s)])) {
      const ds = diffText(r.s[k] ?? '∅', c.s[k] ?? '∅');
      if (ds) report.push(`${label} ${id} [hình ${k}] ${ds.slice(0, 260)}`);
    }
  }
}

async function settle(page, ms = 1100) {
  await page.waitForTimeout(ms);
}

async function setMode(page, mode) {
  await page.selectOption('#appMode', mode);
  await settle(page, 1800);
}

async function showTab(page, t) {
  await page.evaluate((t) => document.querySelector(`.tabs .tab[data-t="${t}"]`)?.click(), t);
  await settle(page, 500);
}

const PLAN = {
  cau: [8, 9, 10, 11, 12, 13, 14, 4, 5, 1, 6, 2, 3, 20, 21, 22, 26, 23, 24, 25, 43],
  ch: [15, 16, 44, 17],
  ct: [18, 19],
  tc: [41, 42],
  tl: [61, 62],
  tv: [54],
  tvc: [70],
};

async function inputsOf(page, tab) {
  return page.evaluate(
    ({ tab, max }) => {
      const p = document.getElementById('tab' + tab);
      if (!p) return [];
      const els = [...p.querySelectorAll('input[id], select[id], textarea[id]')].filter(
        (e) =>
          !e.readOnly &&
          !e.disabled &&
          e.type !== 'file' &&
          e.type !== 'button' &&
          e.type !== 'checkbox' &&
          e.type !== 'radio' &&
          e.offsetParent !== null,
      );
      return els.slice(0, max).map((e) => ({ id: e.id, tag: e.tagName, val: e.value, opts: e.tagName === 'SELECT' ? [...e.options].map((o) => o.value) : null }));
    },
    { tab, max: PER_TAB_INPUTS },
  );
}

function newValue(inp) {
  if (inp.tag === 'TEXTAREA' || /[\n\t]/.test(inp.val)) return null; // bảng nhiều dòng: sửa cả khối sẽ phá dữ liệu, không có ý nghĩa so sánh
  if (inp.tag === 'SELECT') {
    const i = inp.opts.indexOf(inp.val);
    return inp.opts.length > 1 ? inp.opts[(i + 1) % inp.opts.length] : null;
  }
  const comma = inp.val.includes(',');
  const n = parseFloat(String(inp.val).replace(',', '.'));
  if (!isFinite(n)) return null;
  const nv = n === 0 ? 1 : +(n * 1.19).toFixed(3);
  return String(nv).replace('.', comma ? ',' : '.');
}

async function buttonsOf(page, tab) {
  return page.evaluate(
    ({ tab, skip }) => {
      const re = new RegExp(skip, 'i');
      const p = document.getElementById('tab' + tab);
      if (!p) return [];
      return [...p.querySelectorAll('button[id]')]
        .filter((b) => !b.disabled && b.offsetParent !== null && !re.test(b.id) && !re.test(b.textContent || ''))
        .map((b) => b.id);
    },
    { tab, skip: SKIP_BTN.source },
  );
}

async function clickId(page, id) {
  await page.evaluate((id) => document.getElementById(id)?.click(), id);
}

async function applyInput(page, id, v) {
  await page.evaluate(
    ({ id, v }) => {
      const e = document.getElementById(id);
      if (!e) return;
      e.value = v;
      e.dispatchEvent(new Event('input', { bubbles: true }));
      e.dispatchEvent(new Event('change', { bubbles: true }));
    },
    { id, v },
  );
}

async function main() {
  if (!fs.existsSync(CHROME)) throw new Error('Không thấy Chrome: ' + CHROME);
  const ref = buildReference();
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const mk = async (url, name) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    page.on('dialog', (d) => d.accept().catch(() => {}));
    const errs = [];
    page.on('pageerror', (e) => errs.push(`${name} PE ${e.message.slice(0, 160)}`));
    page.on('console', (m) => m.type() === 'error' && errs.push(`${name} console ${m.text().slice(0, 160)}`));
    await page.goto(url);
    await page.waitForSelector('.tabs .tab');
    await page.waitForTimeout(4500);
    return { page, errs };
  };
  const A = await mk(ref.url, 'ref');
  const B = await mk(URL_NEW, 'new');
  const report = [];
  const stats = { modes: 0, tabs: 0, inputs: 0 };

  for (const [mode, tabs] of Object.entries(PLAN)) {
    if (ONLY_MODES.length && !ONLY_MODES.includes(mode)) continue;
    stats.modes++;
    const ids = tabs.map((x) => 'tab' + x);
    await setMode(A.page, mode);
    await setMode(B.page, mode);
    compareSnaps(await A.page.evaluate(SNAP, ids), await B.page.evaluate(SNAP, ids), `[${mode} khởi tạo]`, report);
    for (const t of tabs) {
      stats.tabs++;
      if (RESET_PER_TAB && stats.tabs > 1) {
        // mỗi tab bắt đầu từ số liệu mẫu để lệch của tab trước không lan sang tab sau
        for (const X of [A, B]) {
          await X.page.evaluate(() => localStorage.clear());
          await X.page.reload();
          await X.page.waitForSelector('.tabs .tab');
          await X.page.waitForTimeout(4500);
        }
        await setMode(A.page, mode);
        await setMode(B.page, mode);
      }
      await showTab(A.page, t);
      await showTab(B.page, t);
      const ins = await inputsOf(A.page, t);
      for (const inp of ins) {
        const nv = newValue(inp);
        if (nv == null) continue;
        stats.inputs++;
        await applyInput(A.page, inp.id, nv);
        await applyInput(B.page, inp.id, nv);
        await settle(A.page, 700);
        const a = await A.page.evaluate(SNAP, ids);
        const b = await B.page.evaluate(SNAP, ids);
        compareSnaps(a, b, `[${mode} tab${t} sửa ${inp.id} ${inp.val}→${nv}]`, report);
      }
      if (WITH_BUTTONS) {
        for (const id of await buttonsOf(A.page, t)) {
          stats.buttons = (stats.buttons || 0) + 1;
          await clickId(A.page, id);
          await clickId(B.page, id);
          await settle(A.page, 800);
          compareSnaps(await A.page.evaluate(SNAP, ids), await B.page.evaluate(SNAP, ids), `[${mode} tab${t} bấm #${id}]`, report);
        }
      }
    }
    // (chưa dùng) khôi phục số liệu mẫu giữa các chế độ: nạp lại trang để mỗi chế độ bắt đầu từ cùng trạng thái
    await A.page.evaluate(() => localStorage.clear());
    await B.page.evaluate(() => localStorage.clear());
    await A.page.reload();
    await B.page.reload();
    await A.page.waitForSelector('.tabs .tab');
    await B.page.waitForSelector('.tabs .tab');
    await A.page.waitForTimeout(4500);
    await B.page.waitForTimeout(4500);
  }

  await browser.close();
  fs.rmSync(ref.dir, { recursive: true, force: true });
  // gom nhóm theo (pane, loại) để báo cáo gọn
  const seen = new Map();
  for (const line of report) {
    const m = /^\[(\S+)(?: tab\d+ (?:sửa|bấm) [^\]]*)?(?: khởi tạo)?\] (tab\d+) \[([^\]]+)\]/.exec(line);
    const key = m ? `${m[1]} ${m[2]} [${m[3]}]` : line.slice(0, 60);
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key).push(line);
  }
  console.log(`Đã so: ${stats.modes} chế độ, ${stats.tabs} tab, ${stats.inputs} lần sửa ô nhập, ${stats.buttons || 0} lần bấm nút.`);
  console.log(`Số điểm lệch: ${report.length} (${seen.size} nhóm pane/loại).`);
  for (const [k, lines] of seen) {
    console.log(`- ${k}: ${lines.length} lần. Ví dụ: ${lines[0].slice(0, 330)}`);
    if (VERBOSE) lines.slice(1, 6).forEach((l) => console.log('    ' + l.slice(0, 300)));
  }
  const errs = [...A.errs, ...B.errs];
  if (errs.length) console.log('Lỗi console/trang:', [...new Set(errs)].slice(0, 12));
  process.exit(report.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
