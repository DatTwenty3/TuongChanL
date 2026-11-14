import {
  APP_MODES,
  KEEP_APP_ID,
  KEEP_MIGRATION_KEYS_BY_VERSION,
  KEEP_SCHEMA_VERSION,
  PROJDEF,
  STORAGE_KEYS,
  type AppMode,
  type CustomRainfallStation,
  type ExportScope,
  type ProjectMetadata,
  type ProjectSnapshot,
} from '../types/project.ts';

export type ProjectWireObject = {
  _app: typeof KEEP_APP_ID;
  _v: typeof KEEP_SCHEMA_VERSION;
  _mode: AppMode;
  _date: string;
} & Record<string, string | number>;

export interface ExpNameOptions {
  scope?: ExportScope;
  openTabName?: string | null;
  documentRoot?: ParentNode | null;
}

export interface ExportFilenameOptions extends ExpNameOptions {
  mode: AppMode;
  ext: 'xlsx' | 'pdf' | 'json';
  date?: Date;
  /** Diameter `D` (mm) for `cau` mode `.xlsx` filenames (`Kiem toan CKN D<D> ...`) */
  D?: number | string | null;
  /** Number of box culvert cells `n` for `ch` mode (`Bang tinh cong hop <n> ngan ...`) */
  chCells?: number | string | null;
  /** Circular pipe internal diameter `D0` (m) for `ct` mode (`Bang tinh cong tron D<round(D0*1000)> ...`) */
  ctD0?: number | string | null;
  /** Gravity retaining wall height `H` (m) for `tc` mode */
  tcH?: number | string | null;
  /** Cantilever L-wall height `H` (m) for `tl` mode */
  tlH?: number | string | null;
}

export interface StoredCustomRainRecord {
  ten: string;
  ser: string;
  n: number;
  t: number;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Format local date as `YYYYMMDD` matching `18_appmode_export_xlsx_pdf.js`.
 */
export function formatDateYmd(date: Date = new Date()): string {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`;
}

/**
 * Normalize an arbitrary mode string into one of the 7 canonical `AppMode` IDs (`'cau'` default).
 */
export function normalizeAppMode(mode: unknown): AppMode {
  if (typeof mode === 'string' && (APP_MODES as readonly string[]).includes(mode)) {
    return mode as AppMode;
  }
  return 'cau';
}

/**
 * Trigger a pure-browser file download via `Blob` + temporary `<a download>` anchor.
 * Zero Electron IPC or third-party host bridges.
 */
export function downloadBlob(
  filename: string,
  data: BlobPart | Uint8Array | Blob,
  mimeType = 'application/octet-stream',
): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    return;
  }
  const blob =
    data instanceof Blob
      ? data
      : data instanceof Uint8Array
        ? new Blob([data.slice()], { type: mimeType })
        : new Blob([data], { type: mimeType });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Ignore cleanup failures in synthetic DOM environments
    }
  }, 1500);
}

/**
 * Detect active visible tab `{ id, name }` when export scope is `'one'` (`expOne()` in module `18`).
 */
export function resolveOpenTabInfo(
  opts?: ExpNameOptions,
): { id: string; name: string } | null {
  if (opts?.openTabName) {
    return { id: 'open', name: opts.openTabName };
  }
  const root = opts?.documentRoot ?? (typeof document !== 'undefined' ? document : null);
  if (!root) return null;

  let scope = opts?.scope;
  if (!scope) {
    const scEl = root.querySelector<HTMLSelectElement>('#expScope');
    if (scEl) scope = scEl.value === 'one' ? 'one' : 'all';
  }
  if (scope !== 'one') return null;

  const tabs = Array.from(root.querySelectorAll<HTMLElement>('[id^="tab"]'));
  const openPane = tabs.find(
    (e) => /^tab\d+$/.test(e.id) && !e.hidden && (e.offsetParent !== null || e.style.display !== 'none'),
  );
  if (!openPane) return null;

  const tabId = openPane.id.slice(3);
  const btn = root.querySelector<HTMLElement>(`.tabs .tab[data-t="${tabId}"]`);
  return { id: openPane.id, name: (btn?.textContent ?? '').trim() || openPane.id };
}

/**
 * Append normalized active tab suffix before extension when scope === `'one'` (`expName()` in module `18`).
 */
export function expName(name: string, opts?: ExpNameOptions): string {
  if (opts?.scope === 'all') return name;
  const openTab = resolveOpenTabInfo(opts);
  if (!openTab) return name;

  const cleanTab = openTab.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9 .,-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanTab) return name;
  return name.replace(/(\.[a-z0-9]+)$/i, ` - ${cleanTab}$1`);
}

function fmtMetaToken(v: number | string | null | undefined, suffix = ''): string {
  if (v == null || v === '') return '';
  return `${v}${suffix}`;
}

/**
 * Generate authoritative Vietnamese ASCII export filenames across all 7 calculation modes
 * (`specs/parity-spec.md` §2.1 & `18_appmode_export_xlsx_pdf.js:1770-1912`).
 */
export function buildExportFilename(opts: ExportFilenameOptions): string {
  const ymd = formatDateYmd(opts.date ?? new Date());
  const m = normalizeAppMode(opts.mode);

  if (opts.ext === 'json') {
    const labelMap: Readonly<Record<AppMode, string>> = {
      cau: 'cau',
      ch: 'cong hop',
      ct: 'cong tron',
      tc: 'tuong chan',
      tl: 'tuong chan L',
      tv: 'thuy van cau',
      tvc: 'thuy van cong',
    };
    return `So lieu ${labelMap[m]} ${ymd}.json`;
  }

  let baseName: string;
  if (m === 'tl') {
    baseName = `Bang tinh tuong chan L H${fmtMetaToken(opts.tlH, '')}m ${ymd}.${opts.ext}`;
  } else if (m === 'tvc') {
    baseName = `Bang tinh thuy van cong ${ymd}.${opts.ext}`;
  } else if (m === 'tv') {
    baseName = `Bang tinh thuy van cau ${ymd}.${opts.ext}`;
  } else if (m === 'tc') {
    baseName = `Bang tinh tuong chan H${fmtMetaToken(opts.tcH, '')}m ${ymd}.${opts.ext}`;
  } else if (m === 'ct') {
    const dMm =
      opts.ctD0 != null && Number.isFinite(Number(opts.ctD0))
        ? Math.round(Number(opts.ctD0) * 1000)
        : '';
    baseName = `Bang tinh cong tron D${dMm} ${ymd}.${opts.ext}`;
  } else if (m === 'ch') {
    const nPart =
      opts.chCells != null && String(opts.chCells).trim() !== '' ? `${opts.chCells} ngan ` : '';
    baseName = `Bang tinh cong hop ${nPart}${ymd}.${opts.ext}`;
  } else if (opts.ext === 'pdf') {
    baseName = `Bang tinh mo coc ${ymd}.pdf`;
  } else {
    baseName = `Kiem toan CKN D${fmtMetaToken(opts.D, '')} ${ymd}.xlsx`;
  }

  return expName(baseName, opts);
}

/**
 * Apply `_v < 9` schema cleanup & geolocation field migrations matching
 * `12_piles_geotech_mcoc_and_pm3d.js:3947-3970` and `18_appmode_export_xlsx_pdf.js:1950`.
 */
export function migrateSnapshotValues(
  values: Record<string, string>,
  rawVersion: number,
): Record<string, string> {
  const out: Record<string, string> = { ...values };

  if (out.s2_WL == null) delete out.s2_geo;
  if (!out.s2_spt) delete out.s2_spt;

  const versions = Object.keys(KEEP_MIGRATION_KEYS_BY_VERSION)
    .map((k) => Number(k) as keyof typeof KEEP_MIGRATION_KEYS_BY_VERSION)
    .sort((a, b) => a - b);

  for (const ver of versions) {
    if ((rawVersion || 0) < ver) {
      for (const deprecatedKey of KEEP_MIGRATION_KEYS_BY_VERSION[ver]) {
        delete out[deprecatedKey];
      }
    }
  }

  if (!Object.prototype.hasOwnProperty.call(out, 'tq_off')) {
    out.tq_off = '';
  }

  return out;
}

/**
 * Build a flat desktop-compatible project JSON payload `{ _app: "ckn11823", _v: 9, _mode, _date, ...values }`
 * matching `18_appmode_export_xlsx_pdf.js:1889-1913`.
 */
export function serializeProjectWireObject(input: {
  mode: AppMode;
  values: Record<string, string>;
  metadata?: Partial<ProjectMetadata>;
  date?: string;
}): ProjectWireObject {
  const mergedValues: Record<string, string> = { ...input.values };
  if (input.metadata) {
    (['pj1', 'pj2', 'pj3', 'pj4', 'pj5', 'pj6'] as const).forEach((k) => {
      const v = input.metadata?.[k];
      if (v != null) mergedValues[k] = String(v);
    });
  }

  return {
    _app: KEEP_APP_ID,
    _v: KEEP_SCHEMA_VERSION,
    _mode: normalizeAppMode(input.mode),
    _date: input.date ?? new Date().toISOString(),
    ...mergedValues,
  };
}

/**
 * Format project snapshot JSON string (`indent = 1`, exact module `18` formatting).
 */
export function serializeProjectJson(input: {
  mode: AppMode;
  values: Record<string, string>;
  metadata?: Partial<ProjectMetadata>;
  date?: string;
}): string {
  return JSON.stringify(serializeProjectWireObject(input), null, 1);
}

/**
 * Build structured `ProjectSnapshot` from values, mode, and optional metadata.
 */
export function serializeProjectSnapshot(input: {
  mode: AppMode;
  values: Record<string, string>;
  metadata?: Partial<ProjectMetadata>;
  date?: string;
}): ProjectSnapshot {
  const values = { ...input.values };
  const metadata: Partial<ProjectMetadata> = { ...(input.metadata ?? {}) };
  (['pj1', 'pj2', 'pj3', 'pj4', 'pj5', 'pj6'] as const).forEach((k) => {
    if (metadata[k] != null && values[k] == null) {
      values[k] = String(metadata[k]);
    } else if (values[k] != null && metadata[k] == null) {
      metadata[k] = String(values[k]);
    }
  });
  return {
    _app: KEEP_APP_ID,
    _v: KEEP_SCHEMA_VERSION,
    _mode: normalizeAppMode(input.mode),
    _date: input.date ?? new Date().toISOString(),
    values,
    metadata,
  };
}

/**
 * Parse and validate an imported `.json` project payload (supporting both flat wire JSON
 * and nested `{ values }` `ProjectSnapshot` JSON), running `_v < 9` migrations cleanly.
 */
export function parseProjectJson(rawJson: string): ProjectSnapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(rawJson);
  } catch {
    throw new Error('File không phải file số liệu của bảng tính này.');
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('File không phải file số liệu của bảng tính này.');
  }

  const obj = raw as Record<string, unknown>;
  if (obj._app !== KEEP_APP_ID) {
    throw new Error('File không phải file số liệu của bảng tính này.');
  }

  const rawVersion = typeof obj._v === 'number' && Number.isFinite(obj._v) ? obj._v : 0;
  const mode = normalizeAppMode(obj._mode);
  const date = typeof obj._date === 'string' && obj._date ? obj._date : new Date().toISOString();

  const rawValues: Record<string, string> = {};
  if (obj.values && typeof obj.values === 'object' && !Array.isArray(obj.values)) {
    for (const [k, v] of Object.entries(obj.values as Record<string, unknown>)) {
      if (v != null) rawValues[k] = String(v);
    }
  }

  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('_') || k === 'values' || k === 'metadata') continue;
    if (v != null) rawValues[k] = String(v);
  }

  const migratedValues = migrateSnapshotValues(rawValues, rawVersion);

  const metadata: Partial<ProjectMetadata> = {};
  if (obj.metadata && typeof obj.metadata === 'object' && !Array.isArray(obj.metadata)) {
    for (const k of ['pj1', 'pj2', 'pj3', 'pj4', 'pj5', 'pj6'] as const) {
      const mv = (obj.metadata as Record<string, unknown>)[k];
      if (mv != null) {
        metadata[k] = String(mv);
        if (migratedValues[k] == null) migratedValues[k] = String(mv);
      }
    }
  }
  for (const k of ['pj1', 'pj2', 'pj3', 'pj4', 'pj5', 'pj6'] as const) {
    if (migratedValues[k] != null) {
      metadata[k] = migratedValues[k];
    }
  }

  return {
    _app: KEEP_APP_ID,
    _v: KEEP_SCHEMA_VERSION,
    _mode: mode,
    _date: date,
    values: migratedValues,
    metadata,
  };
}

/**
 * Default `pj4`/`pj6` project header labels for standalone mode switching.
 */
export function getModeProjectDefaults(
  mode: AppMode,
): Partial<Pick<ProjectMetadata, 'pj4' | 'pj6'>> {
  if (mode === 'cau') {
    return { pj6: 'BẢNG TÍNH TOÁN KẾT CẤU CẦU' };
  }
  return { ...PROJDEF[mode] };
}

/**
 * Collect all `input.in, select.in, textarea, input.pj` element values with IDs (`KEEP` list).
 */
export function collectKeepValues(root?: ParentNode | null): Record<string, string> {
  const doc = root ?? (typeof document !== 'undefined' ? document : null);
  if (!doc) return {};
  const values: Record<string, string> = {};
  doc
    .querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      'input.in, select.in, textarea, input.pj',
    )
    .forEach((el) => {
      if (el.id) values[el.id] = el.value;
    });
  return values;
}

/**
 * Apply parsed `ProjectSnapshot` values onto matching DOM elements (`KEEP` targets).
 */
export function applyKeepValues(
  values: Record<string, string>,
  root?: ParentNode | null,
): number {
  const doc = root ?? (typeof document !== 'undefined' ? document : null);
  if (!doc) return 0;
  let count = 0;
  doc
    .querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      'input.in, select.in, textarea, input.pj',
    )
    .forEach((el) => {
      if (el.id && Object.prototype.hasOwnProperty.call(values, el.id)) {
        el.value = values[el.id];
        count += 1;
      }
    });
  return count;
}

// ---------------------------------------------------------------------------
// Local `TM_DB` Custom Rainfall Station Persistence (Pure `localStorage`)
// ---------------------------------------------------------------------------

export function tmSlug(name: string): string {
  return (
    String(name)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 120) || 'tram'
  );
}

/**
 * Parse annual rainfall series lines `"<year> <value>"` matching `17_culvert_hydrology_and_dxftools.js:1591-1603`.
 */
export function tmParse(text: string): Array<[number, number]> {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) =>
      line
        .trim()
        .replace(/,(?=\d)/g, '.')
        .split(/[\s;\t]+/)
        .map(Number),
    )
    .filter(
      (arr) =>
        arr.length >= 2 &&
        arr.every((v) => Number.isFinite(v)) &&
        arr[0] > 1800 &&
        arr[0] < 2200 &&
        arr[1] > 0,
    )
    .map((arr) => [arr[0], arr[1]]);
}

function getStorage(storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null) {
  if (storage !== undefined) return storage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

function readCustomRainMap(
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null,
): Record<string, StoredCustomRainRecord> {
  const st = getStorage(storage);
  if (!st) return {};
  try {
    const raw = st.getItem(STORAGE_KEYS.customRainDb);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, StoredCustomRainRecord>;
  } catch {
    return {};
  }
}

export function loadCustomRainStations(
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null,
): CustomRainfallStation[] {
  const rawMap = readCustomRainMap(storage);
  const out: CustomRainfallStation[] = [];

  for (const [slug, rec] of Object.entries(rawMap)) {
    if (!rec || typeof rec.ten !== 'string') continue;
    const ser = Array.isArray(rec.ser)
      ? (rec.ser as Array<[number, number]>).filter(
          (p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]),
        )
      : tmParse(String(rec.ser ?? ''));
    if (ser.length >= 3) {
      out.push({ slug, name: rec.ten, tg: 'rx', ser });
    }
  }

  return out;
}

export function saveCustomRainStation(
  name: string,
  serOrText: string | readonly [number, number][],
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null,
): CustomRainfallStation | null {
  const cleanName = String(name || '').trim();
  if (!cleanName || cleanName === 'khac') return null;

  const ser: Array<[number, number]> =
    typeof serOrText === 'string'
      ? tmParse(serOrText)
      : serOrText
          .filter((a) => Number.isFinite(a[0]) && Number.isFinite(a[1]) && a[0] > 1800 && a[1] > 0)
          .map((a) => [a[0], a[1]]);

  if (ser.length < 3) return null;

  const slug = tmSlug(cleanName);
  const record: StoredCustomRainRecord = {
    ten: cleanName,
    ser: ser.map((a) => `${a[0]} ${a[1]}`).join('\n'),
    n: ser.length,
    t: Date.now(),
  };

  const st = getStorage(storage);
  if (st) {
    const map = readCustomRainMap(st);
    map[slug] = record;
    try {
      st.setItem(STORAGE_KEYS.customRainDb, JSON.stringify(map));
    } catch {
      // Ignore quota errors in restricted environments
    }
  }

  return { slug, name: cleanName, tg: 'rx', ser };
}

export function removeCustomRainStation(
  nameOrSlug: string,
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null,
): boolean {
  const st = getStorage(storage);
  if (!st) return false;
  const map = readCustomRainMap(st);
  const slug = map[nameOrSlug] ? nameOrSlug : tmSlug(nameOrSlug);
  if (!map[slug]) return false;
  delete map[slug];
  try {
    st.setItem(STORAGE_KEYS.customRainDb, JSON.stringify(map));
  } catch {
    return false;
  }
  return true;
}
