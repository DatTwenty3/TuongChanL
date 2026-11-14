/**
 * BangTinhCauCong Web App — Top-Level Engine Orchestrator & Headless Pipeline.
 *
 * Clean-room TypeScript port of:
 *  - `moSumStep`, `run`, `tab3Step` (`11_culverts_box_and_circular.js:3855-4015`)
 *  - `IT_TAB`, `itList`, `igOn`, `kcpdG`, `tqItRender`, `tqItBind`, `KEEP` migration, `saveAll`, `showTab`
 *    (`12_piles_geotech_mcoc_and_pm3d.js:1558-1905, 3946-4068`)
 *  - `objVis`, `TPLD`, `tplKind`, `tplFill`, `tplApply` (`16_dem_watershed_ocr_dxf_import.js:4140-4253`)
 *  - `APPMODE`, `PROJDEF`, `projGet`, `projSet`, `setMode`, `tqStep`, `tqFit`
 *    (`18_appmode_export_xlsx_pdf.js:1-232`)
 *
 * All DOM / `localStorage` accesses are guarded so every solver & pipeline helper
 * executes safely in headless Node, `jsdom`, and browser runtimes.
 */

import {
  APP_MODES,
  BODY_MODE_CLASS,
  DEPRECATED_KEEP_KEYS_LT_9,
  IT_TAB,
  OBJ_TABS,
  PROJDEF,
  STORAGE_KEYS,
  TAB_IDS,
  type AppMode,
  type ItemGroup,
  type ItemKey,
  type ObjScope,
  type ProjectMetadata,
  type TabId,
} from '../types/project.ts';
import {
  $,
  contextState,
  getIDP,
  withCtx,
  num,
  sct2Run,
  sctNm,
  sctSep,
  sctSplit,
  sctTitles,
  v,
} from './context.ts';
import { tab3Step } from './math/rc.ts';
import { mcocStep, type McocStepDeps } from './foundations/pileGroup.ts';
import { geoInit, sctCheck, sctStep } from './foundations/drilledShaft.ts';
import {
  sfVis,
  sfdOn,
  sfmOn,
  sfmStep,
  type SfRenderResult,
} from './foundations/shallowFdn.ts';
import { chStep, chnStep } from './culvertsWalls/boxCulvert.ts';
import { ctStep } from './culvertsWalls/pipeCulvert.ts';
import { tcStep } from './culvertsWalls/wallGravity.ts';
import { tlStep } from './culvertsWalls/wallCantilever.ts';
import { initWallsWiring } from './wallsWiring.ts';
import { bindGirderHollowEvents } from './bridge/girderHollow.ts';
import {
  itOffSet,
  itOn,
  objLinkOff,
  objMode,
  objOn,
  objUnlock,
} from './bridge/crossfall.ts';
import { damStep } from './bridge/girderHollow.ts';
import { biaInit } from './bridge/girderI.ts';
import { ikOn, ltnOn, sup2Step, supK } from './bridge/deckJoints.ts';
import {
  capStep,
  getLatestCapResult,
  getLatestMorResult,
  getLatestRcmResult,
  mdOn,
  moInputs,
  moStep,
  rcStep,
} from './bridge/abutmentHeavy.ts';
import { getLatestMdFlexResult, mdFlex, mdFlexTxt } from './bridge/abutmentFlex.ts';
import {
  getLatestTrCheck,
  getLatestTrResult,
  trDiagView,
  trFigLoad,
  trOn,
  trRender21,
  trSchedule,
  trStep,
  trVis,
} from './bridge/pierFlex.ts';
import { dcOn, dcStep, dcVis } from './bridge/pierSolid.ts';
import { qdStep } from './bridge/approachSlab.ts';
import { hvStep } from './hydrology/bridgeHydro.ts';
import { tvcStep } from './hydrology/culvertHydro.ts';

export {
  APP_MODES,
  BODY_MODE_CLASS,
  IT_TAB,
  OBJ_TABS,
  PROJDEF,
  STORAGE_KEYS,
  TAB_IDS,
  itOffSet,
  itOn,
  objLinkOff,
  objMode,
  objOn,
  objUnlock,
  tab3Step,
};

// ---------------------------------------------------------------------------
// 1. Mutable Runtime State & Accessors
// ---------------------------------------------------------------------------

export let APPMODE: AppMode = 'cau';
export let ACTIVE_TAB: TabId = 7;

let latestSfmResult: SfRenderResult | null = null;

export function getAppMode(): AppMode {
  return APPMODE;
}

export function setAppModeState(mode: AppMode): void {
  APPMODE = mode;
}

export function getActiveTab(): TabId {
  return ACTIVE_TAB;
}

export function getLatestSfmResult(): SfRenderResult | null {
  return latestSfmResult;
}

export function setLatestSfmResult(res: SfRenderResult | null): void {
  latestSfmResult = res;
}

export function getAllTabIds(): readonly TabId[] {
  return TAB_IDS;
}

export interface AbutmentPierTemplateEntry {
  name: string;
  v: Record<string, string>;
}

export const TPLD: Record<'mo' | 'dac' | 'deo', AbutmentPierTemplateEntry[]> = {
  mo: [],
  dac: [],
  deo: [],
};

// ---------------------------------------------------------------------------
// 2. Checklist, Item Visibility & Table of Contents (`12_`, `18_`)
// ---------------------------------------------------------------------------

export type ChecklistEntry = [
  key: ItemKey | string,
  group: ItemGroup | string,
  shortName: string,
  tabs: TabId[],
  tocTitle: string,
];

export interface KcpdGroupEntry {
  g: 'mo' | 'tru' | 'qd';
  t: string;
  na?: boolean;
  subs: string[];
}

export function itList(): ChecklistEntry[] {
  const k = supK();
  const md = mdOn();
  const L: ChecklistEntry[] = [
    ['8', 'sup', 'Dầm giữa', [8], 'Kiểm toán dầm giữa'],
    ['9', 'sup', 'Dầm biên', [9], 'Kiểm toán dầm biên'],
    ['10', 'sup', 'Bản mặt cầu', [10], 'Kiểm toán bản mặt cầu'],
    [
      '11',
      'sup',
      k ? 'Kê dầm trên mố, trụ' : 'Gối cầu',
      [11],
      k ? 'Kiểm toán kê dầm trên mố, trụ' : 'Kiểm toán gối cầu',
    ],
  ];
  if (ltnOn()) {
    L.push(['12', 'sup', 'Bản liên tục nhiệt', [12], 'Kiểm toán bản liên tục nhiệt']);
  }
  L.push(
    ['13', 'sup', 'Khe co giãn', [13], 'Tính toán khe co giãn'],
    ['14', 'sup', 'Gờ lan can', [14], 'Kiểm toán gờ lan can'],
    ['mtt', 'mo', 'Tải trọng, tổ hợp tải trọng', [4], 'Tải trọng và tổ hợp tải trọng'],
    ['mmc', 'mo', 'Mặt cắt mố', [5], 'Kiểm toán các mặt cắt của mố'],
  );

  if (sfmOn()) {
    L.push(
      ['mnl', 'mo', 'Nền móng nông', [52], 'Kiểm toán nền móng nông'],
      ['mbe', 'mo', 'Bệ móng', [6], 'Kiểm toán bệ móng'],
    );
  } else {
    L.push(
      ['mnl', 'mo', 'Nội lực đầu cọc', [1], 'Nội lực đầu cọc'],
      [
        'mbe',
        'mo',
        md ? 'Bệ mố' : 'Bệ cọc',
        [6],
        md ? 'Kiểm toán bệ mố' : 'Kiểm toán bệ cọc',
      ],
      ['msc', 'mo', 'Sức chịu tải cọc theo đất nền', [2, 56], 'Sức chịu tải của cọc theo đất nền'],
      ['mvl', 'mo', 'Cọc theo vật liệu', [3], 'Kiểm toán cọc theo vật liệu'],
    );
  }

  if (trOn()) {
    L.push(
      ['ttt', 'tru', 'Tải trọng, tổ hợp tải trọng', [20], 'Tải trọng và tổ hợp tải trọng'],
      ['tnl', 'tru', 'Nội lực trụ (mô hình khung)', [21], 'Nội lực trụ (mô hình khung)'],
      ['txm', 'tru', 'Xà mũ, giằng', [22], 'Kiểm toán xà mũ, giằng'],
      ['tth', 'tru', 'Thân trụ theo vật liệu', [26], 'Kiểm toán thân trụ theo vật liệu'],
      ['tnc', 'tru', 'Nội lực cọc', [23], 'Nội lực cọc'],
      ['tsc', 'tru', 'Sức chịu tải cọc theo đất nền', [24, 57], 'Sức chịu tải của cọc theo đất nền'],
      ['tvl', 'tru', 'Cọc theo vật liệu', [25], 'Kiểm toán cọc theo vật liệu'],
    );
  } else if (dcOn()) {
    L.push(
      ['ttt', 'tru', 'Tải trọng, tổ hợp tải trọng', [20], 'Tải trọng và tổ hợp tải trọng'],
      ['txm', 'tru', 'Xà mũ', [46], 'Kiểm toán xà mũ'],
      ['tth', 'tru', 'Thân trụ theo vật liệu', [47], 'Kiểm toán thân trụ theo vật liệu'],
    );
    if (sfdOn()) {
      L.push(
        ['tnc', 'tru', 'Nền móng nông', [53], 'Kiểm toán nền móng nông'],
        ['tbe', 'tru', 'Bệ trụ', [48], 'Kiểm toán bệ trụ'],
      );
    } else {
      L.push(
        ['tnc', 'tru', 'Nội lực đầu cọc', [49], 'Nội lực đầu cọc'],
        ['tbe', 'tru', 'Bệ trụ', [48], 'Kiểm toán bệ trụ'],
        ['tsc', 'tru', 'Sức chịu tải cọc theo đất nền', [50, 58], 'Sức chịu tải của cọc theo đất nền'],
        ['tvl', 'tru', 'Cọc theo vật liệu', [51], 'Kiểm toán cọc theo vật liệu'],
      );
    }
  }

  L.push(['qd', 'qd', 'Bản quá độ', [43], 'Kiểm toán bản quá độ']);
  return L;
}

export function igOn(g: ItemGroup | string): boolean {
  return itList().some((x) => x[1] === g && ikOn(x[0]));
}

export function kcpdG(om?: ObjScope): KcpdGroupEntry[] {
  const scope = om || objMode();
  const L = itList();
  const G: KcpdGroupEntry[] = [];
  const sub = (g: ItemGroup, kind: 'm' | 't') =>
    sctSplit(
      L.filter((x) => x[1] === g && ikOn(x[0])).map((x) => x[4]),
      kind,
    );

  const mo = v('tq_mo', '').trim();
  const tnm = v('td_name', '').trim();
  const nt = Math.max(0, Math.round(num('tq_nt') || 0));

  if (scope !== 'tru' && igOn('mo')) {
    G.push({ g: 'mo', t: 'Kiểm toán mố' + (mo ? ' ' + mo : ''), subs: sub('mo', 'm') });
  }
  if (scope !== 'mo') {
    if (trOn()) {
      if (igOn('tru')) {
        G.push({
          g: 'tru',
          t: 'Kiểm toán trụ dẻo' + (tnm ? ' ' + tnm : ''),
          subs: sub('tru', 't'),
        });
      }
    } else if (dcOn()) {
      if (igOn('tru')) {
        G.push({
          g: 'tru',
          t: 'Kiểm toán trụ đặc' + (tnm ? ' ' + tnm : ''),
          subs: sub('tru', 't'),
        });
      }
    } else if (v('tq_kn', '') === 'n') {
      const pierKind = v('tq_tru', '') === 'dac' ? 'đặc' : 'dẻo';
      const names =
        nt > 0 ? ' ' + Array.from({ length: nt }, (_, i) => 'T' + (i + 1)).join(', ') : '';
      G.push({
        g: 'tru',
        t: 'Kiểm toán trụ ' + pierKind + names,
        na: true,
        subs: [],
      });
    }
  }
  if (scope !== 'tru' && ikOn('qd')) {
    G.push({ g: 'qd', t: 'Kiểm toán bản quá độ', subs: [] });
  }
  return G;
}

const escAttr = (x: string): string =>
  String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export function tqItRender(): void {
  if (typeof document === 'undefined') return;
  const box = document.getElementById('tqIt');
  if (!box) return;

  const om = objMode();
  const L = itList();
  const off = itOffSet();
  const show: Record<string, boolean> = {
    sup: om === 'all' || om === 'dam',
    mo: om === 'all' || om === 'mo',
    tru: om === 'all' || om === 'tru',
    qd: om === 'all' || om === 'mo',
  };
  const mo = v('tq_mo', '').trim();
  const tn = v('td_name', '').trim();
  const GN: Record<string, string> = {
    sup: 'Kết cấu phần trên',
    mo: 'Mố' + (mo ? ' ' + mo : ''),
    tru: (trOn() ? 'Trụ dẻo' : 'Trụ đặc') + (tn ? ' ' + tn : ''),
    qd: 'Bản quá độ',
  };

  const sig = JSON.stringify([show, L.map((x) => x[0] + ':' + x[2]), GN]);
  if (box.dataset.sig !== sig) {
    box.dataset.sig = sig;
    let h = '';
    for (const g of ['sup', 'mo', 'tru', 'qd'] as const) {
      const it = L.filter((x) => x[1] === g);
      if (!show[g] || !it.length) continue;
      if (g === 'qd') {
        h += `<div class="tqg"><label class="gh"><input type="checkbox" data-k="qd"> ${GN.qd}</label></div>`;
        continue;
      }
      h +=
        `<div class="tqg"><label class="gh"><input type="checkbox" data-g="${g}"> ${escAttr(GN[g])}</label>` +
        it
          .map((x) => `<label><input type="checkbox" data-k="${x[0]}"> ${escAttr(x[2])}</label>`)
          .join('') +
        `</div>`;
    }
    h += `<div class="tqg tqb"><button type="button" class="btn2" data-all="1">Chọn tất cả</button><button type="button" class="btn2" data-all="0">Bỏ chọn tất cả</button></div>`;
    box.innerHTML = h;
  }

  box.querySelectorAll<HTMLInputElement>('input[data-k]').forEach((c) => {
    const k = c.dataset.k || '';
    c.checked = !off.has(k);
  });
  box.querySelectorAll<HTMLInputElement>('input[data-g]').forEach((c) => {
    const g = c.dataset.g || '';
    const ks = L.filter((x) => x[1] === g).map((x) => x[0]);
    const n = ks.filter((k) => !off.has(String(k))).length;
    c.checked = n === ks.length;
    c.indeterminate = n > 0 && n < ks.length;
  });

  const o = document.getElementById('o_tq_off');
  if (o) {
    const lc = (x: string) => x.charAt(0).toLowerCase() + x.slice(1);
    const no: string[] = [];
    for (const g of ['sup', 'mo', 'tru', 'qd'] as const) {
      const it = L.filter((x) => x[1] === g);
      if (!show[g] || !it.length) continue;
      const nf = it.filter((x) => off.has(String(x[0])));
      if (!nf.length) continue;
      if (g !== 'qd' && nf.length === it.length) {
        no.push(g === 'sup' ? 'kết cấu phần trên' : lc(GN[g]));
        continue;
      }
      nf.forEach((x) =>
        no.push((g === 'mo' ? 'mố - ' : g === 'tru' ? 'trụ - ' : '') + lc(x[2])),
      );
    }

    const DEP: Record<string, string[]> = {
      '10': ['8'],
      '11': ['8'],
      '12': ['8', '11'],
      '13': ['8'],
      '14': ['8'],
      mmc: ['mtt'],
      mnl: ['mtt'],
      mbe: ['mtt', 'mnl'],
      msc: ['mtt', 'mnl'],
      mvl: ['mtt', 'mnl'],
      tnl: ['ttt'],
      txm: ['ttt', 'tnl'],
      tth: ['ttt', 'tnl'],
      tnc: ['ttt', 'tnl'],
      tbe: ['ttt'],
      tsc: ['ttt', 'tnc'],
      tvl: ['ttt', 'tnc'],
    };
    const fx_ = (k: string) => L.find((x) => x[0] === k);
    const src = new Set<string>();
    L.forEach((x) => {
      if (!show[x[1]] || off.has(String(x[0]))) return;
      const d = (DEP[String(x[0])] || []).slice();
      if (om === 'all' && (x[1] === 'mo' || x[1] === 'tru')) d.push('8', '9', '11');
      if (om === 'all' && x[1] === 'tru') d.push('mtt');
      d.forEach((k) => {
        if (fx_(k) && off.has(k)) src.add(k);
      });
    });
    const nmk = (k: string): string => {
      const x = fx_(k);
      if (!x) return k;
      return (x[1] === 'mo' ? 'mố - ' : x[1] === 'tru' ? 'trụ - ' : '') + lc(x[2]);
    };
    o.textContent = no.length
      ? 'Không tính: ' +
        no.join('; ') +
        '.' +
        (src.size
          ? ' Các sheet sau không in, không đưa vào kết luận nhưng vẫn tính, giữ số liệu nhập vì là nguồn số liệu của sheet được tính: ' +
            [...src].map(nmk).join('; ') +
            ' (chọn lại hạng mục để xem, sửa số liệu).'
          : '')
      : '';
  }
}

export function tqItBind(): void {
  if (typeof document === 'undefined') return;
  const box = document.getElementById('tqIt');
  if (!box || box.dataset.bound) return;
  box.dataset.bound = '1';

  const setOff = (S: Set<string>) => {
    const e = document.getElementById('tq_off') as HTMLInputElement | null;
    const val = [...S].sort().join(',');
    if (!e || e.value === val) return;
    e.value = val;
    try {
      objVis();
    } catch {
      /* noop */
    }
    try {
      tqStep();
    } catch (err) {
      console.error(err);
    }
    e.dispatchEvent(new Event('change', { bubbles: true }));
    setTimeout(() => {
      try {
        qdStep();
      } catch {
        /* noop */
      }
    }, 200);
  };

  box.addEventListener('change', (ev) => {
    const c = ev.target as HTMLInputElement | null;
    if (!c || c.type !== 'checkbox') return;
    const S = itOffSet();
    if (c.dataset.k) {
      if (c.checked) S.delete(c.dataset.k);
      else S.add(c.dataset.k);
    } else if (c.dataset.g) {
      itList()
        .filter((x) => x[1] === c.dataset.g)
        .forEach((x) => {
          const k = String(x[0]);
          if (c.checked) S.delete(k);
          else S.add(k);
        });
    }
    setOff(S);
  });

  box.addEventListener('click', (ev) => {
    const target = ev.target as HTMLElement | null;
    const b = target && target.closest ? target.closest('button[data-all]') : null;
    if (!b) return;
    const S = itOffSet();
    const on = b.getAttribute('data-all') === '1';
    box.querySelectorAll<HTMLInputElement>('input[data-k]').forEach((c) => {
      const k = c.dataset.k;
      if (!k) return;
      if (on) S.delete(k);
      else S.add(k);
    });
    setOff(S);
  });
}

export function tqFit(t: HTMLTextAreaElement | null | undefined): void {
  if (!t || !t.offsetParent) return;
  t.style.height = 'auto';
  t.style.height = t.scrollHeight + 4 + 'px';
}

export function tqStep(): void {
  if (typeof document === 'undefined') return;
  const el = $('tqToc');
  if (!el) return;

  const R = ['I', 'II', 'III', 'IV', 'V'];
  let k = 0;
  let h = '';
  const na = '<span class="noprint" style="color:#a33a2a"> (chưa có trong phần mềm)</span>';
  const sec = (t: string, items: Array<{ t: string; sub?: boolean; na?: boolean }>) => {
    h += `<h2>${R[k++] || ''}.&nbsp;&nbsp;${t}</h2>`;
    items.forEach((it) => {
      h += `<div class="row${it.sub ? ' sub' : ''}" style="--ind:${it.sub ? '28px' : '0'}"><span></span><span>${it.t}${it.na ? na : ''}</span></div>`;
    });
  };

  sec(
    'TỔNG QUAN',
    ['1. Tổng quan', '2. Tiêu chuẩn thiết kế', '3. Cơ sở tính toán', '4. Kích thước kết cấu'].map(
      (t) => ({ t }),
    ),
  );

  const sup = itList()
    .filter((x) => x[1] === 'sup' && ikOn(x[0]))
    .map((x) => ({ t: x[4], na: false }));
  const ext = v('tq_sup', '')
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter((x) => x)
    .map((t) => ({ t, na: true }));

  if ((objMode() === 'all' || objMode() === 'dam') && sup.length + ext.length) {
    sec(
      'KẾT CẤU PHẦN TRÊN',
      [...sup, ...ext].map((o, i) => ({ t: i + 1 + '. ' + o.t, na: o.na })),
    );
  }

  const om = objMode();
  const rawObj = v('tq_obj', 'all');
  const it: Array<{ t: string; sub?: boolean; na?: boolean }> = [];
  kcpdG(om).forEach((g, i) => {
    it.push({ t: i + 1 + '. ' + g.t, na: g.na });
    g.subs.forEach((x, j) => it.push({ t: i + 1 + '.' + (j + 1) + '. ' + x, sub: true }));
  });
  if (om !== 'dam' && rawObj !== 'tv' && it.length) {
    sec('KẾT CẤU PHẦN DƯỚI', it);
  }

  el.innerHTML = h;
  try {
    sctTitles();
  } catch {
    /* noop */
  }
  try {
    tqItBind();
    tqItRender();
  } catch (err) {
    console.error(err);
  }
}

// ---------------------------------------------------------------------------
// 3. Scope Visibility & Abutment / Pier Templates (`16_`)
// ---------------------------------------------------------------------------

export function objVis(): void {
  if (typeof document === 'undefined') return;
  const m = objMode();
  (['dam', 'mo', 'tru', 'tv'] as const).forEach((k) =>
    document.body?.classList.toggle('ob-' + k, m === k),
  );
  document
    .querySelectorAll<HTMLElement>('.tabs .tab[data-t]')
    .forEach((b) => b.classList.toggle('xoff', !itOn(b.dataset.t || '0')));

  try {
    tqStep();
  } catch (err) {
    console.error(err);
  }

  if (m === 'tru') {
    const k = $('tq_kn') as HTMLSelectElement | null;
    if (k && k.value !== 'n') {
      k.value = 'n';
      k.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
  if (objLinkOff()) objUnlock();

  const o = $('o_tq_obj');
  if (o) {
    const rawVal = v('tq_obj', 'all');
    o.textContent =
      m === 'mo'
        ? 'Tính riêng mố: số liệu kết cấu nhịp (kích thước, thể tích dầm, lớp phủ, lan can), gối và dốc ngang nhập trực tiếp ở sheet tải trọng mố, không lấy từ sheet dầm.'
        : m === 'tru'
          ? 'Tính riêng trụ: phản lực tĩnh tải nhịp DC, DW, số liệu kết cấu nhịp, gối, gió, động đất, nhiệt độ nhập trực tiếp ở sheet tải trọng trụ, không lấy từ sheet dầm và sheet mố. Chọn loại trụ ở ô loại trụ.'
          : rawVal === 'tv'
            ? 'Tính riêng thủy văn, thủy lực cầu: lưu lượng, mực nước, khẩu độ, nước dềnh, khổ giới hạn thẳng đứng, xói.'
            : m === 'dam'
              ? 'Tính riêng kết cấu nhịp: chỉ hiện các sheet dầm giữa, dầm biên, bản mặt cầu, gối, bản liên tục nhiệt, khe co giãn, gờ lan can.'
              : '';
  }

  const cur = [...document.querySelectorAll<HTMLElement>('.tabs .tab')].find(
    (b) => b.getAttribute('aria-pressed') === 'true',
  );
  if (cur && APPMODE === 'cau' && !objOn(cur.dataset.t || '7')) {
    showTab(7);
  }
}

export function tplKind(w: 'mo' | 'tr' | string): 'mo' | 'dac' | 'deo' | null {
  if (w === 'mo') return v('tq_mot', '') === 'deo' ? null : 'mo';
  return v('tq_tru', '') === 'dac' ? 'dac' : 'deo';
}

export function tplFill(w: 'mo' | 'tr' | string): void {
  if (typeof document === 'undefined') return;
  const s = $('tpl_' + w) as HTMLSelectElement | null;
  if (!s) return;
  const k = tplKind(w);
  const L = k ? TPLD[k] : [];
  const cur = s.dataset.k === (k || '') ? s.value : '';
  s.innerHTML =
    '<option value="">Tự nhập (không nạp mẫu)</option>' +
    L.map((t, i) => `<option value="${i}">${escAttr(t.name)}</option>`).join('');
  s.dataset.k = k || '';
  if (cur && L[Number(cur)]) s.value = cur;
  const o = $('o_tpl_' + w);
  if (o) {
    o.textContent = k
      ? 'Chọn mẫu để nạp kích thước, cao độ của mố/trụ ở công trình tương ứng (không nạp tải trọng, vật liệu, địa chất). Sửa lại các ô cho đúng công trình đang thiết kế.'
      : 'Chưa có mẫu mố dẻo từ bảng tính công trình thực tế.';
  }
}

export function tplApply(w: 'mo' | 'tr' | string, i: number | string): void {
  const k = tplKind(w);
  const t = k ? TPLD[k][Number(i)] : undefined;
  if (!t) return;
  for (const [id, val] of Object.entries(t.v)) {
    const e = $(id);
    if (!e) continue;
    if (e.tagName === 'SELECT') {
      const sel = e as unknown as HTMLSelectElement;
      if ([...sel.options].some((o) => o.value === val)) sel.value = val;
    } else {
      e.value = val;
    }
  }
  try {
    sfVis();
  } catch {
    /* noop */
  }
  if (w === 'tr') trSchedule();
  run();
}

// ---------------------------------------------------------------------------
// 4. Project Metadata, Tabs, App Modes & Storage (`18_`, `12_`)
// ---------------------------------------------------------------------------

export function projGet(): ProjectMetadata {
  const o: Record<string, string> = {};
  if (typeof document !== 'undefined') {
    document.querySelectorAll<HTMLInputElement>('.proj input.pj').forEach((e) => {
      o[e.id] = e.value;
    });
  }
  return {
    pj1: o.pj1 ?? '',
    pj2: o.pj2 ?? '',
    pj3: o.pj3 ?? '',
    pj4: o.pj4 ?? '',
    pj5: o.pj5 ?? '',
    pj6: o.pj6 ?? '',
  };
}

export function projSet(
  o: Partial<ProjectMetadata> | Record<string, string> | null | undefined,
): void {
  if (typeof document === 'undefined' || !o) return;
  document.querySelectorAll<HTMLInputElement>('.proj input.pj').forEach((e) => {
    const val = (o as Record<string, unknown>)[e.id];
    if (val != null) e.value = String(val);
  });
}

export function getKeepElements(): Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> {
  if (typeof document === 'undefined') return [];
  return [...document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[id]')].filter(
    (e) =>
      (e.tagName === 'INPUT' || e.tagName === 'SELECT' || e.tagName === 'TEXTAREA') &&
      (!('readOnly' in e) || !e.readOnly) &&
      !e.classList.contains('pj'),
  );
}

export function saveAll(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const o: Record<string, unknown> = {};
    getKeepElements().forEach((e) => {
      o[e.id] = e.value;
    });
    o._v = 9;
    localStorage.setItem(STORAGE_KEYS.snapshot, JSON.stringify(o));
  } catch {
    /* noop */
  }
}

export function loadSavedSnapshot(rawJson?: string): Record<string, unknown> | null {
  try {
    const src =
      rawJson ??
      (typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.snapshot) : null);
    const sv = JSON.parse(src || 'null') as Record<string, unknown> | null;
    if (!sv || typeof sv !== 'object') return null;

    if (sv.s2_WL == null) delete sv.s2_geo;
    if (!sv.s2_spt) delete sv.s2_spt;
    const ver = Number(sv._v || 0);
    if (ver < 2) ['mo_jtm', 's2_geoT', 's2_bh', 's2_top'].forEach((k) => delete sv[k]);
    if (ver < 3) ['mo_jtm', 'mo_dky', 'mo_g', 'mo_ix', 'mo_hrt'].forEach((k) => delete sv[k]);
    if (ver < 4) ['tq_sup'].forEach((k) => delete sv[k]);
    if (ver < 5) ['mo_Tmax'].forEach((k) => delete sv[k]);
    if (ver < 6) ['gc_n', 'gc_hri', 'gc_hc', 'gc_hs'].forEach((k) => delete sv[k]);
    if (ver < 7) ['gc_n', 'gc_hri', 'gc_hc', 'gc_hs'].forEach((k) => delete sv[k]);
    if (ver < 8) {
      [
        'bm_dB',
        'bm_sB',
        'bm_dT',
        'bm_sT',
        'bm_dLB',
        'bm_sLB',
        'bm_dLT',
        'bm_sLT',
        'bm_ct',
        'bm_cb',
      ].forEach((k) => delete sv[k]);
    }
    if (ver < 9) {
      DEPRECATED_KEEP_KEYS_LT_9.forEach((k) => delete sv[k]);
      delete sv.bm_sLB;
    }

    getKeepElements().forEach((e) => {
      if (sv[e.id] != null) e.value = String(sv[e.id]);
    });
    return sv;
  } catch {
    return null;
  }
}

export function showTab(n: number | string): void {
  const tabNum = Number(n);
  if (Number.isFinite(tabNum) && TAB_IDS.includes(tabNum as TabId)) {
    ACTIVE_TAB = tabNum as TabId;
  }
  if (typeof document === 'undefined') return;

  const tab70 = document.getElementById('tab70');
  if (tab70) tab70.hidden = tabNum !== 70;

  document.querySelectorAll<HTMLElement>('.tabs .tab').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.t === String(n)));
  });

  [61, 62].forEach((i) => {
    const e = document.getElementById('tab' + i);
    if (e) e.hidden = i !== tabNum;
  });

  for (const i of TAB_IDS) {
    if (i === 61 || i === 62 || i === 70) continue;
    const e = document.getElementById('tab' + i);
    if (e) e.hidden = i !== tabNum;
  }

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.tabLegacy, String(n));
    }
  } catch {
    /* noop */
  }

  setTimeout(() => {
    const p = document.getElementById('tab' + n);
    if (p) p.querySelectorAll<HTMLTextAreaElement>('textarea.tqta').forEach(tqFit);
  }, 30);

  const P = ({ 3: '', 25: 'T_', 26: 'C_', 51: 'P_' } as Record<number, string>)[tabNum];
  const g = P != null ? document.getElementById(P + 'p3d') : null;
  const plotly = (globalThis as unknown as { Plotly?: { Plots?: { resize?: (el: HTMLElement) => void } } }).Plotly;
  if (g && plotly?.Plots?.resize && (g as unknown as { data?: unknown }).data) {
    setTimeout(() => plotly.Plots!.resize!(g), 30);
  }
}

type ExtendedAppMode = AppMode | 'bia' | 'biat';

function normalizeMode(m: AppMode | string): ExtendedAppMode {
  if (
    m === 'tl' ||
    m === 'ch' ||
    m === 'ct' ||
    m === 'tc' ||
    m === 'tv' ||
    m === 'tvc' ||
    m === 'bia' ||
    m === 'biat'
  ) {
    return m;
  }
  return 'cau';
}

export function setMode(modeInput: AppMode | string, init = false): AppMode {
  const m: ExtendedAppMode = normalizeMode(modeInput);
  const resolvedMode: AppMode = m === 'bia' || m === 'biat' ? 'cau' : m;

  try {
    trVis();
  } catch {
    /* noop */
  }

  if (!init && resolvedMode === APPMODE && m === resolvedMode) return APPMODE;

  if (!init && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEYS.projByModePrefix + APPMODE, JSON.stringify(projGet()));
    } catch {
      /* noop */
    }
    let o: Partial<ProjectMetadata> | null = null;
    try {
      o = JSON.parse(localStorage.getItem(STORAGE_KEYS.projByModePrefix + m) || 'null');
    } catch {
      o = null;
    }
    const defMeta = (PROJDEF as Record<string, Partial<ProjectMetadata> | undefined>)[m];
    if (!o && defMeta) {
      o = { ...projGet(), ...defMeta };
    }
    projSet(o);
    saveAll();
  }

  APPMODE = resolvedMode;
  if (typeof document === 'undefined') return APPMODE;

  const body = document.body;
  if (body) {
    body.classList.toggle('mch', m === 'ch');
    body.classList.toggle('mct', m === 'ct');
    body.classList.toggle('mbia', m === 'bia' || m === 'biat');
    body.classList.toggle('mtc', m === 'tc');
    body.classList.toggle('mtl', m === 'tl');
    body.classList.toggle('mtv', m === 'tv');
    body.classList.toggle('mtvc', m === 'tvc');
    body.classList.toggle('mbiat', m === 'biat');
  }

  const sel = $('appMode');
  if (sel) sel.value = m;

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.mode, m);
    }
  } catch {
    /* noop */
  }

  const xmsg = $('xmsg');
  if (xmsg) {
    xmsg.textContent =
      m === 'ct'
        ? 'Xuất file Excel hoặc PDF riêng cho cống tròn: số liệu, tải trọng và nội lực; cốt thép và kiểm toán. Không kèm các phần của cầu.'
        : m === 'ch'
          ? 'Xuất file Excel hoặc PDF riêng cho cống hộp: số liệu, tải trọng và nội lực; kiểm toán mặt cắt; kiểm toán nền móng; phụ lục hệ số nền. Không kèm các phần của cầu.'
          : 'Xuất file Excel hoặc PDF gồm các phần theo thứ tự bảng tính: tổng quan, kiểm toán dầm giữa, dầm biên, bản mặt cầu, gối cầu, bản liên tục nhiệt (nếu có), khe co giãn, gờ lan can, tải trọng và tổ hợp mố, kiểm toán mặt cắt mố, nội lực đầu cọc, kiểm toán bệ cọc, sức chịu tải cọc, kiểm toán cọc theo vật liệu.';
  }

  const lsNum = (key: string, def: number): number => {
    try {
      if (typeof localStorage === 'undefined') return def;
      return Number(localStorage.getItem(key) || def) || def;
    } catch {
      return def;
    }
  };

  if (m === 'tvc') {
    try {
      tvcStep();
    } catch (err) {
      console.error(err);
    }
    showTab(70);
    if (xmsg) xmsg.textContent = 'Xuất file Excel hoặc PDF riêng cho thủy văn, thủy lực cống.';
  } else if (m === 'tv') {
    try {
      hvStep();
    } catch {
      /* noop */
    }
    showTab(54);
    if (xmsg) xmsg.textContent = 'Xuất file Excel hoặc PDF riêng cho thủy văn, thủy lực cầu.';
  } else if (m === 'tl') {
    try {
      tlStep();
    } catch (err) {
      console.error(err);
    }
    const t = lsNum(STORAGE_KEYS.tabByModePrefix + 'tl', 61);
    showTab(t === 62 ? 62 : 61);
    if (xmsg) {
      xmsg.textContent =
        'Xuất file Excel hoặc PDF riêng cho tường chắn chữ L: số liệu, tải trọng; kiểm toán.';
    }
  } else if (m === 'tc') {
    try {
      tcStep();
    } catch (err) {
      console.error(err);
    }
    const t = lsNum(STORAGE_KEYS.tabByModePrefix + 'tc', 41);
    showTab(t === 42 ? 42 : 41);
    if (xmsg) {
      xmsg.textContent =
        'Xuất file Excel hoặc PDF riêng cho tường chắn: số liệu, tải trọng; kiểm toán.';
    }
  } else if (m === 'bia' || m === 'biat') {
    const TS = m === 'bia' ? [39, 35, 28, 27, 30, 31, 37] : [40, 36, 33, 29, 34, 32, 38];
    const t = lsNum(STORAGE_KEYS.tabByModePrefix + m, 0);
    showTab(TS.includes(t) ? t : TS[0]);
    if (xmsg) xmsg.textContent = '';
  } else if (m === 'ct') {
    try {
      ctStep();
    } catch (err) {
      console.error(err);
    }
    const t = lsNum(STORAGE_KEYS.tabByModePrefix + 'ct', 18);
    showTab(t >= 18 && t <= 19 ? t : 18);
  } else if (m === 'ch') {
    try {
      chStep();
    } catch (err) {
      console.error(err);
    }
    const t = lsNum(STORAGE_KEYS.tabByModePrefix + 'ch', 15);
    showTab(t >= 15 && t <= 17 ? t : 15);
  } else {
    let t = lsNum(STORAGE_KEYS.tabByModePrefix + 'cau', 0);
    if (!t) t = lsNum(STORAGE_KEYS.tabLegacy, 7);
    const b = document.querySelector<HTMLElement>('.tabs .tab[data-t="' + t + '"]');
    showTab(b && typeof getComputedStyle === 'function' && getComputedStyle(b).display !== 'none' ? t : 7);
  }

  return APPMODE;
}

// ---------------------------------------------------------------------------
// 5. Orchestrated Calculation Pipeline (`11_`)
// ---------------------------------------------------------------------------

export function moSumStep(): void {
  if (typeof document === 'undefined') return;
  const pane = document.getElementById('tab5');
  if (!pane) return;
  let tb = document.getElementById('tbMoSum') as HTMLTableElement | null;
  if (!tb) {
    const h = document.createElement('h2');
    h.id = 'h_moSum';
    h.innerHTML = 'TỔNG HỢP KẾT QUẢ KIỂM TOÁN MỐ';
    tb = document.createElement('table');
    tb.className = 't dt';
    tb.id = 'tbMoSum';
    pane.appendChild(h);
    pane.appendChild(tb);
  }

  const MOR = getLatestMorResult();
  if (!MOR || (MOR.err && MOR.err.length)) {
    tb.innerHTML = '';
    return;
  }

  const L: Record<string, string> = {
    cc: 'Tường đỉnh (mặt cắt C-C)',
    bx: 'Tường thân - phương dọc cầu (mặt cắt B-B)',
    by: 'Tường thân - phương ngang cầu (mặt cắt B-B)',
    ee: 'Tường cánh (mặt cắt E-E)',
    ff: 'Tường cánh (mặt cắt F-F)',
    gg: 'Tường cánh (mặt cắt G-G)',
    wy: 'Tường cánh mố dẻo - phương đứng',
    wx: 'Tường cánh mố dẻo - phương ngang',
  };

  const it: Array<[string, string, boolean]> = [];
  const RCM = getLatestRcmResult();
  Object.entries((RCM && RCM.res) || {}).forEach(([k, val]) => {
    if (val && L[k]) {
      it.push([
        L[k] + ': uốn, cắt, cốt thép tối thiểu, nứt, co ngót - nhiệt độ',
        'trang kiểm toán mặt cắt',
        Boolean(val.ok),
      ]);
    }
  });

  const nong = sfmOn();
  const CAPR = getLatestCapResult();
  const win =
    typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : undefined;
  if (CAPR && ikOn('mbe')) {
    // Chỉ các mặt cắt bệ (như bản gốc: `c1`, `c2` — bệ mố dẻo `bn`, `bp`); `stm` / `punching` là kết quả phụ, không phải hàng "gót bệ"
    for (const k of ['c1', 'c2', 'bn', 'bp'] as const) {
      const val = (CAPR as unknown as Record<string, unknown>)[k];
      if (val && typeof val === 'object' && 'ok' in val) {
        it.push([
          (k === 'c1' || k === 'bn' ? 'Bệ - mũi bệ (mặt cắt I-I)' : 'Bệ - gót bệ (mặt cắt II-II)') +
            ': uốn, cắt, cốt thép tối thiểu, nứt',
          'trang kiểm toán bệ',
          Boolean((val as { ok?: unknown }).ok),
        ]);
      }
    }
    if (!nong) {
      it.push(['Bệ - chọc thủng do cọc', 'trang kiểm toán bệ', win?.__punOK !== false]);
      it.push([
        'Bệ - mô hình chống - giằng (khi cọc trong phạm vi 2d)',
        'trang kiểm toán bệ',
        win?.__capStmOK !== false,
      ]);
    }
  }

  if (nong) {
    if (latestSfmResult && ikOn('mnl')) {
      it.push([
        'Móng nông: lệch tâm, sức kháng đỡ, trượt, lún',
        'trang kiểm toán móng nông',
        Boolean(latestSfmResult.ok),
      ]);
    }
  } else {
    const s = contextState.sctOK;
    const m = contextState.matOK;
    if (s.M != null && ikOn('msc')) {
      const two = sctSep() && s.Q_ != null;
      const n = sctNm('tq_mo', ['M1', 'M2']);
      it.push([
        'Cọc: sức kháng đất nền (nén, nhổ), nhóm cọc, chuyển vị, lún nhóm' +
          (two ? ' - mố ' + n[0] : ''),
        'trang kiểm toán cọc theo đất nền' + (two ? ' mố ' + n[0] : ''),
        Boolean(s.M),
      ]);
      if (two) {
        it.push([
          'Cọc: sức kháng đất nền (nén, nhổ), nhóm cọc, chuyển vị, lún nhóm - mố ' + n[1],
          'trang kiểm toán cọc theo đất nền mố ' + n[1],
          Boolean(s.Q_),
        ]);
      }
    }
    if (m.M != null && ikOn('mvl')) {
      it.push([
        'Cọc: vật liệu (tương tác P - M, cắt, cốt thép)',
        'trang kiểm toán cọc theo vật liệu',
        Boolean(m.M),
      ]);
    }
  }

  const all = it.every((x) => x[2]);
  tb.innerHTML =
    `<tr><th colspan="6">Hạng mục kiểm toán</th><th colspan="2">Chi tiết</th><th colspan="2">KL</th></tr>` +
    it
      .map(
        (x) =>
          `<tr><td class="l" colspan="6">${x[0]}</td><td class="c" colspan="2">${x[1]}</td><td class="c ${x[2] ? 'ok' : 'bad'}" colspan="2">${x[2] ? 'OK' : 'NG'}</td></tr>`,
      )
      .join('') +
    `<tr><td class="l" colspan="8"><b>KẾT LUẬN</b></td><td class="c ${all ? 'ok' : 'bad'}" colspan="2"><b>${all ? 'ĐẠT' : 'KHÔNG ĐẠT'}</b></td></tr>`;
}

/**
 * `mcocStep` cho sheet mố (không tiền tố): nối đúng như bản gốc — cột "Tổ hợp" lấy từ `MOR.link` khi nguồn tải là sheet mố,
 * và bệ mố dẻo hiệu chỉnh nội lực theo mô hình dầm đàn hồi (`mdFlex` / `mdFlexTxt`).
 */
function mcocStepAbutment(): void {
  mcocStep({
    MOR: getLatestMorResult() as McocStepDeps['MOR'],
    onMdFlex: ({ dd, piles, R1, R2, LC, LD }) => {
      try {
        mdFlex(dd, piles, R1, R2, LC, LD);
      } catch (err) {
        console.error(err);
        return null;
      }
      const F = getLatestMdFlexResult();
      return { ok: !!(F && F.ok), text: F && F.ok ? mdFlexTxt() : '' };
    },
  });
}

export function run(): void {
  try {
    objVis();
  } catch (err) {
    console.error(err);
  }
  damStep();
  try {
    sup2Step();
  } catch (err) {
    console.error(err);
  }

  const moA = igOn('mo');
  const trA = (trOn() || dcOn()) && igOn('tru');
  if (moA || trA) moStep();

  if (moA) {
    try {
      const mor = getLatestMorResult();
      latestSfmResult =
        mor && (!mor.err || !mor.err.length)
          ? sfmStep({ I: moInputs(), geo: mor.geo, combA: mor.comb.A }, mdOn)
          : null;
    } catch (err) {
      console.error(err);
    }
    rcStep();
    sctStep();
    mcocStepAbutment();
    capStep();
    sctCheck();
    try {
      sct2Run('', 'Q_', {
        sctStep: () => sctStep(),
        sctCheck: () => sctCheck(),
      });
    } catch (err) {
      console.error(err);
    }
  }

  try {
    sctTitles();
  } catch (err) {
    console.error(err);
  }

  if (moA) {
    tab3Step();
    try {
      moSumStep();
    } catch (err) {
      console.error(err);
    }
  }

  try {
    trVis();
  } catch {
    /* noop */
  }
  if (trOn() || dcOn()) {
    trSchedule();
  }
}

export interface RunAllResult {
  mode: AppMode | 'all';
  errors: Array<{ step: string; error: string }>;
}

export function runAll(targetMode?: AppMode | 'all'): RunAllResult {
  const mode = targetMode || APPMODE;
  const errors: Array<{ step: string; error: string }> = [];
  const guard = (step: string, fn: () => unknown) => {
    try {
      fn();
    } catch (err) {
      errors.push({
        step,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  if (mode === 'cau' || mode === 'all') {
    guard('bridge.run', () => run());
    guard('bridge.qdStep', () => qdStep());
    if (trOn() || mode === 'all') guard('bridge.trStep', () => trStep());
    if (dcOn() || mode === 'all') guard('bridge.dcStep', () => dcStep());
  }
  if (mode === 'ch' || mode === 'all') {
    guard('culvert.chStep', () => chStep());
    guard('culvert.chnStep', () => chnStep());
  }
  if (mode === 'ct' || mode === 'all') {
    guard('culvert.ctStep', () => ctStep());
  }
  if (mode === 'tc' || mode === 'all') {
    guard('wall.tcStep', () => tcStep());
  }
  if (mode === 'tl' || mode === 'all') {
    guard('wall.tlStep', () => tlStep({ force: true }));
  }
  if (mode === 'tv' || mode === 'all') {
    guard('hydro.hvStep', () => hvStep());
  }
  if (mode === 'tvc' || mode === 'all') {
    guard('hydro.tvcStep', () => tvcStep());
  }

  return { mode, errors };
}

// ---------------------------------------------------------------------------
// 6. Browser / jsdom Event Wiring (`12_`, `16_`, `18_`)
// ---------------------------------------------------------------------------

export function initOrchestratorDom(): () => void {
  if (typeof document === 'undefined') return () => {};
  const cleanups: Array<() => void> = [];
  let tm: ReturnType<typeof setTimeout> | undefined;
  let chT: ReturnType<typeof setTimeout> | undefined;
  let ctT: ReturnType<typeof setTimeout> | undefined;
  let hvT: ReturnType<typeof setTimeout> | undefined;
  let tqRz: ReturnType<typeof setTimeout> | undefined;

  const listen = (
    el:
      | EventTarget
      | {
          addEventListener?: (...args: unknown[]) => void;
          removeEventListener?: (...args: unknown[]) => void;
        }
      | null
      | undefined,
    evt: string,
    fn: EventListenerOrEventListenerObject,
  ) => {
    if (!el || typeof el.addEventListener !== 'function') return;
    (el.addEventListener as (t: string, cb: EventListenerOrEventListenerObject) => void)(evt, fn);
    cleanups.push(() => {
      if (typeof el.removeEventListener === 'function') {
        (el.removeEventListener as (t: string, cb: EventListenerOrEventListenerObject) => void)(
          evt,
          fn,
        );
      }
    });
  };

  const keep = getKeepElements();
  keep.forEach((e) => {
    listen(e, 'input', () => saveAll());
    listen(e, 'change', () => {
      saveAll();
      if (e.id.startsWith('ch_')) {
        if (chT) clearTimeout(chT);
        chT = setTimeout(() => chStep(), 120);
        return;
      }
      if (e.id.startsWith('ct_')) {
        if (ctT) clearTimeout(ctT);
        ctT = setTimeout(() => ctStep(), 120);
        return;
      }
      if (e.id === 'td_lcv') {
        const TRR = getLatestTrResult();
        if (TRR) trFigLoad(TRR, e.value);
        return;
      }
      if (e.id === 'td_dk' || e.id === 'td_dc') {
        const TRR = getLatestTrResult();
        const TRC = getLatestTrCheck();
        if (TRR && TRC) trDiagView(TRR, TRC);
        return;
      }
      if (e.id === 'td_dside') {
        const TRR = getLatestTrResult();
        const TRC = getLatestTrCheck();
        if (TRR && TRC) {
          trDiagView(TRR, TRC);
          trRender21(TRR, TRC);
        }
        return;
      }
      if (/^hv_/.test(e.id)) {
        if (hvT) clearTimeout(hvT);
        hvT = setTimeout(() => hvStep(), 150);
        return;
      }
      if (/^(td_|T_|C_|P_|U_|W_|dt_|sfd_|rc_x|rc_g|rc_dx|rc_db)/.test(e.id)) {
        trSchedule();
        return;
      }
      if (/^tq_(kn|tru|mot)$/.test(e.id)) {
        trVis();
        dcVis();
        tqStep();
        trSchedule();
        return;
      }
      if (tm) clearTimeout(tm);
      tm = setTimeout(() => run(), 150);
    });
  });

  document.querySelectorAll<HTMLElement>('.tabs .tab').forEach((b) => {
    listen(b, 'click', () => {
      const t = b.dataset.t || '7';
      showTab(t);
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(
            APPMODE === 'cau'
              ? STORAGE_KEYS.tabByModePrefix + 'cau'
              : STORAGE_KEYS.tabByModePrefix + APPMODE,
            t,
          );
        }
      } catch {
        /* noop */
      }
    });
  });

  const appModeEl = $('appMode') as HTMLSelectElement | null;
  if (appModeEl) {
    listen(appModeEl, 'change', () => setMode(appModeEl.value));
  }

  [
    'tq_sup',
    'tq_bltn',
    'tq_nt',
    'tq_mo',
    'tq_kn',
    'tq_tru',
    'tq_mot',
    'tq_obj',
    'tq_sct',
    'sp_sup',
  ].forEach((id) => {
    const el = $(id);
    if (!el) return;
    listen(el, 'input', () => tqStep());
    listen(el, 'change', () => tqStep());
  });

  const bltnEl = $('tq_bltn');
  if (bltnEl) {
    listen(bltnEl, 'change', () => {
      try {
        run();
      } catch (err) {
        console.error(err);
      }
    });
  }

  document.querySelectorAll<HTMLTextAreaElement>('textarea.tqta').forEach((t) => {
    listen(t, 'input', () => tqFit(t));
    setTimeout(() => tqFit(t), 50);
  });

  if (typeof window !== 'undefined') {
    listen(window, 'resize', () => {
      if (tqRz) clearTimeout(tqRz);
      tqRz = setTimeout(
        () => document.querySelectorAll<HTMLTextAreaElement>('textarea.tqta').forEach(tqFit),
        150,
      );
    });
  }

  (['mo', 'tr'] as const).forEach((w) => {
    tplFill(w);
    const s = $('tpl_' + w) as HTMLSelectElement | null;
    if (s) {
      listen(s, 'change', () => {
        if (s.value !== '') tplApply(w, s.value);
      });
    }
  });

  (
    [
      ['tq_mot', 'mo'],
      ['tq_tru', 'tr'],
    ] as const
  ).forEach(([id, w]) => {
    const e = $(id);
    if (!e) return;
    listen(e, 'change', () => {
      tplFill(w);
      const s = $('tpl_' + w) as HTMLSelectElement | null;
      const k = tplKind(w);
      if (s && k && TPLD[k].length) {
        s.value = '0';
        tplApply(w, 0);
      }
    });
  });

  try {
    biaInit();
  } catch {
    /* noop */
  }
  try {
    tqStep();
  } catch {
    /* noop */
  }

  // Bảng địa tầng (thêm / chèn / xóa lớp, dán từ Excel) và các chế độ tường chắn / cống hộp (tc_*, tl_*, chn_*)
  let ctxT: ReturnType<typeof setTimeout> | undefined;
  const ctxRun = () => {
    if (getIDP()) trSchedule();
    else {
      if (ctxT) clearTimeout(ctxT);
      ctxT = setTimeout(() => run(), 250);
    }
  };
  try {
    geoInit(ctxRun);
    // Các trang có tiền tố ngữ cảnh (cọc trụ T_, cọc bệ trụ đặc P_, và Q_ / U_ / W_ khi có): cùng bảng địa tầng, cùng nút thêm / chèn / xóa
    for (const P of ['T_', 'P_', 'Q_', 'U_', 'W_'] as const) {
      if (document.getElementById(P + 'tbGeoIn')) withCtx(P, () => geoInit(ctxRun));
    }
  } catch (err) {
    console.error(err);
  }
  // Cốt thép đai ↔ xoắn (TCVN 11823-5, Điều 5.4.2.1): chọn kiểu cốt thép ngang thì φ nén khống chế về 0,75 (mọi trang cọc / cột)
  const onTieChange = (e: Event) => {
    const id = (e.target as { id?: string } | null)?.id;
    if (!id || !/^(T_|C_|P_|Q_|U_|W_)?tie$/.test(id)) return;
    const phic = document.getElementById(id.replace(/tie$/, 'phic')) as HTMLInputElement | null;
    if (phic) phic.value = '0.75';
  };
  document.addEventListener('change', onTieChange);
  cleanups.push(() => document.removeEventListener('change', onTieChange));
  // Dầm: nút "Nạp thư viện", đổi loại dầm (bản rỗng / dầm I / bản BTCT) → nạp mặc định lần đầu rồi tính lại (bản gốc: module 10)
  const spTypeEl = document.getElementById('sp_type');
  if (spTypeEl && spTypeEl.dataset.ghBound !== '1') {
    spTypeEl.dataset.ghBound = '1';
    try {
      bindGirderHollowEvents({ hooks: { run: () => run(), saveAll } });
    } catch (err) {
      console.error(err);
    }
  }
  cleanups.push(initWallsWiring({ saveAll }));
  cleanups.push(() => {
    if (ctxT) clearTimeout(ctxT);
  });

  // Bản quá độ (`#tab43`): tính + vẽ lại 7 hình khi sửa ô nhập liên quan, và một lần ngay khi mở trang
  // (bản gốc: IIFE cuối module 07; bản dựng lại trước đây bỏ sót nên bảng/hình bản quá độ không tự cập nhật).
  let qdT: ReturnType<typeof setTimeout> | undefined;
  const qdIds = /^(qd_|mo_|rc_fc$|rc_grade$|tq_kn$|tq_tru$|tq_mot$|md_)/;
  const qdGo = (e: Event) => {
    const id = (e.target as { id?: string } | null)?.id;
    if (!id || !qdIds.test(id)) return;
    if (qdT) clearTimeout(qdT);
    qdT = setTimeout(() => {
      try {
        qdStep();
      } catch (err) {
        console.error(err);
      }
    }, 450);
  };
  listen(document, 'input', qdGo);
  listen(document, 'change', qdGo);
  const qdInit = setTimeout(() => {
    try {
      qdStep();
    } catch (err) {
      console.error(err);
    }
  }, 300);

  return () => {
    clearTimeout(qdInit);
    if (qdT) clearTimeout(qdT);
    if (tm) clearTimeout(tm);
    if (chT) clearTimeout(chT);
    if (ctT) clearTimeout(ctT);
    if (hvT) clearTimeout(hvT);
    if (tqRz) clearTimeout(tqRz);
    cleanups.forEach((fn) => fn());
  };
}
