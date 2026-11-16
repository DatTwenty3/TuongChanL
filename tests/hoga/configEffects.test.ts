// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { defaultProject } from '../../src/hoga/engine/defaults';
import { computeAll } from '../../src/hoga/engine/summary';
import { summarize } from '../../src/hoga/engine/summary';
import { buildViewSheet, buildLidSheet } from '../../src/hoga/cad/sheets';
import { buildVhgSet } from '../../src/hoga/cad/vhgSheets';
import { CONFIG_GROUPS, getPath, setPath, type Field } from '../../src/hoga/components/configSchema';
import { GA_KINDS, GA_KIND_ORDER, type GaKind, type HoGaProject } from '../../src/hoga/engine/types';

/** Chữ ký toàn bộ kết quả phụ thuộc cấu hình: khối lượng, thép, bản vẽ, bảng tổng hợp. */
function signature(p: HoGaProject): string {
  const info = GA_KINDS[p.kind];
  const res = computeAll(p);
  const parts: unknown[] = [summarize(p, res)];
  for (const i of [2, 3, 10]) {
    const r = res[i];
    parts.push(r.qty, r.rebar.groups, r.rebar.angles);
    for (const k of ['struct', 'rebar'] as const) parts.push(buildViewSheet(r, p.config, p.catalog, info, k, { scale: 20 }).ents);
    const lid = buildLidSheet(r, p.config, p.catalog, info);
    parts.push(lid ? lid.ents : null);
    parts.push(buildVhgSet(r, p.config, p.catalog, info, { scale: 20 }).map((x) => x.ents));
  }
  return JSON.stringify(parts);
}

const OVERRIDES: Record<string, unknown> = { 'inlet.side': 'Giữa T2', 'lid.dir': undefined };
function alt(path: string, v: unknown, f: Field): unknown {
  if (path in OVERRIDES && OVERRIDES[path] !== undefined) return OVERRIDES[path];
  if (f.type === 'bool') return !v;
  if (f.type === 'select') return f.options!.find((o) => o !== v);
  if (f.type === 'num') return (Number(v) || 0) + 25;
  const s = String(v);
  if (/^D\d+A\d+L\d+$/.test(s)) return 'D8A100L150';
  if (/^D\d+A\d+$/.test(s)) return 'D8A200';
  if (/^\d+D\d+$/.test(s)) return '4D14';
  if (/^\d+x\d+x\d+$/.test(s)) return '120x160x90';
  if (/^\d+x\d+$/.test(s)) return '90x60';
  if (/^V\d+x/.test(s)) return 'V40x40x4';
  if (/^\d+$/.test(s)) return '12';
  return s + 'X';
}

/** Một số ô chỉ có tác dụng khi ô khác bật: thử trong các ngữ cảnh này. */
const CONTEXTS: Record<string, unknown>[] = [
  {},
  { 'liner.l2T': 60 },
  { 'fmt.hook': 'Theo ĐK' },
  { 'levels.mode': 'Tương đối' },
  { 'lid.type': 'BTCT' },
  { 'lid.type': 'Gang', 'lid.recess': true },
];

describe('Mọi ô cấu hình đều có tác dụng lên kết quả', () => {
  for (const g of CONFIG_GROUPS) {
    for (const f of g.fields) {
      it(`${g.id} · ${f.path}`, () => {
        let ok = false;
        for (const kind of GA_KIND_ORDER as GaKind[]) {
          if (g.show && !g.show(GA_KINDS[kind])) continue;
          for (const ctx of CONTEXTS) {
            let base = defaultProject(kind);
            for (const [k, v] of Object.entries(ctx)) base = { ...base, config: setPath(base.config, k, v) };
            const mod = { ...base, config: setPath(base.config, f.path, alt(f.path, getPath(base.config, f.path), f)) };
            if (signature(mod) !== signature(base)) {
              ok = true;
              break;
            }
          }
          if (ok) break;
        }
        expect(ok, `ô "${f.path}" không làm thay đổi bất kỳ kết quả nào`).toBe(true);
      });
    }
  }
});
