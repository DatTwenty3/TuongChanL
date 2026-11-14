import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  APPMODE_LABELS,
  APP_MODES,
  BODY_MODE_CLASS,
  CH_REBAR_AREA,
  CT_REBAR_AREA,
  CTXPAR,
  DEPRECATED_KEEP_KEYS_LT_9,
  IT_TAB,
  KEEP_APP_ID,
  KEEP_MIGRATION_KEYS_BY_VERSION,
  KEEP_SCHEMA_VERSION,
  OBJ_TABS,
  PROJDEF,
  REBAR_AREA_02,
  RESERVED_TAB_IDS,
  STATIC_DEM_FILES,
  STATIC_FONT_FILES,
  STORAGE_KEYS,
  TAB_IDS,
  VENDOR_ASSET_PATHS,
  resolveScopedIdCandidates,
  type ItemKey,
  type ProjectSnapshot,
  type TabId,
} from '../../src/culvert/types/index.ts';

const testDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(testDir, '../..');
const analysisExtractedApp = resolve(appRoot, '..', 'analysis-cau-cong', 'extracted', 'app');

function sha256File(absPath: string): string {
  return createHash('sha256').update(readFileSync(absPath)).digest('hex');
}

describe('BangTinhCauCong-Web Step 4 domain contracts & asset parity', () => {
  it('defines exact 7 APP_MODES with body classes and PROJDEF defaults', () => {
    expect(APP_MODES).toEqual(['cau', 'ch', 'ct', 'tc', 'tl', 'tv', 'tvc']);
    for (const mode of APP_MODES) {
      expect(APPMODE_LABELS[mode]).toBeTruthy();
      if (mode === 'cau') {
        expect(BODY_MODE_CLASS[mode]).toBeNull();
      } else {
        expect(BODY_MODE_CLASS[mode]).toBe(`m${mode}`);
        expect(PROJDEF[mode].pj6.length).toBeGreaterThan(10);
        expect(PROJDEF[mode].pj4.length).toBeGreaterThan(3);
      }
    }
  });

  it('matches exact 46-tab registry order and leaves 24 reserved IDs disjoint across 1..70', () => {
    expect(TAB_IDS).toHaveLength(46);
    expect(new Set(TAB_IDS).size).toBe(46);
    expect(RESERVED_TAB_IDS).toHaveLength(24);
    expect(new Set(RESERVED_TAB_IDS).size).toBe(24);

    const overlap = TAB_IDS.filter((id) =>
      (RESERVED_TAB_IDS as readonly number[]).includes(id),
    );
    expect(overlap).toEqual([]);

    const unionSorted = [...TAB_IDS, ...RESERVED_TAB_IDS].sort((a, b) => a - b);
    expect(unionSorted).toEqual(Array.from({ length: 70 }, (_, idx) => idx + 1));

    const shellPath = resolve(appRoot, '..', 'analysis-cau-cong', 'modules', 'shell.html');
    const shellHtml = readFileSync(shellPath, 'utf8');
    const parsedTabs = [...shellHtml.matchAll(/<button[^>]*class="tab[^"]*"[^>]*data-t="(\d+)"/g)].map(
      (m) => Number(m[1]),
    );
    expect([...TAB_IDS]).toEqual(parsedTabs);
  });

  it('registers exact OBJ_TABS scopes and 32-tab -> 22-item IT_TAB mapping', () => {
    const validTabs = new Set<number>(TAB_IDS);
    for (const scopeTabs of Object.values(OBJ_TABS)) {
      for (const tabId of scopeTabs) {
        expect(validTabs.has(tabId)).toBe(true);
      }
    }
    expect(OBJ_TABS.dam).toEqual([8, 9, 10, 11, 12, 13, 14]);
    expect(OBJ_TABS.mo).toEqual([4, 5, 1, 6, 2, 56, 3, 52, 43]);
    expect(OBJ_TABS.tru).toEqual([20, 21, 22, 26, 23, 24, 57, 25, 46, 47, 49, 48, 50, 58, 51, 53]);

    const itEntries = Object.entries(IT_TAB) as Array<[string, ItemKey]>;
    expect(itEntries).toHaveLength(32);
    const distinctItems = new Set(itEntries.map(([, item]) => item));
    expect(distinctItems.size).toBe(22);
    for (const [tabStr] of itEntries) {
      expect(validTabs.has(Number(tabStr) as TabId)).toBe(true);
    }
  });

  it('resolves hierarchical IDP/CTXPAR candidates in exact precedence order', () => {
    expect(CTXPAR).toEqual({ U_: 'T_', W_: 'P_' });
    expect(resolveScopedIdCandidates('d', '')).toEqual(['d']);
    expect(resolveScopedIdCandidates('d', 'Q_')).toEqual(['Q_d', 'd']);
    expect(resolveScopedIdCandidates('d', 'T_')).toEqual(['T_d', 'd']);
    expect(resolveScopedIdCandidates('d', 'U_')).toEqual(['U_d', 'T_d', 'd']);
    expect(resolveScopedIdCandidates('d', 'C_')).toEqual(['C_d', 'd']);
    expect(resolveScopedIdCandidates('d', 'P_')).toEqual(['P_d', 'd']);
    expect(resolveScopedIdCandidates('d', 'W_')).toEqual(['W_d', 'P_d', 'd']);
  });

  it('maintains KEEP v9 contract, migration cleanup keys, and valid ProjectSnapshot shape', () => {
    expect(KEEP_APP_ID).toBe('ckn11823');
    expect(KEEP_SCHEMA_VERSION).toBe(9);
    expect(STORAGE_KEYS.snapshot).toBe('ckn11823v5');
    expect(DEPRECATED_KEEP_KEYS_LT_9).toHaveLength(24);
    expect(new Set(DEPRECATED_KEEP_KEYS_LT_9).size).toBe(24);

    const migratedUnion = new Set(
      Object.values(KEEP_MIGRATION_KEYS_BY_VERSION).flat(),
    );
    expect([...migratedUnion]).toEqual([...DEPRECATED_KEEP_KEYS_LT_9]);

    const sample: ProjectSnapshot = {
      _app: KEEP_APP_ID,
      _v: KEEP_SCHEMA_VERSION,
      _mode: 'cau',
      _date: '2026-11-11T09:58:00.000Z',
      values: { pj6: 'BẢNG TÍNH TOÁN KẾT CẤU CẦU' },
    };
    expect(sample._app).toBe('ckn11823');
  });

  it('preserves module-specific rounded/unrounded rebar area tables verbatim', () => {
    expect(REBAR_AREA_02[14]).toBe(154);
    expect(REBAR_AREA_02[20]).toBe(314);
    expect(CH_REBAR_AREA[14]).toBe(153.9);
    expect(CH_REBAR_AREA[20]).toBe(314.2);
    expect(CH_REBAR_AREA[40]).toBe(1256.6);
    expect(CT_REBAR_AREA[14]).toBe(153.9);
    expect(CT_REBAR_AREA[25]).toBe(490.9);
  });

  it('verifies 100% byte and SHA-256 parity of all 8 extracted fonts and DEM payloads in public/', () => {
    const publicDir = resolve(appRoot, 'public');
    for (const rel of [...STATIC_FONT_FILES, ...STATIC_DEM_FILES]) {
      const targetPath = resolve(publicDir, rel);
      const refPath = resolve(analysisExtractedApp, rel);
      expect(existsSync(targetPath), `Missing public/${rel}`).toBe(true);
      expect(existsSync(refPath), `Missing extracted/app/${rel}`).toBe(true);
      expect(statSync(targetPath).size).toBe(statSync(refPath).size);
      expect(sha256File(targetPath)).toBe(sha256File(refPath));
    }

    const expectedVendorFiles = [
      VENDOR_ASSET_PATHS.mathjaxTexSvg,
      VENDOR_ASSET_PATHS.tesseractWorker,
      `${VENDOR_ASSET_PATHS.tesseractCoreDir}/tesseract-core-lstm.wasm`,
      `${VENDOR_ASSET_PATHS.tesseractCoreDir}/tesseract-core-lstm.wasm.js`,
      `${VENDOR_ASSET_PATHS.tesseractCoreDir}/tesseract-core-simd-lstm.wasm`,
      `${VENDOR_ASSET_PATHS.tesseractCoreDir}/tesseract-core-simd-lstm.wasm.js`,
      `${VENDOR_ASSET_PATHS.tesseractLangDir}/eng.traineddata.gz`,
    ];
    for (const rel of expectedVendorFiles) {
      const abs = resolve(publicDir, rel);
      expect(existsSync(abs), `Missing vendor asset public/${rel}`).toBe(true);
      expect(statSync(abs).size).toBeGreaterThan(100_000);
    }
  });
});
