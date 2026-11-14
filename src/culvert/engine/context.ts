/**
 * BangTinhCauCong Web App — Scoped Context, Headless/DOM Value Resolution,
 * Bilinear Code Tables & Late-Binding Visual Hook Registry.
 *
 * Clean-room TypeScript port of core context & formatting utilities from
 * `analysis-cau-cong/modules/02_core_utils_and_column_pm.js`,
 * `06_retaining_wall_gravity.js`, `07_approach_slab_and_culvert_soil.js`,
 * `10_superstructure_ui_and_deck_joints.js`, `11_culverts_box_and_circular.js`,
 * and `12_piles_geotech_mcoc_and_pm3d.js`.
 */

import {
  CONTEXT_PREFIXES,
  CTXPAR,
  resolveScopedIdCandidates,
  type ContextPrefix,
} from '../types/project';

export { CONTEXT_PREFIXES, CTXPAR, resolveScopedIdCandidates, type ContextPrefix };

// ---------------------------------------------------------------------------
// 1. Minimal DOM / In-Memory Virtual Element Abstraction
// ---------------------------------------------------------------------------

export interface ContextElementLike {
  id?: string;
  tagName?: string;
  title?: string;
  value: string;
  textContent: string | null;
  innerHTML: string;
  className: string;
  checked?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  style?: Record<string, string>;
  dataset?: Record<string, string | undefined>;
  options?: Array<{ value: string; text?: string; textContent?: string | null; disabled?: boolean }>;
  classList?: {
    add: (...tokens: string[]) => void;
    remove: (...tokens: string[]) => void;
    toggle: (token: string, force?: boolean) => boolean;
    contains: (token: string) => boolean;
  };
  closest?: (selector: string) => ContextElementLike | null;
  querySelector?: (selector: string) => ContextElementLike | null;
  querySelectorAll?: (selector: string) => ContextElementLike[];
  addEventListener?: (...args: unknown[]) => void;
  setAttribute?: (name: string, value: string) => void;
  getAttribute?: (name: string) => string | null;
  insertAdjacentHTML?: (position: string, text: string) => void;
  appendChild?: (node: unknown) => unknown;
  children?: ContextElementLike[];
  rows?: { length: number };
}

interface VirtualRecord {
  title: string;
  value: string;
  textContent: string;
  innerHTML: string;
  className: string;
  checked: boolean;
  readOnly: boolean;
  disabled: boolean;
  style: Record<string, string>;
  dataset: Record<string, string | undefined>;
}

const valueStore = new Map<string, VirtualRecord>();
const outputStore = new Map<string, string>();
const virtualHandles = new Map<string, ContextElementLike>();

function ensureVirtualRecord(id: string, initialValue = ''): VirtualRecord {
  let rec = valueStore.get(id);
  if (!rec) {
    rec = {
      title: '',
      value: initialValue,
      textContent: '',
      innerHTML: '',
      className: '',
      checked: false,
      readOnly: false,
      disabled: false,
      style: {},
      dataset: {},
    };
    valueStore.set(id, rec);
  }
  return rec;
}

function getVirtualHandle(id: string): ContextElementLike {
  let h = virtualHandles.get(id);
  if (!h) {
    h = {
      id,
      get title() {
        return ensureVirtualRecord(id).title;
      },
      set title(val: string) {
        ensureVirtualRecord(id).title = String(val ?? '');
      },
      get value() {
        return ensureVirtualRecord(id).value;
      },
      set value(val: string) {
        ensureVirtualRecord(id).value = String(val ?? '');
      },
      get textContent() {
        return ensureVirtualRecord(id).textContent;
      },
      set textContent(val: string | null) {
        const s = val == null ? '' : String(val);
        ensureVirtualRecord(id).textContent = s;
        outputStore.set(id, s);
      },
      get innerHTML() {
        return ensureVirtualRecord(id).innerHTML;
      },
      set innerHTML(val: string) {
        const s = String(val ?? '');
        const rec = ensureVirtualRecord(id);
        rec.innerHTML = s;
        rec.textContent = s;
        outputStore.set(id, s);
      },
      get className() {
        return ensureVirtualRecord(id).className;
      },
      set className(val: string) {
        ensureVirtualRecord(id).className = String(val ?? '');
      },
      get checked() {
        return ensureVirtualRecord(id).checked;
      },
      set checked(val: boolean) {
        ensureVirtualRecord(id).checked = Boolean(val);
      },
      get readOnly() {
        return ensureVirtualRecord(id).readOnly;
      },
      set readOnly(val: boolean) {
        ensureVirtualRecord(id).readOnly = Boolean(val);
      },
      get disabled() {
        return ensureVirtualRecord(id).disabled;
      },
      set disabled(val: boolean) {
        ensureVirtualRecord(id).disabled = Boolean(val);
      },
      get style() {
        return ensureVirtualRecord(id).style;
      },
      get dataset() {
        return ensureVirtualRecord(id).dataset;
      },
      classList: {
        add: (...tokens: string[]) => {
          const rec = ensureVirtualRecord(id);
          const cur = new Set(rec.className.split(/\s+/).filter(Boolean));
          for (const t of tokens) cur.add(t);
          rec.className = [...cur].join(' ');
        },
        remove: (...tokens: string[]) => {
          const rec = ensureVirtualRecord(id);
          const cur = new Set(rec.className.split(/\s+/).filter(Boolean));
          for (const t of tokens) cur.delete(t);
          rec.className = [...cur].join(' ');
        },
        toggle: (token: string, force?: boolean) => {
          const rec = ensureVirtualRecord(id);
          const cur = new Set(rec.className.split(/\s+/).filter(Boolean));
          const shouldAdd = force !== undefined ? force : !cur.has(token);
          if (shouldAdd) cur.add(token);
          else cur.delete(token);
          rec.className = [...cur].join(' ');
          return shouldAdd;
        },
        contains: (token: string) =>
          ensureVirtualRecord(id).className.split(/\s+/).filter(Boolean).includes(token),
      },
      insertAdjacentHTML: (_position: string, text: string) => {
        const rec = ensureVirtualRecord(id);
        rec.innerHTML += String(text ?? '');
        outputStore.set(id, rec.innerHTML);
      },
    };
    virtualHandles.set(id, h);
  }
  return h;
}

/** Seed or replace the in-memory value map used when DOM elements are absent. */
export function setContextStore(values: Record<string, string | number | boolean>): void {
  valueStore.clear();
  outputStore.clear();
  for (const [k, raw] of Object.entries(values)) {
    const rec = ensureVirtualRecord(k, String(raw ?? ''));
    if (typeof raw === 'boolean') rec.checked = raw;
  }
}

/** Merge key/value pairs into the in-memory value map (without clearing existing keys). */
export function updateContextStore(values: Record<string, string | number | boolean>): void {
  for (const [k, raw] of Object.entries(values)) {
    const rec = ensureVirtualRecord(k, String(raw ?? ''));
    rec.value = String(raw ?? '');
    if (typeof raw === 'boolean') rec.checked = raw;
  }
}

/** Snapshot all currently cached values in the in-memory value map. */
export function getContextStore(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, rec] of valueStore.entries()) {
    out[k] = rec.value;
  }
  return out;
}

export function clearContextStore(): void {
  valueStore.clear();
  outputStore.clear();
  virtualHandles.clear();
}

export function setContextValue(id: string, val: string | number | boolean): void {
  sv(id, val);
}

export function getContextValue(id: string): string | undefined {
  const el = $(id);
  return el ? el.value : undefined;
}

export function setOutputValue(id: string, text: string): void {
  outputStore.set(id, text);
}

export function getOutputValue(id: string): string | undefined {
  const candidates = resolveScopedIdCandidates(id, IDP);
  if (typeof document !== 'undefined') {
    for (const cand of candidates) {
      const el = document.getElementById(cand);
      if (el) return el.innerHTML || el.textContent || '';
    }
  }
  for (const cand of candidates) {
    if (outputStore.has(cand)) return outputStore.get(cand);
    const rec = valueStore.get(cand);
    if (rec && (rec.innerHTML || rec.textContent)) return rec.innerHTML || rec.textContent;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// 2. Scoped Prefix State (`IDP` / `CTX` / `withCtx` / `SCT2_LNK`)
// ---------------------------------------------------------------------------

export interface ContextSlot {
  SCTR: unknown;
  MCR: unknown;
  ST3: unknown;
  PDC: unknown;
  CT3: unknown;
  cur3: 'CD' | 'DB';
  biOK: boolean;
  GT_SEL: number;
  sctOK: Record<string, boolean>;
  matOK: Record<string, boolean>;
}

function createEmptySlot(): ContextSlot {
  return {
    SCTR: null,
    MCR: null,
    ST3: null,
    PDC: null,
    CT3: null,
    cur3: 'CD',
    biOK: false,
    GT_SEL: -1,
    sctOK: {},
    matOK: {},
  };
}

export let IDP: ContextPrefix = '';

export const CTX: Record<string, ContextSlot> = {};

export const contextState = {
  SCTR: null as unknown,
  MCR: null as unknown,
  ST3: null as unknown,
  PDC: null as unknown,
  CT3: null as unknown,
  cur3: 'CD' as 'CD' | 'DB',
  biOK: false,
  GT_SEL: -1,
  sctOK: {} as Record<string, boolean>,
  matOK: {} as Record<string, boolean>,
};

export function getIDP(): ContextPrefix {
  return IDP;
}

export function setIDP(prefix: ContextPrefix): void {
  IDP = prefix;
}

export function withCtx<T>(prefix: ContextPrefix, fn: () => T): T {
  if (IDP === prefix) return fn();
  const c = CTX[prefix] || (CTX[prefix] = createEmptySlot());
  const prev = {
    IDP,
    SCTR: contextState.SCTR,
    MCR: contextState.MCR,
    ST3: contextState.ST3,
    PDC: contextState.PDC,
    CT3: contextState.CT3,
    cur3: contextState.cur3,
    biOK: contextState.biOK,
    GT_SEL: contextState.GT_SEL,
  };

  IDP = prefix;
  contextState.SCTR = c.SCTR;
  contextState.MCR = c.MCR;
  contextState.ST3 = c.ST3;
  contextState.PDC = c.PDC;
  contextState.CT3 = c.CT3;
  contextState.cur3 = c.cur3;
  contextState.biOK = c.biOK;
  contextState.GT_SEL = c.GT_SEL;

  try {
    return fn();
  } finally {
    c.SCTR = contextState.SCTR;
    c.MCR = contextState.MCR;
    c.ST3 = contextState.ST3;
    c.PDC = contextState.PDC;
    c.CT3 = contextState.CT3;
    c.cur3 = contextState.cur3;
    c.biOK = contextState.biOK;
    c.GT_SEL = contextState.GT_SEL;

    IDP = prev.IDP;
    contextState.SCTR = prev.SCTR;
    contextState.MCR = prev.MCR;
    contextState.ST3 = prev.ST3;
    contextState.PDC = prev.PDC;
    contextState.CT3 = prev.CT3;
    contextState.cur3 = prev.cur3;
    contextState.biOK = prev.biOK;
    contextState.GT_SEL = prev.GT_SEL;
  }
}

export function ctxW<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult,
): (...args: TArgs) => TResult {
  const savedPrefix = IDP;
  return (...args: TArgs) => withCtx(savedPrefix, () => fn(...args));
}

export function resetAllContexts(): void {
  IDP = '';
  for (const k of Object.keys(CTX)) delete CTX[k];
  contextState.SCTR = null;
  contextState.MCR = null;
  contextState.ST3 = null;
  contextState.PDC = null;
  contextState.CT3 = null;
  contextState.cur3 = 'CD';
  contextState.biOK = false;
  contextState.GT_SEL = -1;
  contextState.sctOK = {};
  contextState.matOK = {};
}

// ---------------------------------------------------------------------------
// 3. Secondary Borehole Separation & Sync (`SCT2_LNK` from Module 12)
// ---------------------------------------------------------------------------

export const SCT2_LNK = [
  's2_ELcap',
  's2_gc',
  's2_gp',
  's2_smode',
  's2_s',
  's2_etaU',
  'rf_c1',
  'rf_c2',
  'rf_c3',
  'rf_s1',
  'rf_s2',
  'rf_s3',
  'rf_i1',
  'rf_i2',
  'rf_i3',
  'rf_g1',
  'rf_g2',
  'rf_g3',
  'rf_r1',
  'rf_r2',
  'rf_r3',
  's2_dhL',
  's2_dzL',
] as const;

export function sctSep(): boolean {
  const e = $('tq_sct');
  return Boolean(e && e.value === '1');
}

export function sctNm(id: string, def: [string, string]): [string, string] {
  const raw = ($('' + id)?.value || '')
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter(Boolean);
  return [
    raw[0] || def[0],
    raw[1] || (raw[0] && raw[0] !== def[0] ? `${raw[0]} (2)` : def[1]),
  ];
}

export function sctSplit(arr: string[], kind: 'm' | 't'): string[] {
  if (!sctSep()) return arr;
  const n = kind === 'm' ? sctNm('tq_mo', ['M1', 'M2']) : sctNm('td_name', ['T1', 'T2']);
  const w = kind === 'm' ? 'mố' : 'trụ';
  return arr.flatMap((x) =>
    x === 'Sức chịu tải của cọc theo đất nền' ? [`${x} - ${w} ${n[0]}`, `${x} - ${w} ${n[1]}`] : [x],
  );
}

export function sctSheetNm(p: string, n: string): string {
  return (p + n).replace(/[:\\/?*[\]]/g, '').slice(0, 31);
}

export function sctTitles(): void {
  if (typeof document === 'undefined') return;
  const on = sctSep();
  if (document.body) document.body.classList.toggle('sct2', on);
  const m = sctNm('tq_mo', ['M1', 'M2']);
  const t = sctNm('td_name', ['T1', 'T2']);
  const applyTitle = (pid: string, tab: number, suf: string, lab: string) => {
    const p = document.getElementById(pid);
    const h = p?.querySelector('h1.ttl') as HTMLElement | null;
    if (h) {
      if (h.dataset.t0 == null) h.dataset.t0 = h.textContent || '';
      const w = on && suf ? `${h.dataset.t0} - ${suf}` : h.dataset.t0;
      if (h.textContent !== w) h.textContent = w;
    }
    const b = document.querySelector(`.tabs .tab[data-t="${tab}"]`) as HTMLElement | null;
    if (b) {
      if (b.dataset.t0 == null) b.dataset.t0 = b.textContent || '';
      const w = on && lab ? lab : b.dataset.t0;
      if (b.textContent !== w) b.textContent = w;
    }
  };
  applyTitle('tab2', 2, `MỐ ${m[0].toUpperCase()}`, `12. Sức chịu tải cọc mố ${m[0]}`);
  applyTitle('tab56', 56, `MỐ ${m[1].toUpperCase()}`, `12b. Sức chịu tải cọc mố ${m[1]}`);
  applyTitle('tab24', 24, `TRỤ ${t[0].toUpperCase()}`, `19. Sức chịu tải cọc trụ ${t[0]}`);
  applyTitle('tab57', 57, `TRỤ ${t[1].toUpperCase()}`, `19b. Sức chịu tải cọc trụ ${t[1]}`);
  applyTitle('tab50', 50, `TRỤ ${t[0].toUpperCase()}`, `19. Sức chịu tải cọc trụ ${t[0]}`);
  applyTitle('tab58', 58, `TRỤ ${t[1].toUpperCase()}`, `19b. Sức chịu tải cọc trụ ${t[1]}`);
}

export function sct2Run(
  src: ContextPrefix,
  dst: ContextPrefix,
  runners?: { sctStep?: () => void; sctCheck?: () => void },
): void {
  const dstBhDom = typeof document !== 'undefined' ? document.getElementById(dst + 's2_bh') : null;
  if (!sctSep() || (!dstBhDom && !valueStore.has(dst + 's2_bh'))) return;

  const M0 = src === '' ? contextState.MCR : CTX[src]?.MCR ?? null;
  const who = src === '' ? 'mố' : 'trụ';

  for (const id of SCT2_LNK) {
    const srcDom = typeof document !== 'undefined' ? document.getElementById(src + id) : null;
    const dstDom = typeof document !== 'undefined' ? document.getElementById(dst + id) : null;
    if (srcDom && dstDom) {
      const a = srcDom as HTMLInputElement | HTMLSelectElement;
      const b = dstDom as HTMLInputElement | HTMLSelectElement;
      if (b.value !== a.value) b.value = a.value;
      if ('readOnly' in b) b.readOnly = true;
      if (b.tagName === 'SELECT') b.disabled = true;
      b.classList.add('lnk');
      b.title = `Lấy theo sheet sức chịu tải cọc ${who} thứ nhất (cùng kích thước, cùng bố trí cọc)`;
    } else if (valueStore.has(src + id)) {
      const srcRec = ensureVirtualRecord(src + id);
      const dstRec = ensureVirtualRecord(dst + id);
      dstRec.value = srcRec.value;
      dstRec.readOnly = true;
      dstRec.disabled = true;
    }
  }

  // Ground surface ELgs copies only when destination is blank
  const srcGs = (typeof document !== 'undefined' ? (document.getElementById(src + 's2_ELgs') as HTMLInputElement | null)?.value : undefined) ?? valueStore.get(src + 's2_ELgs')?.value;
  const dstGsEl = typeof document !== 'undefined' ? (document.getElementById(dst + 's2_ELgs') as HTMLInputElement | null) : null;
  if (srcGs != null) {
    if (dstGsEl && !String(dstGsEl.value).trim()) dstGsEl.value = srcGs;
    else if (!dstGsEl && valueStore.has(dst + 's2_ELgs') && !valueStore.get(dst + 's2_ELgs')!.value.trim()) {
      ensureVirtualRecord(dst + 's2_ELgs').value = srcGs;
    }
  }

  withCtx(dst, () => {
    contextState.MCR = M0;
    try {
      runners?.sctStep?.();
    } catch {
      // ignore in headless/partial state
    }
    try {
      runners?.sctCheck?.();
    } catch {
      // ignore in headless/partial state
    }
  });
}

// ---------------------------------------------------------------------------
// 4. `$`, Value / DOM Accessors & Numeric Helpers
// ---------------------------------------------------------------------------

/** Resolve DOM element or headless virtual store handle using `IDP` + `CTXPAR`. */
export function $(id: string): ContextElementLike | null {
  const candidates = resolveScopedIdCandidates(id, IDP);
  if (typeof document !== 'undefined') {
    for (const cand of candidates) {
      const el = document.getElementById(cand);
      if (el) return el as unknown as ContextElementLike;
    }
  }
  for (const cand of candidates) {
    if (valueStore.has(cand)) return getVirtualHandle(cand);
  }
  return null;
}

/** Read raw string value from scoped element or in-memory store. */
export function v(id: string, fallback = ''): string {
  const el = $(id);
  if (!el) return fallback;
  return el.value != null ? String(el.value) : fallback;
}

/** Write value to scoped DOM element and in-memory store. */
export function sv(id: string, val: string | number | boolean): string {
  const str = String(val ?? '');
  const candidates = resolveScopedIdCandidates(id, IDP);
  let targetKey = IDP ? `${IDP}${id}` : id;
  if (typeof document !== 'undefined') {
    for (const cand of candidates) {
      const el = document.getElementById(cand) as HTMLInputElement | HTMLSelectElement | null;
      if (el) {
        if ('checked' in el && typeof val === 'boolean' && (el as HTMLInputElement).type === 'checkbox') {
          (el as HTMLInputElement).checked = val;
        }
        el.value = str;
        targetKey = cand;
        break;
      }
    }
  }
  if (!valueStore.has(targetKey)) {
    for (const cand of candidates) {
      if (valueStore.has(cand)) {
        targetKey = cand;
        break;
      }
    }
  }
  const rec = ensureVirtualRecord(targetKey, str);
  rec.value = str;
  if (typeof val === 'boolean') rec.checked = val;
  return str;
}

/** Safely update DOM element `.textContent` or `.innerHTML` plus headless output store. */
export function set(id: string, content: string | number, decimals?: number): void {
  const str =
    typeof content === 'number' ? fx(content, decimals ?? 2) : String(content ?? '');
  const candidates = resolveScopedIdCandidates(id, IDP);
  const isMarkup = /<[a-z!/]/i.test(str) || /&[a-z#0-9]+;/i.test(str);
  let storedKey = IDP ? `${IDP}${id}` : id;

  if (typeof document !== 'undefined') {
    for (const cand of candidates) {
      const el = document.getElementById(cand);
      if (el) {
        if (isMarkup) el.innerHTML = str;
        else el.textContent = str;
        storedKey = cand;
        break;
      }
    }
  }
  outputStore.set(storedKey, str);
  const rec = ensureVirtualRecord(storedKey);
  if (isMarkup) rec.innerHTML = str;
  else rec.textContent = str;
}

/** Safely update CSS className on a scoped element. */
export function cls(id: string, className: string): void {
  const el = $(id);
  if (el) el.className = className;
}

/** Parse number from string/DOM element (`num` & `vn`). Supports comma decimals. */
export function num(idOrEl: string | ContextElementLike | null, fallback = 0): number {
  const el = typeof idOrEl === 'string' ? $(idOrEl) : idOrEl;
  if (!el) return fallback;
  const parsed = parseFloat(String(el.value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function vn(id: string, fallback = 0): number {
  return num(id, fallback);
}

/** Variant matching `qdN` / `tcN` (`07` / `06`) with comma support. */
export function qdN(id: string): number {
  return num(id, 0);
}

/** Finite numeric coercion helper returning `fallback` when non-finite. */
export function I0(val: unknown, fallback = 0): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : fallback;
  const parsed = parseFloat(String(val ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Finite rounded integer helper. */
export function I(val: unknown, fallback = 0): number {
  return Math.round(I0(val, fallback));
}

/**
 * Positive non-zero fallback (`nz(v, d)` from Module 07) or 1-arg zero-denominator guard (`nz(x)`).
 */
export function nz(val: number, fallback?: number): number {
  if (fallback !== undefined) {
    return Number.isFinite(val) && val > 0 ? val : fallback;
  }
  const vNum = Number.isFinite(val) ? val : 0;
  return Math.abs(vNum) < 1e-12 ? (vNum < 0 ? -1e-12 : 1e-12) : vNum;
}

/** Standard fixed formatter matching `02_core_utils_and_column_pm.js:72` (`""` when non-finite). */
export function fx(x: number | null | undefined, d = 1): string {
  return x == null || !Number.isFinite(x) ? '' : x.toFixed(d);
}

/** Default fixed formatter (`"-"` when non-finite). */
export function F(x: number | null | undefined, d = 2): string {
  return x == null || !Number.isFinite(x) ? '-' : x.toFixed(d);
}

/** Culvert formatter matching `11_culverts_box_and_circular.js:1316` (`"-"` when non-finite). */
export const cf = (x: number | null | undefined, d = 2): string =>
  x == null || !Number.isFinite(x) ? '-' : x.toFixed(d);

/** Grouping thousands formatter matching `06:2737` (`tf`) and `07:221` (`qf`). */
export function tf(x: number | null | undefined, d = 2): string {
  if (x == null || !Number.isFinite(x)) return '-';
  const [intPart, fracPart] = (+x).toFixed(d).split('.');
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fracPart ? `.${fracPart}` : '');
}

export const qf = tf;

/** Clamped 1D piecewise linear interpolation (`02:156`, `11:31`). */
export function interp1(x: number, xs: readonly number[], ys: readonly number[]): number {
  if (!xs.length || !ys.length) return 0;
  if (x <= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i++) {
    if (x <= xs[i]) {
      return ys[i - 1] + ((ys[i] - ys[i - 1]) * (x - xs[i - 1])) / (xs[i] - xs[i - 1]);
    }
  }
  return ys[ys.length - 1];
}

// ---------------------------------------------------------------------------
// 5. AASHTO 2004 Bilinear Shear Tables & MCOC Summary Parser (`02`)
// ---------------------------------------------------------------------------

export const TH_V = [0.075, 0.1, 0.125, 0.15, 0.175, 0.2, 0.225, 0.25] as const;
export const TH_E = [-0.2, -0.1, -0.05, 0, 0.125, 0.25, 0.5, 0.75, 1] as const;

export const TT: readonly (readonly number[])[] = [
  [22.3, 20.4, 21, 21.8, 24.3, 26.6, 30.5, 33.7, 36.4],
  [18.1, 20.4, 21.4, 22.5, 24.9, 27.1, 30.8, 34, 36.7],
  [19.9, 21.9, 22.8, 23.7, 25.9, 27.9, 31.4, 34.4, 37],
  [21.6, 23.3, 24.2, 25, 26.9, 28.8, 32.1, 34.9, 37.3],
  [23.2, 24.7, 25.5, 26.2, 28, 29.7, 32.7, 35.2, 36.8],
  [24.7, 26.1, 26.7, 27.4, 29, 30.6, 32.8, 34.5, 36.1],
  [26.1, 27.3, 27.9, 28.5, 30, 30.8, 32.3, 34, 35.7],
  [27.5, 28.6, 29.1, 29.7, 30.6, 31.3, 32.8, 34.3, 35.8],
];

export const TB: readonly (readonly number[])[] = [
  [6.32, 4.75, 4.1, 3.75, 3.24, 2.94, 2.59, 2.38, 2.23],
  [3.79, 3.38, 3.24, 3.14, 2.91, 2.75, 2.5, 2.32, 2.18],
  [3.18, 2.99, 2.94, 2.87, 2.74, 2.62, 2.42, 2.26, 2.13],
  [2.88, 2.79, 2.78, 2.72, 2.6, 2.52, 2.36, 2.21, 2.08],
  [2.73, 2.66, 2.65, 2.6, 2.52, 2.44, 2.28, 2.14, 1.96],
  [2.63, 2.59, 2.52, 2.51, 2.43, 2.37, 2.14, 1.94, 1.79],
  [2.53, 2.45, 2.42, 2.4, 2.34, 2.14, 1.86, 1.73, 1.64],
  [2.39, 2.39, 2.33, 2.33, 2.12, 1.93, 1.7, 1.58, 1.5],
];

export function bilin(T: readonly (readonly number[])[], vVal: number, eVal: number): number {
  const cl = (x: number, a: readonly number[]) => Math.min(a[a.length - 1], Math.max(a[0], x));
  const vv = cl(vVal, TH_V);
  const ee = cl(eVal, TH_E);
  const ix = (a: readonly number[]) => (x: number): [number, number] => {
    let i = 0;
    while (i < a.length - 2 && x > a[i + 1]) i++;
    return [i, (x - a[i]) / (a[i + 1] - a[i])];
  };
  const [i, ti] = ix(TH_V)(vv);
  const [j, tj] = ix(TH_E)(ee);
  const r0 = T[i][j] + (T[i][j + 1] - T[i][j]) * tj;
  const r1 = T[i + 1][j] + (T[i + 1][j + 1] - T[i + 1][j]) * tj;
  return r0 + (r1 - r0) * ti;
}

export const SAMPLE_CD =
  '                              BANG TONG KET NOI LUC\n' +
  '                                                                     \n' +
  '      T.C  T.H     N        Q2       Q3        M1         M2         M3\n' +
  ' \n' +
  'Nmin    1   8     74.43   -34.11     0.00      0.000      0.000     70.219\n' +
  'Nmax    3   1    345.16   -42.19     0.00      0.000      0.000     76.617\n' +
  'Q2max   1   1     99.39   -42.19     0.00      0.000      0.000     76.617\n' +
  'Q3max   1   4     84.38   -30.21    -1.86      0.000     -5.289     62.975\n' +
  'M1max   1   1     99.39   -42.19     0.00      0.000      0.000     76.617\n' +
  'M2max   1   4     84.38   -30.21    -1.86      0.000     -5.289     62.975\n' +
  'M3max   1   1     99.39   -42.19     0.00      0.000      0.000     76.617\n';

export const SAMPLE_DB =
  '                              BANG TONG KET NOI LUC\n' +
  '                                                                     \n' +
  '      T.C  T.H     N        Q2       Q3        M1         M2         M3\n' +
  ' \n' +
  'Nmin    2   3    -52.49   -62.03    -6.77      0.000    -17.994    110.962\n' +
  'Nmax    4   3    330.16   -62.03    -6.77      0.000    -17.994    110.962\n' +
  'Q2max   1   3    -44.55   -62.03    -6.77      0.000    -17.994    110.962\n' +
  'Q3max   1   2     18.03   -48.08   -22.59      0.000    -60.698     85.414\n' +
  'M1max   1   1     12.25   -48.80   -22.57      0.000    -59.980     85.697\n' +
  'M2max   1   2     18.03   -48.08   -22.59      0.000    -60.698     85.414\n' +
  'M3max   1   3    -44.55   -62.03    -6.77      0.000    -17.994    110.962\n';

export const KEYS = ['Nmin', 'Nmax', 'Q2max', 'Q3max', 'M1max', 'M2max', 'M3max'] as const;
export type McocSummaryKey = (typeof KEYS)[number];

export interface ParsedSummaryRow {
  tc: number;
  th: number;
  N: number;
  Q2: number;
  Q3: number;
  M1: number;
  M2: number;
  M3: number;
}

export type ParsedSummaryMap = Partial<Record<McocSummaryKey, ParsedSummaryRow>>;

export function parseSum(txt: string): ParsedSummaryMap {
  const o: ParsedSummaryMap = {};
  for (const l of String(txt || '').split(/\r?\n/)) {
    const m = l.trim().match(/^(Nmin|Nmax|Q2max|Q3max|M1max|M2max|M3max)\s+(.+)$/i);
    if (!m) continue;
    const vals = m[2].trim().split(/\s+/).map(Number);
    if (vals.length < 8 || vals.slice(0, 8).some((x) => !Number.isFinite(x))) continue;
    const key = KEYS.find((k) => k.toLowerCase() === m[1].toLowerCase());
    if (!key) continue;
    o[key] = {
      tc: vals[0],
      th: vals[1],
      N: vals[2],
      Q2: vals[3],
      Q3: vals[4],
      M1: vals[5],
      M2: vals[6],
      M3: vals[7],
    };
  }
  return o;
}

/** Multi-line numeric table parser matching `nums` from Module 12 (`3009-3020`). */
export function nums(t: string): number[][] {
  return String(t || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^[#/]/.test(l))
    .map((l) =>
      l
        .replace(/,(?=\d)/g, '.')
        .split(/[\s;\t]+/)
        .map(Number),
    )
    .filter((a) => a.length > 0 && a.every(Number.isFinite));
}

// ---------------------------------------------------------------------------
// 6. Report Markup & Status Shims (`MX`, `FR`, `klDiv`, `okc`, `okc2`)
// ---------------------------------------------------------------------------

export function MX(tex: string): string {
  return (
    '<span class="m" data-tex="' +
    String(tex)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;') +
    '"></span>'
  );
}

export function FR(tex: string, rest = ''): string {
  return `<div class="row f"><span></span><span>${MX(tex)}</span>${rest}</div>`;
}

export const okc = (b: boolean): string =>
  b ? '<td class="c ok">Đạt</td>' : '<td class="c bad">Không đạt</td>';

export const okc2 = (ok: boolean): string =>
  `<td class="c ${ok ? 'ok' : 'bad'}">${ok ? 'OK' : 'NG'}</td>`;

export function klDiv(paneId: string, elId: string, ok: boolean, txt: string): void {
  if (typeof document === 'undefined') {
    setOutputValue(elId, `KẾT LUẬN: ${txt}`);
    return;
  }
  const p = document.getElementById(paneId);
  if (!p) return;
  let e = document.getElementById(elId);
  if (!e) {
    e = document.createElement('h2');
    e.id = elId;
    p.appendChild(e);
  }
  e.innerHTML = `KẾT LUẬN: <span class="${ok ? 'ok' : 'bad'}">${txt}</span>`;
}

// ---------------------------------------------------------------------------
// 7. Late-Binding Visual / Report Hook Registry (Zero Circular Imports)
// ---------------------------------------------------------------------------

export interface VisualReportHooks {
  renderMath?: () => void;
  renderCircularPm?: (payload: {
    prefix: ContextPrefix;
    curve: unknown;
    loads: unknown[];
    section: unknown;
  }) => void;
  renderPm3d?: (payload: {
    prefix: ContextPrefix;
    state: 'CD' | 'DB';
    st3: unknown;
  }) => void;
  renderShallowFdnFigs?: (payload: {
    prefix: string;
    result: unknown;
  }) => void;
  renderPileGroup?: (payload: {
    prefix: ContextPrefix;
    mcResult: unknown;
    depthProfile?: unknown;
  }) => void;
  renderDrilledShaft?: (payload: {
    prefix: ContextPrefix;
    shaftResult: unknown;
    groupSvgData?: unknown;
  }) => void;
  renderBoxCulvert?: (payload: { result: unknown }) => void;
  renderChn?: (payload: { result: unknown }) => void;
  renderPipeCulvert?: (payload: { result: unknown }) => void;
  renderGravityWall?: (payload: { result: unknown }) => void;
  renderCantileverWall?: (payload: { result: unknown }) => void;
  renderGirderHollow?: (payload: { result: unknown }) => void;
  renderGirderI?: (payload: { result: unknown }) => void;
  renderAbutmentHeavy?: (payload: { result: unknown }) => void;
  renderAbutmentFlex?: (payload: { result: unknown }) => void;
  renderPierFlex?: (payload: { result: unknown }) => void;
  renderPierSolid?: (payload: { result: unknown }) => void;
  renderHydrology?: (payload: { mode: 'bridge' | 'culvert'; result: unknown }) => void;
}

let visualHooksRegistry: VisualReportHooks = {};

export function registerVisualHooks(hooks: Partial<VisualReportHooks>): void {
  visualHooksRegistry = { ...visualHooksRegistry, ...hooks };
}

export function getVisualHooks(): VisualReportHooks {
  return visualHooksRegistry;
}

export function clearVisualHooks(): void {
  visualHooksRegistry = {};
}
