/**
 * Móng cọc – nối kết quả tính tường (`calcRun`) với mô đun cọc: lấy tổ hợp tải, chạy `pileRun`,
 * sinh các mục kiểm tra hiển thị ở thanh bên / huy hiệu. Tắt cọc thì mọi hàm ở đây là no-op và
 * không đổi `calcChecks` của tường.
 */

import { calcBadgeStatus, calcChecks, isCalcValid, type CalcRunResult } from './calcOrchestrator.ts';
import { pileOn } from './pile.ts';
import { cuBqu, cuCheckItems, cuGrid, cuOn, cuRun, type CuResult } from './cuTram.ts';
import { lunCheckItems, lunOn, lunRun, type LunResult } from './lun.ts';
import { pileRun, type PileResult, type PileWallCombo } from './pileCore.ts';
import type { EngineCheckItem, EngineProject } from './types.ts';

/** Các tổ hợp tải của tường tại đáy bản đáy (trên 1 m dài). */
export function pileCombos(R: CalcRunResult | null | undefined): PileWallCombo[] {
  if (!isCalcValid(R) || !R.C) return [];
  return R.C.filter((c) => c && Number.isFinite(c.N)).map((c) => ({
    k: c.k,
    nm: c.nm,
    N: c.N,
    s: Number.isFinite(c.s) ? c.s : 0,
    H: Number.isFinite(c.H) ? c.H : 0,
  }));
}

let _cache: { key: string; res: PileResult | null } = { key: '', res: null };

/** Kết quả móng cọc cho một lần chạy tính tường; null khi tắt hoặc tường chưa tính được. */
export function pileFromCalc(P: EngineProject, R: CalcRunResult | null | undefined): PileResult | null {
  if (!pileOn(P) || !isCalcValid(R) || !R.g) return null;
  const combos = pileCombos(R);
  const B = R.g.B * 100; // m → cm
  const key = JSON.stringify([P.pile, P.Lu, B, combos]);
  if (_cache.key === key) return _cache.res;
  const res = pileRun(P, combos, B);
  _cache = { key, res };
  return res;
}

export function resetPileCache(): void {
  _cache = { key: '', res: null };
  _cuCache = { key: '', res: null };
  _lunCache = { key: '', res: null };
}

let _cuCache: { key: string; res: CuResult | null } = { key: '', res: null };

/** Kết quả móng cừ tràm cho một lần chạy tính tường; null khi tắt hoặc tường chưa tính được. */
export function cuFromCalc(P: EngineProject, R: CalcRunResult | null | undefined): CuResult | null {
  if (!cuOn(P) || !isCalcValid(R) || !R.g) return null;
  const combos = pileCombos(R);
  const B = R.g.B;
  const Lu = P.Lu / 100;
  const key = JSON.stringify([P.cu, Lu, B, combos]);
  if (_cuCache.key === key) return _cuCache.res;
  const res = cuRun(P.cu!, combos, B, Lu);
  res.nTotal = cuGrid(P.cu!, B, Lu).n;
  _cuCache = { key, res };
  return res;
}

let _lunCache: { key: string; res: LunResult | null } = { key: '', res: null };

/**
 * Độ lún cố kết của nền dưới bản đáy cho một lần chạy tính tường; null khi tắt hoặc tường chưa tính được.
 * Áp lực tiêu chuẩn lấy từ tổ hợp sử dụng (SD): p = N/B. Có cừ tràm thì tải đặt tại mũi cừ trên bề rộng móng khối quy ước.
 */
export function lunFromCalc(P: EngineProject, R: CalcRunResult | null | undefined): LunResult | null {
  if (!lunOn(P) || !isCalcValid(R) || !R.g) return null;
  const q = P.lun!;
  const B = R.g.B;
  const combos = pileCombos(R);
  const sd = combos.filter((c) => c.k === 'SD');
  const use = sd.length ? sd : combos;
  let p = 0;
  let pAt = '';
  use.forEach((c) => {
    const v = c.N / B;
    if (v > p) {
      p = v;
      pAt = c.nm;
    }
  });
  const cu = cuOn(P) ? P.cu! : null;
  const cfg = cu ? { ...q, hm: cu.hm } : q;
  const gFill = P.calc?.gs ?? 18;
  const key = JSON.stringify([cfg, B, p, R.g.Hp, gFill, cu ? [cu.L, cu.phi] : null]);
  if (_lunCache.key === key) return _lunCache.res;
  const res = lunRun(cfg, {
    B,
    p,
    pAt,
    Hfill: R.g.Hp,
    gFill,
    cu: cu ? { L: cu.L, Bqu: cuBqu(B, cu.L, cu.phi) } : null,
  });
  _lunCache = { key, res };
  return res;
}

const TIP_PILE = 'Kiểm tra theo TCVN 10304:2025; hệ số sử dụng = γn·Nd / Rd (≤ 1 là đạt)';

/** Các mục kiểm tra riêng của cọc (rỗng khi tắt hoặc chưa đủ số liệu). */
export function pileChecks(P: EngineProject, R: CalcRunResult | null | undefined): EngineCheckItem[] {
  const r = pileFromCalc(P, R);
  if (!r) return [];
  const out: EngineCheckItem[] = [];
  if (!r.ok || r.vAxial == null) {
    out.push({ id: 'pile-axial', t: 'Sức chịu tải cọc', v: 99, ok: false, tip: 'Chưa đủ số liệu để tính sức chịu tải cọc – xem mục Móng cọc' });
    return out;
  }
  out.push({ id: 'pile-axial', t: 'Sức chịu tải cọc (nén)', v: r.vAxial, ok: r.vAxial <= 1, tip: TIP_PILE });
  if (r.vUplift != null) {
    out.push({ id: 'pile-uplift', t: 'Sức chịu nhổ của cọc', v: r.vUplift, ok: r.vUplift <= 1, tip: TIP_PILE });
  } else if (r.NdTens > 0) {
    out.push({ id: 'pile-uplift', t: 'Sức chịu nhổ của cọc', v: 99, ok: false, tip: 'Có cọc chịu kéo nhưng chưa có số liệu sức chịu nhổ' });
  }
  return out;
}

/**
 * Danh sách kiểm tra hiển thị: `calcChecks(R)` của tường + kiểm tra cọc. Khi bật cọc và
 * `ignoreShallow`, các mục sức kháng nền (`br`) và trượt (`sl`) chỉ còn là tham khảo.
 * Tắt cọc: trả đúng `calcChecks(R)`.
 */
export function allChecks(P: EngineProject, R: CalcRunResult | null | undefined): EngineCheckItem[] {
  const base = calcChecks(R) as EngineCheckItem[];
  const hasPile = pileOn(P);
  const hasCu = cuOn(P);
  const hasLun = lunOn(P);
  if (!hasPile && !hasCu && !hasLun) return base;
  let items = base;
  if (hasPile && P.pile!.ignoreShallow) {
    items = items.map((x) =>
      x.id === 'br' || x.id === 'sl'
        ? { ...x, info: true, tip: 'Móng cọc chịu lực: kiểm tra móng nông chỉ để tham khảo (đổi ở mục Móng cọc)' }
        : x,
    );
  }
  if (hasCu && P.cu!.ignoreShallow) {
    items = items.map((x) =>
      x.id === 'br' && !x.info
        ? { ...x, info: true, tip: 'Nền đã gia cố cừ tràm: sức kháng nền của móng nông chỉ để tham khảo (đổi ở mục Cừ tràm)' }
        : x,
    );
  }
  return [
    ...items,
    ...(hasPile ? pileChecks(P, R) : []),
    ...(hasCu ? cuCheckItems(cuFromCalc(P, R)) : []),
    ...(hasLun ? lunCheckItems(lunFromCalc(P, R)) : []),
  ];
}

export function allBadCount(P: EngineProject, R: CalcRunResult | null | undefined): number {
  return allChecks(P, R).filter((x) => !x.ok && !x.info).length;
}

/** Như `calcBadgeStatus` nhưng tính cả kiểm tra cọc; tắt cọc thì trả đúng kết quả của `calcBadgeStatus`. */
export function badgeStatusAll(
  R: CalcRunResult | null | undefined,
  P: EngineProject,
): ReturnType<typeof calcBadgeStatus> {
  const st = calcBadgeStatus(R, P);
  if ((!pileOn(P) && !cuOn(P) && !lunOn(P)) || !isCalcValid(R)) return st;
  const bad = allBadCount(P, R);
  return {
    count: bad,
    pending: st.pending,
    text: bad ? '✗ ' + bad : st.pending ? '…' : '✓',
    cls: bad ? 'bad' : st.pending ? '' : 'ok',
  };
}
