/**
 * Nối dây giao diện cho các chế độ tường chắn / cống mà bản dựng lại trước đây bỏ sót
 * (các IIFE cuối module gốc `06_retaining_wall_gravity.js`, `07_…` (cống hộp: lún), `09_retaining_wall_cantilever_l.js`):
 *
 * - Tường chắn trọng lực (`tc_*`): bảng đất tham khảo, thư viện kích thước (bản vẽ công ty / TKĐH 86-06X),
 *   nút "Mẫu 4 / Mẫu 8", đổi loại vật liệu / đất tham khảo, xuất DXF mặt cắt, tự tính lại khi sửa ô nhập.
 * - Tường chắn chữ L (`tl_*`): tự tính lại khi sửa ô nhập.
 * - Cống hộp, nền móng / lún (`chn_*`): tự tính lại khi sửa ô nhập.
 *
 * Mọi hàm tính (`tcStep`, `tlStep`, `chnStep`, …) giữ nguyên; file này chỉ gắn sự kiện, đúng thứ tự / độ trễ như bản gốc.
 */

import { $, num, tf } from './context.ts';
import { chnStep } from './culvertsWalls/boxCulvert.ts';
import {
  TC86G,
  TC_LIB,
  TC_LIB86,
  TC_SREF_IDS,
  getLatestTcResult,
  tc86Inputs,
  tc86Row,
  tc86Txt,
  tcDxf,
  tcFmatDef,
  tcMatDef,
  tcPre,
  tcSref,
  tcSrefInit,
  tcStep,
} from './culvertsWalls/wallGravity.ts';
import { tlStep } from './culvertsWalls/wallCantilever.ts';

export interface WallsWiringDeps {
  /** Lưu snapshot số liệu vào localStorage (`saveAll` của orchestrator). */
  saveAll: () => void;
}

type El = HTMLInputElement & HTMLSelectElement;

function tcLibInit(saveAll: () => void): void {
  const S = $('tcLibS') as unknown as El | null;
  const G = $('tcLibG') as unknown as El | null;
  const H1 = $('tcLibH1') as unknown as El | null;
  const Rs = $('tcLibR') as unknown as El | null;
  const Hv = $('tcLibHv') as unknown as El | null;
  const Hw = $('tcLibHw') as unknown as HTMLElement | null;
  const Hs = $('tcLibH') as unknown as El | null;
  const go = $('tcLibGo') as unknown as HTMLElement | null;
  const info = $('tcLibInfo') as unknown as HTMLElement | null;
  if (!S || !G || !H1 || !Rs || !Hv || !Hw || !Hs || !go || !info) return;
  if (G.dataset.tcLibBound === '1') return;
  G.dataset.tcLibBound = '1';

  const cur = () => tc86Row(G.value, +H1.value || 1, num('tcLibHv'), Rs.value);

  const preview = () => {
    const r = cur();
    if (!r) {
      info.textContent = '';
      return;
    }
    if ('err' in r) {
      info.textContent = r.err;
      return;
    }
    info.textContent = `Kích thước (cm)${r.exact ? '' : ' - nội suy giữa H = ' + tf(r.a[0], 1) + ' và ' + tf(r.b[0], 1) + ' m'}: ${tc86Txt(r)}`;
  };

  const fillH = () => {
    const is86 = S.value === '86';
    Hw.style.display = is86 ? '' : 'none';
    Rs.style.display = is86 ? '' : 'none';
    Hs.style.display = is86 ? 'none' : '';
    if (is86) {
      const g = TC86G.find((x) => x.k === G.value) || TC86G[0];
      const keep = H1.value;
      H1.style.display = g.type === 'chan' ? '' : 'none';
      if (!H1.options.length) {
        H1.innerHTML = Array.from(
          { length: 10 },
          (_, i) => `<option value="${i + 1}">H1 = ${i + 1} m</option>`,
        ).join('');
      }
      if (keep) H1.value = keep;
      const has3 = TC_LIB86.some((t) => t.g === g.k && t.r3 && t.r3.length);
      Rs.options[1].disabled = !has3;
      if (!has3) Rs.value = '2';
      preview();
    } else {
      H1.style.display = 'none';
      const g = TC_LIB[+G.value] || TC_LIB[0];
      Hs.innerHTML = g.s
        .map(
          (s, i) =>
            `<option value="${i}">H = ${tf(s.H, 1)} m${s.Hs > 0 ? ` ; mái 1:${tf(s.m, 1)} cao ${tf(s.Hs, 1)} m` : ''}</option>`,
        )
        .join('');
      info.textContent = '';
    }
  };

  const fillG = () => {
    const keep = G.value;
    G.innerHTML =
      S.value === '86'
        ? TC86G.map((g) => `<option value="${g.k}">${g.nm}</option>`).join('')
        : TC_LIB.map((g, i) => `<option value="${i}">${g.nm}</option>`).join('');
    if ([...G.options].some((o) => o.value === keep)) G.value = keep;
    fillH();
  };

  S.onchange = fillG;
  G.onchange = fillH;
  H1.onchange = preview;
  Rs.onchange = preview;
  Hv.oninput = preview;
  fillG();

  go.onclick = () => {
    let vals: Record<string, string | number>;
    let src: string;
    let v86 = '';
    if (S.value === '86') {
      preview();
      const r = cur();
      if (!r || 'err' in r) {
        info.textContent = r ? (r as { err: string }).err : '';
        return;
      }
      vals = tc86Inputs(r);
      v86 = JSON.stringify({
        g: r.G.k,
        front: r.G.front,
        mat: r.G.mat,
        w: r.G.w,
        H: r.H,
        H1: r.H1,
        t1: r.t1,
        B1: r.B1,
        B2: r.B2,
        B: r.B,
        C1: r.C1,
        C2: r.C2,
        A: r.A,
        M: r.M,
        Rk: r.Rk,
      });
      src = `Kích thước lấy theo Thiết kế định hình 86-06X (Bộ GTVT) - ${r.G.nm}${r.G.type === 'chan' ? `, H1 = ${r.H1} m` : ''}, khi cường độ tính toán của đất nền ${r.Rk === '3' ? 'R ≥ 3 kg/cm²' : 'R = 2 kg/cm²'}; H = ${tf(r.H, 2)} m${r.exact ? '' : ' (nội suy tuyến tính giữa các dòng của bảng thống kê kích thước)'}, kích thước (cm): ${tc86Txt(r)}. Điều kiện tính của định hình: đất đắp φ = 35°, γ = 1,8 T/m³, đoàn xe cách mép tường (đỉnh mái) 1 m.`;
    } else {
      const g = TC_LIB[+G.value];
      const p = g.s[+Hs.value];
      vals = {
        tc_H: p.H,
        tc_b0: p.b0,
        tc_n1: p.n1,
        tc_n2: p.n2,
        tc_hc: p.hc,
        tc_a1: p.a1,
        tc_a2: p.a2,
        tc_t1: p.t1,
        tc_t2: p.t2,
        tc_Hs: p.Hs,
        tc_m: p.Hs > 0 ? p.m : 1.5,
        tc_mat: g.mat,
      };
      src = `Kích thước lấy theo bản vẽ kè của công ty - ${g.nm}, H = ${tf(p.H, 1)} m.`;
    }
    Object.entries(vals).forEach(([id, x]) => {
      const e = $(id) as unknown as { value: string } | null;
      if (e) e.value = typeof x === 'number' ? String(+x.toFixed(4)) : x;
    });
    tcMatDef(String(vals.tc_mat));
    const tcSrc = $('tc_src') as unknown as { value: string } | null;
    const tcSrc86 = $('tc_src86') as unknown as { value: string } | null;
    if (tcSrc) tcSrc.value = src;
    if (tcSrc86) tcSrc86.value = v86;
    try {
      saveAll();
    } catch {
      /* noop */
    }
    tcStep();
  };
}

async function tcDxfSave(): Promise<void> {
  const msg = $('tcDxfMsg') as unknown as HTMLElement | null;
  const R = getLatestTcResult();
  if (!R) {
    if (msg) msg.textContent = 'Chưa có kết quả tính.';
    return;
  }
  const unit = (($('tcDxfU') as unknown as { value?: string } | null)?.value || 'cm') as 'm' | 'cm' | 'mm';
  const font = (($('tcDxfF') as unknown as { value?: string } | null)?.value || 'tcvn3') as 'tcvn3' | 'uni';
  const bytes = tcDxf(R, unit, font);
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/dxf' });
  const nm = `Mat cat tuong chan H${tf(R.I.H, 2)}m B${tf(R.g.B, 2)}m.dxf`;
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nm;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    if (msg) msg.textContent = 'Đã tạo ' + nm + '.';
  } catch (e) {
    if (msg) msg.textContent = 'Không lưu được file: ' + ((e as Error)?.message || e);
  }
}

export function initWallsWiring(deps: WallsWiringDeps): () => void {
  if (typeof document === 'undefined') return () => {};
  const { saveAll } = deps;
  const safeSave = () => {
    try {
      saveAll();
    } catch {
      /* noop */
    }
  };

  try {
    tcSrefInit();
    tcLibInit(saveAll);
  } catch (err) {
    console.error(err);
  }

  let tcT: ReturnType<typeof setTimeout> | undefined;
  let chnT: ReturnType<typeof setTimeout> | undefined;

  const onClick = (e: Event) => {
    const t = e.target as Element | null;
    const pre = t?.closest ? t.closest('#tc_pre8,#tc_pre4') : null;
    if (pre) tcPre(pre.id === 'tc_pre8' ? 8 : 4);
    if ((t as { id?: string } | null)?.id === 'tcDxfGo') void tcDxfSave();
  };

  const onInput = (e: Event) => {
    const id = (e.target as { id?: string } | null)?.id;
    if (!id) return;
    if ((TC_SREF_IDS as readonly string[]).includes(id)) {
      const S = $('tc_sref') as unknown as { value: string } | null;
      if (S && S.value !== 'kt') {
        S.value = 'kt';
        safeSave();
      }
    }
    if (id.startsWith('tc_')) {
      if (tcT) clearTimeout(tcT);
      tcT = setTimeout(() => {
        try {
          tcStep();
        } catch (err) {
          console.error(err);
        }
      }, 150);
    }
    if (/^tl_/.test(id)) tlStep();
    if (/^chn_/.test(id)) {
      if (chnT) clearTimeout(chnT);
      chnT = setTimeout(() => {
        try {
          chnStep();
        } catch (err) {
          console.error(err);
        }
      }, 200);
    }
  };

  const onChange = (e: Event) => {
    const el = e.target as { id?: string; value?: string } | null;
    const id = el?.id;
    if (!id) return;
    if (id === 'tc_mat') {
      tcMatDef(String(el?.value));
      safeSave();
    }
    if (id === 'tc_fmat') {
      tcFmatDef(String(el?.value));
      safeSave();
    }
    if (id === 'tc_sref') tcSref(String(el?.value));
    else if ((TC_SREF_IDS as readonly string[]).includes(id)) {
      const S = $('tc_sref') as unknown as { value: string } | null;
      if (S && S.value !== 'kt') {
        S.value = 'kt';
        safeSave();
      }
    }
    if (id.startsWith('tc_')) {
      if (tcT) clearTimeout(tcT);
      tcT = setTimeout(() => {
        try {
          tcStep();
        } catch (err) {
          console.error(err);
        }
      }, 50);
    }
    if (/^tl_/.test(id)) tlStep();
    if (/^chn_/.test(id)) {
      if (chnT) clearTimeout(chnT);
      chnT = setTimeout(() => {
        try {
          chnStep();
        } catch (err) {
          console.error(err);
        }
      }, 200);
    }
  };

  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('change', onChange);

  return () => {
    if (tcT) clearTimeout(tcT);
    if (chnT) clearTimeout(chnT);
    document.removeEventListener('click', onClick);
    document.removeEventListener('input', onInput);
    document.removeEventListener('change', onChange);
  };
}
