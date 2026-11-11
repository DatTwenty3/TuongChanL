import {
  calcGlobalChecks,
  geom,
  isCalcValid,
  type CalcRunResult,
  type RcMaterialProps,
  type RcRunResult,
  type RcSectionInput,
} from '../engine';
import { fmt, fmt2 } from '../cad/layers';
import { CD_LAB, cdLab, cnf, escHtml, nextReportFigNo } from './cfig';
import { texToHtml } from './texToHtml';
import type { CalcCheckItem, Project } from '../types/project';

export { CD_LAB, cdLab };

export const sOk = (b: boolean): string =>
  `<span class="${b ? 'ok' : 'bad'}">${b ? 'Đạt' : 'Không đạt'}</span>`;

export const sRow = (
  lab: string,
  sym?: string,
  val?: string | number | null,
  unit?: string,
  note?: string,
): string =>
  `<div class="cr"><span></span><span>${lab}</span><span class="sym">${sym || ''}</span><span class="val">${val == null ? '' : val}</span><span class="unit">${unit || ''}</span><span class="note">${note || ''}</span></div>`;

export const sRowT = (lab: string, txt: string): string =>
  `<div class="cr"><span></span><span>${lab}</span><span class="sym"></span><span class="vt">${txt}</span></div>`;

export const sTx = (t: string): string => `<div class="cr"><span></span><span>${t}</span></div>`;

export const sF = (tex: string): string =>
  `<div class="cr f"><span></span><span class="fx" data-tex="${String(tex)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')}">${texToHtml(tex)}</span></div>`;

export const sTab = (
  head: string[],
  rows: (string | number)[][],
  al?: string[],
): string =>
  `<table class="t dt${rows.length <= 7 ? ' sm' : ''}"><tr>` +
  head.map((h) => `<th>${h}</th>`).join('') +
  '</tr>' +
  rows
    .map(
      (r) =>
        '<tr>' +
        r
          .map((c, i) => {
            const k = al ? al[i] : i === 0 ? 'l' : '';
            return `<td${k && k !== 'r' ? ` class="${k}"` : ''}>${c}</td>`;
          })
          .join('') +
        '</tr>',
    )
    .join('') +
  '</table>';

export const sExp = (v: number, d = 3): string => {
  const e = Math.floor(Math.log10(Math.abs(v) || 1));
  const m = v / Math.pow(10, e);
  return cnf(m, d) + '·10<sup>' + e + '</sup>';
};

export const sKL = (ok: boolean, t1: string, t2: string): string =>
  `<p class="kl ${ok ? 'ok' : 'bad'}">KẾT LUẬN: ${ok ? t1 : t2}</p>`;

export const sH2 = (t: string): string => `<h2>${t}</h2>`;
export const sH3 = (t: string): string => `<h3>${t}</h3>`;

export const sFig = (svg: string, cap: string): string =>
  `<div class="figw">${svg}</div><p class="small cap">Hình ${nextReportFigNo()}. ${cap}</p>`;

export const S_KEYS = ['Ib', 'Ia', 'Ic', 'Eb', 'Ea'] as const;

type CalcFootLike = { U?: unknown; UE?: unknown };

export const sFootPress = (fs: CalcFootLike): string => {
  const m = fs as unknown as Record<string, { pr: { q1: number; q2: number } } | undefined>;
  return S_KEYS.filter((k) => m[k])
    .map((k) => {
      const entry = m[k]!;
      return `${CD_LAB[k]} q mũi = ${cnf(entry.pr.q1, 1)} kPa, q gót = ${cnf(entry.pr.q2, 1)} kPa`;
    })
    .join('; ');
};

export const sKeyU = (o: CalcFootLike): (typeof S_KEYS)[number] | undefined => {
  const m = o as unknown as Record<string, unknown>;
  return (['Ib', 'Ia', 'Ic'] as const).find((k) => m[k] === o.U);
};

export const sKeyE = (o: CalcFootLike): ('Ea' | 'Eb') | null => {
  const m = o as unknown as Record<string, unknown>;
  return o.UE ? ((['Ea', 'Eb'] as const).find((k) => m[k] === o.UE) ?? null) : null;
};

export const CALC_ROCKN: Record<string, string> = {
  A: 'A - đá cacbonat: đôlômit, đá vôi, đá hoa',
  B: 'B - đá sét kết, bột kết, phiến sét, đá phiến',
  C: 'C - cát kết, quarzit',
  D: 'D - đá mácma hạt mịn: andezit, điabaz, riolit',
  E: 'E - đá mácma hạt thô, biến chất: granit, gabro, gnai',
};

export function calcPjDate(s: string | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s || '').trim();
}

export function calcPjBlock(P: Project): string {
  const c: Partial<NonNullable<Project['calc']>> = P.calc || {};
  const pairs: [string, string | undefined][] = [
    ['Tên dự án', c.pjName],
    ['Hạng mục', c.pjItem],
    ['Địa điểm xây dựng', c.pjPlace],
    ['Người tính', c.pjBy],
    ['Ngày lập', calcPjDate(c.pjDate)],
  ];
  return pairs
    .filter((r) => String(r[1] == null ? '' : r[1]).trim())
    .map((r) => sRowT(r[0], escHtml(String(r[1]).trim())))
    .join('');
}

export function sRC(
  S: RcSectionInput,
  M: RcMaterialProps,
  rc: RcRunResult,
  face: [string, string],
): string {
  const g = rc.gM!;
  const sh = rc.gV!.sh;
  const fl = g.fl;
  const T = g.M >= 0 ? S.f1 : S.f2;
  const mr = rc.minR;
  const cr = rc.cr;
  const tf = cnf;

  let h = sTab(
    ['Tổ hợp', 'TTGH', 'M (kN.m)', 'V (kN)', 'N (kN)'],
    rc.rows.map((r) => [r.id, r.st === 'SD' ? 'Sử dụng' : 'Cường độ', tf(r.M), tf(r.V), tf(r.N)]),
  );
  h += sTx(
    `<b>a) Sức kháng uốn</b> (TCVN 11823-5, Điều 7.3.2 ; hệ số sức kháng φ theo Điều 5.4.2). Cốt thép chịu kéo ${face[g.M >= 0 ? 0 : 1]}: Φ${tf(T.d, 0)} a ${tf(T.s, 0)} mm.`,
  );
  h += sF(
    String.raw`a = \dfrac{A_s f_y}{0.85\,f'_c\,b}\ ;\quad M_n = A_s f_y\left(d_s - \dfrac{a}{2}\right)\ ;\quad M_r = \phi\,M_n \ge M_u`,
  );
  h +=
    sRow('Bề rộng ; chiều cao mặt cắt', 'b ; h', tf(S.b, 0) + ' ; ' + tf(S.h, 0), 'mm') +
    sRow('Diện tích cốt thép chịu kéo trên 1 m', 'As', tf(fl.As, 1), 'mm²') +
    sRow('Chiều cao có hiệu', 'ds', tf(fl.ds, 1), 'mm') +
    sRow(
      'Chiều cao vùng nén ; chiều cao khối ứng suất chữ nhật',
      'c ; a',
      tf(fl.c, 1) + ' ; ' + tf(fl.a, 1),
      'mm',
    ) +
    sRow(
      'Biến dạng cốt thép chịu kéo ; hệ số sức kháng',
      'εt ; φ',
      tf(fl.et, 4) + ' ; ' + tf(g.phi, 3),
      '',
    ) +
    sRow(
      'Sức kháng uốn danh định ; tính toán',
      'Mn ; Mr',
      tf(fl.Mn, 2) + ' ; ' + tf(g.Mr, 2),
      'kN.m',
    ) +
    sRow('Mômen tính toán (' + g.id + ')', 'Mu', tf(Math.abs(g.M), 2), 'kN.m') +
    sRow('Kiểm tra Mr ≥ Mu', '', '', '', sOk(g.rM >= 1));

  if (mr) {
    h += sTx(
      '<b>b) Lượng cốt thép tối thiểu</b> (TCVN 11823-5, Điều 7.3.3.2): Mr ≥ min(Mcr ; 1,33Mu).',
    );
    h += sF(
      String.raw`M_{cr} = \gamma_3\,\gamma_1\,f_r\,S_c\ ;\quad f_r = 0.63\sqrt{f'_c}\ ;\quad \gamma_1 = 1.6\ ;\ \gamma_3 = f_y/f_u`,
    );
    h +=
      sRow(
        'Mô đun chống uốn mặt cắt ; cường độ chịu kéo khi uốn',
        'Sc ; fr',
        sExp((S.b * S.h * S.h) / 6, 3) + ' ; ' + tf(M.fr, 3),
        'mm³ ; MPa',
      ) +
      sRow(
        'Mômen nứt ; 1,33Mu',
        'Mcr ; 1,33Mu',
        tf(mr.Mcr, 2) + ' ; ' + tf(1.33 * mr.Mu, 2),
        'kN.m',
      ) +
      sRow('Kiểm tra Mr ≥ min(Mcr ; 1,33Mu)', '', '', '', sOk(mr.ok));
  }

  if (cr) {
    h += sTx(
      `<b>c) Kiểm soát nứt</b> (TCVN 11823-5, Điều 7.3.4 ; TTGH Sử dụng I, M = ${tf(Math.abs(rc.gS!.M), 2)} kN.m ; điều kiện tiếp xúc loại ${M.ge >= 1 ? '1' : '2'}, γe = ${tf(M.ge, 2)}).`,
    );
    h += sF(
      String.raw`s \le \dfrac{123000\,\gamma_e}{\beta_s\,f_{ss}} - 2\,d_c\ ;\quad \beta_s = 1 + \dfrac{d_c}{0.7\,(h - d_c)}\ ;\quad f_{ss} = \dfrac{M_s}{A_s\,j\,d_s} \le 0.6\,f_y`,
    );
    h +=
      sRow(
        'Ứng suất kéo thớ biên khi chưa nứt ; 0,8fr',
        'fct ; 0,8fr',
        tf(cr.fct, 3) + ' ; ' + tf(0.8 * M.fr, 3),
        'MPa',
      ) +
      sRow('Khoảng cách từ thớ chịu kéo đến tâm cốt thép', 'dc', tf(T.dc, 1), 'mm') +
      sRow('Hệ số k ; j', 'k ; j', tf(cr.k, 4) + ' ; ' + tf(cr.j, 4), '') +
      sRow('Ứng suất cốt thép khi sử dụng', 'fss', tf(cr.fss, 2), 'MPa') +
      sRow('Hệ số βs', 'βs', tf(cr.bs, 4), '') +
      sRow(
        'Khoảng cách cốt thép lớn nhất ; bố trí',
        'smax ; s',
        tf(cr.smax, 0) + ' ; ' + tf(cr.sb, 0),
        'mm',
      ) +
      sRow('Kiểm tra s ≤ smax', '', '', '', sOk(cr.ok));
  }

  h += sTx(
    '<b>d) Sức kháng cắt</b> (TCVN 11823-5, Điều 8.3.3, 8.3.4.2 ; không bố trí cốt thép đai ; φv = 0,90).',
  );
  h += sF(
    String.raw`V_r = \phi_v V_c\ ;\quad V_c = 0.083\,\beta\sqrt{f'_c}\,b_v\,d_v\ ;\quad \beta = \dfrac{4.8}{1 + 750\,\varepsilon_s}\cdot\dfrac{1300}{1000 + s_{xe}}\ ;\quad \varepsilon_s = \dfrac{|M_u|/d_v + |V_u|}{E_s A_s}`,
  );
  h +=
    sRow('Chiều cao chịu cắt có hiệu', 'dv', tf(sh.dv, 1), 'mm') +
    sRow(
      'Biến dạng dọc cốt thép chịu kéo ; tham số khoảng cách vết nứt',
      'εs ; sxe',
      tf(sh.es * 1e3, 4) + '‰ ; ' + tf(sh.sxe, 1),
      '; mm',
    ) +
    sRow('Hệ số β ; góc θ', 'β ; θ', tf(sh.beta, 3) + ' ; ' + tf(sh.th, 1), '; độ') +
    sRow(
      'Sức kháng cắt của bê tông ; tính toán',
      'Vc ; Vr',
      tf(sh.Vc, 2) + ' ; ' + tf(sh.Vr, 2),
      'kN',
    ) +
    sRow('Lực cắt tính toán (' + rc.gV!.id + ')', 'Vu', tf(Math.abs(rc.gV!.V), 2), 'kN') +
    sRow('Kiểm tra Vr ≥ Vu', '', '', '', sOk(rc.gV!.rV >= 1));

  return h;
}

export function calcProportion(P: Project): {
  B: number;
  H: number;
  toe: number;
  rB: number;
  rT: number;
  okB: boolean;
  okT: boolean;
  light: boolean;
} {
  const g0 = geom(P);
  const B = g0.B / 100;
  const H = g0.yTop / 100;
  const toe = Math.max(0, P.toe || 0) / 100;
  const rB = B / Math.max(H, 1e-9);
  const rT = toe / Math.max(B, 1e-9);
  const e = 1e-6;
  return {
    B,
    H,
    toe,
    rB,
    rT,
    okB: rB >= 0.5 - e && rB <= 0.7 + e,
    okT: rT >= 0.15 - e && rT <= 0.25 + e,
    light: P.type === 'canti',
  };
}

export function calcTipText(
  P: Project,
  f: (v: number, d?: number) => string,
  lead: string,
): string {
  const q = calcProportion(P);
  const flag = (ok: boolean) => (ok || !q.light ? '' : ' (ngoài khoảng thường dùng)');
  return (
    `${lead}: bề rộng đáy móng B thường chọn từ ${f(0.5, 1)}H đến ${f(0.7, 1)}H; chiều dài mũi móng thường từ ${f(0.15, 2)}B đến ${f(0.25, 2)}B để cân bằng ổn định lật và trượt (H - chiều cao toàn tường tính từ đáy bản đáy). ` +
    `Tường hiện tại: H = ${f(q.H, 2)} m ; B = ${f(q.B, 2)} m = ${f(q.rB, 2)}H${flag(q.okB)} ; mũi = ${f(q.toe, 2)} m = ${f(q.rT, 2)}B${flag(q.okT)}.` +
    (q.light
      ? ''
      : ' Khoảng này dùng cho tường không sườn; tường có sườn thường có gót dài hơn.')
  );
}

export const calcTipLive = (P: Project): string =>
  calcTipText(P, (v, d) => (d === 1 ? fmt(v, 1) : fmt2(v)), 'Mẹo thiết kế');

export function calcChecks(R: CalcRunResult | null | undefined): CalcCheckItem[] {
  if (!isCalcValid(R) || !R.ok) return [];
  const fin = (v: number) => (Number.isFinite(v) ? v : 0);
  const rcR = (rc: RcRunResult) =>
    Math.max(
      rc.gM ? fin(1 / rc.gM.rM) : 0,
      rc.gV ? fin(1 / rc.gV.rV) : 0,
      rc.minR ? fin(rc.minR.lim / Math.max(rc.minR.Mr, 1e-9)) : 0,
      rc.cr ? fin(rc.cr.sb / rc.cr.smax) : 0,
    );

  let L: CalcCheckItem[];
  if (R.model === 'rib') {
    L = (R.checks || []).filter((x) => x.id !== 'pip' && x.id !== 'slope');
  } else {
    L = calcGlobalChecks(R).filter((x) => x.id !== 'pip');
    L.push(
      { id: 'stem', t: 'Thân tường', v: rcR(R.st.rc!), ok: R.ok.stem },
      {
        id: 'ifc',
        t: 'Mối nối chân tường',
        v: Math.max(
          R.ifc.Vu / Math.max(R.ifc.Vr, 1e-9),
          R.ifc.Ve ? R.ifc.Ve / Math.max(R.ifc.Vn, 1e-9) : 0,
          R.ifc.Avmin / Math.max(R.ifc.Avf, 1e-9),
        ),
        ok: Boolean(R.ok.ifc),
      },
      { id: 'toe', t: 'Bản đáy – mũi', v: rcR(R.toe.rc!), ok: R.ok.toe },
      { id: 'heel', t: 'Bản đáy – gót', v: rcR(R.heel.rc!), ok: R.ok.heel },
      {
        id: 'sh',
        t: 'Cốt thép co ngót',
        v: Math.max(
          R.shS.req / R.shS.As,
          R.shS.s / R.shS.smax,
          R.shF.req / R.shF.As,
          R.shF.s / R.shF.smax,
        ),
        ok: R.ok.sh,
      },
    );
  }

  if (R.fe && R.model !== 'rib' && R.fe.basis === 'fe') {
    L.push({ id: 'fe', t: 'Mô hình FE – các mặt cắt', v: R.fe.util ?? 0, ok: Boolean(R.fe.ok) });
  }
  if (R.fe && R.fe.basis !== 'fe') {
    L.push({
      id: 'fe',
      t: 'Mô hình FE (đối chiếu)',
      v: R.fe.util ?? 0,
      ok: Boolean(R.fe.ok),
      info: true,
    });
  }

  const ex: CalcCheckItem[] = [];
  const p = R.W && R.W.pip;
  if (p && (p.kind === 'avg' || p.kind === 'prism')) {
    ex.push({
      id: 'pip',
      t: 'Xói ngầm',
      v: Number.isFinite(p.FS) && p.FS > 0 ? p.FSreq / p.FS : 0,
      ok: Boolean(R.ok.pip),
    });
  }
  if (R.slope) {
    const S = R.slope as { FS?: number; FSreq?: number; none?: boolean; best?: { FS?: number } };
    const fs = S.FS ?? S.best?.FS ?? 0;
    const req = S.FSreq ?? 1 / Math.max(R.I.bsPhiR || 0.65, 1e-6);
    ex.push({
      id: 'slope',
      t: 'Ổn định tổng thể',
      v: S.none || !(fs > 0) ? 99 : req / fs,
      ok: Boolean(R.ok.slope),
    });
  }

  if (ex.length) {
    let at = 0;
    L.forEach((x, i) => {
      if (['e', 'sl', 'br', 'an'].indexOf(x.id) >= 0) at = i + 1;
    });
    L.splice(at, 0, ...ex);
  }
  return L;
}
