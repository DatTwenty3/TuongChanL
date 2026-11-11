import { ancOn, barList, geom, isB, isC, isD } from '../engine';
import type { BarsResult, CadContext, Point2D, Project, QuantitiesResult } from '../types/project';
import { Ents } from './ents';
import { blindT, fmt, fmt2, keyOn, unitW } from './layers';
import { type QtyGroup, qtyGroups } from './viewsCommon';
import { viewBarTableB } from './viewsTemplateB';

export { type QtyGroup, qtyGroups };

export function viewBarShapes(
  p: Project,
  res: BarsResult,
  _q: QuantitiesResult,
  ctx: CadContext,
): Ents {
  const E = new Ents();
  const { mm } = ctx;
  const CW = 100;
  const CH = 46;
  const NC = 3;
  barList(res).forEach((b, i) => {
    const x0 = (i % NC) * CW;
    const y0 = -Math.floor(i / NC) * CH;
    const cx = x0 + 7;
    const cy = y0 - 6;
    E.circ(mm(cx), mm(cy), mm(2.9), 'NOTE');
    E.text(
      mm(cx),
      mm(cy) - mm(0.9),
      String(b.mark),
      String(b.mark).length > 2 ? mm(1.9) : mm(2.4),
      'NOTE',
      { al: 'c', raw: isD(p) },
    );
    const avg = b.items.length ? b.items.reduce((s, v) => s + v, 0) / b.items.length : 0;
    const cnt = b.count ?? b.items.length;
    const minL = b.minL ?? 0;
    const maxL = b.maxL ?? minL;
    if (isB(p)) {
      E.line(mm(cx + 4), mm(cy), mm(cx + 40), mm(cy), 'NOTE');
      E.text(
        mm(cx + 22),
        mm(cy) + mm(0.8),
        `${p.labelUnit}${b.d}${b.a ? ' a=' + fmt(b.a * 10) : ''}`,
        mm(2.3),
        'NOTE',
        { al: 'c' },
      );
      E.text(mm(cx + 22), mm(cy) - mm(3.2), `L=${fmt(avg)}`, mm(2.3), 'NOTE', { al: 'c' });
    } else {
      E.text(
        mm(cx + 5),
        mm(cy) - mm(1),
        `${p.labelUnit}${b.d}; n=${cnt}; ${b.ltb || minL !== maxL ? 'Ltb' : 'L'}=${fmt(Math.round(avg))}`,
        mm(2.4),
        'NOTE',
      );
    }
    const pts = b.path;
    const segs: Point2D[] = [];
    for (let j = 1; j < pts.length; j++) {
      segs.push([pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]]);
    }
    let lens = segs.map((v) => Math.hypot(v[0], v[1]));
    if (!b.straight) {
      const an = segs.map((v) => Math.round(Math.atan2(v[1], v[0]) / (Math.PI / 4)));
      const ns: Point2D[] = [];
      const nl: number[] = [];
      segs.forEach((v, j) => {
        if (ns.length && an[j] === an[j - 1]) {
          ns[ns.length - 1] = [ns[ns.length - 1][0] + v[0], ns[ns.length - 1][1] + v[1]];
          nl[nl.length - 1] += lens[j];
        } else {
          ns.push(v);
          nl.push(lens[j]);
        }
      });
      segs.length = 0;
      ns.forEach((v) => segs.push(v));
      lens = nl;
    }
    const mx = lens.length ? Math.max(...lens) : 1;
    const bw = CW - 26;
    const bh = CH - 24;
    let cur: Point2D = [0, 0];
    let SP: Point2D[] = [cur];
    if (b.shape) {
      SP = b.shape.pts.map((v) => [v[0], v[1]] as Point2D);
      lens = b.shape.lens.slice();
    } else {
      segs.forEach((v, j) => {
        const ang = b.straight
          ? 0
          : Math.round(Math.atan2(v[1], v[0]) / (Math.PI / 4)) * (Math.PI / 4);
        const l = b.straight ? 1 : 0.3 + 0.7 * Math.sqrt((lens[j] || 0) / (mx || 1));
        cur = [cur[0] + Math.cos(ang) * l, cur[1] + Math.sin(ang) * l];
        SP.push(cur);
      });
    }
    const xs = SP.map((v) => v[0]);
    const ys = SP.map((v) => v[1]);
    const sx0 = Math.min(...xs);
    const sy0 = Math.min(...ys);
    const sw = Math.max(1e-6, Math.max(...xs) - sx0);
    const sh = Math.max(1e-6, Math.max(...ys) - sy0);
    const k = Math.min(bw / sw, sh < 1e-6 ? 1e9 : bh / sh);
    const ox = x0 + 12 + (bw - sw * k) / 2;
    const oy = y0 - 14 - bh + (bh - sh * k) / 2 - (sh < 1e-6 ? -bh / 2 + 4 : 0);
    const P: Point2D[] = SP.map((v) => [mm(ox + (v[0] - sx0) * k), mm(oy + (v[1] - sy0) * k)]);
    E.poly(P, 'REB', { w: 0 });
    for (let j = 1; j < P.length; j++) {
      const qa = P[j - 1];
      const qb = P[j];
      const ddx = qb[0] - qa[0];
      const ddy = qb[1] - qa[1];
      const L = Math.hypot(ddx, ddy);
      if (L < 1e-6 || (lens[j - 1] ?? 0) < 1) continue;
      let ang = (Math.atan2(ddy, ddx) * 180) / Math.PI;
      if (ang > 90.01 || ang <= -89.99) ang += 180;
      const r = (ang * Math.PI) / 180;
      const up: Point2D = [-Math.sin(r), Math.cos(r)];
      const lt =
        b.shape && b.shape.lab && b.shape.lab[j - 1]
          ? b.shape.lab[j - 1]!
          : fmt(Math.round(lens[j - 1] * 10));
      E.text(
        (qa[0] + qb[0]) / 2 + up[0] * mm(1.4),
        (qa[1] + qb[1]) / 2 + up[1] * mm(1.4),
        lt,
        mm(2.2),
        'NOTE',
        { al: 'c', rot: ang },
      );
    }
  });
  return E;
}

export function viewBarTable(
  p: Project,
  res: BarsResult,
  q: QuantitiesResult,
  ctx: CadContext,
): Ents {
  if (isB(p)) return viewBarTableB(p, res, q, ctx);
  const E = new Ents();
  const { mm } = ctx;
  const cols = [14, 80, 13, 26, 15, 22, 15, 26];
  const RH = 8;
  const HH = 12;
  const hdr = [
    ['Số', 'hiệu'],
    ['Tên thanh thép'],
    [p.labelUnit, '(mm)'],
    ['Dài 1 thanh', '(mm)'],
    ['Số', 'lượng'],
    ['Tổng dài', '(m)'],
    ['kg/m'],
    ['Khối lượng', '(kg)'],
  ];
  const LST = barList(res);
  const W = cols.reduce((s, v) => s + v, 0);
  const n = LST.length;
  const H = HH + n * RH + RH;
  const xs = [0];
  cols.forEach((w) => xs.push(xs[xs.length - 1] + w));
  const X = (v: number): number => mm(v);
  const Y = (v: number): number => -mm(v);
  E.text(X(W / 2), Y(-4), 'BẢNG THỐNG KÊ CỐT THÉP', mm(4), 'NOTE', { al: 'c' });
  E.text(X(W / 2), Y(0), `cho 1 đơn nguyên dài ${fmt(p.Lu / 100, 2)} m`, mm(2.4), 'NOTE', {
    al: 'c',
  });
  E.rect(X(0), Y(4), X(W), Y(4 + H), 'TBL');
  const y0 = 4;
  xs.slice(1, -1).forEach((x, i) => E.line(X(x), Y(y0), X(x), Y(y0 + H - (i < 6 ? RH : 0)), 'TBL'));
  E.line(X(0), Y(y0 + HH), X(W), Y(y0 + HH), 'TBL');
  hdr.forEach((ls, i) =>
    ls.forEach((s, j) =>
      E.text(
        X(xs[i] + cols[i] / 2),
        Y(y0 + HH / 2 + (ls.length > 1 ? (j ? 2.6 : -1) : 0.5)),
        s,
        mm(2.2),
        'NOTE',
        { al: 'c', va: 'm', raw: true },
      ),
    ),
  );
  LST.forEach((b, i) => {
    const t0 = y0 + HH + i * RH;
    const yc = t0 + RH / 2;
    E.line(X(0), Y(t0 + RH), X(W), Y(t0 + RH), 'TBL');
    const T = (c: number, s: string | number, al: 'l' | 'c' | 'r' = 'c', raw = false): void => {
      E.text(
        X(al === 'c' ? xs[c] + cols[c] / 2 : al === 'l' ? xs[c] + 1.5 : xs[c + 1] - 1.5),
        Y(yc),
        s,
        mm(2.3),
        'NOTE',
        { al, va: 'm', raw },
      );
    };
    const minL = b.minL ?? 0;
    const maxL = b.maxL ?? minL;
    T(0, b.mark, 'c', isD(p));
    T(1, b.name, 'l');
    T(2, b.d);
    T(3, minL === maxL ? fmt(minL) : `${fmt(minL)}…${fmt(maxL)}`);
    T(4, b.count ?? b.items.length);
    T(5, fmt2(b.totLen ?? 0));
    T(6, fmt2(unitW(b.d)));
    T(7, fmt2(b.kg ?? 0), 'r');
  });
  const yT = y0 + HH + n * RH + RH / 2;
  E.text(X((xs[0] + xs[7]) / 2), Y(yT), 'TỔNG CỘNG', mm(2.6), 'NOTE', { al: 'c', va: 'm' });
  E.text(X(xs[8] - 1.5), Y(yT), fmt2(q.totKg), mm(2.6), 'NOTE', { al: 'r', va: 'm' });
  return E;
}

export function viewSummary(
  p: Project,
  _res: BarsResult,
  q: QuantitiesResult,
  ctx: CadContext,
): Ents {
  const E = new Ents();
  const { mm } = ctx;
  const cols = [36, 36, 44];
  const X = (v: number): number => mm(v);
  const Y = (v: number): number => -mm(v);
  const RH = 7;
  const ds = Object.keys(q.byD)
    .map(Number)
    .sort((a, b) => a - b);
  const rows: string[][] = [
    ['Đường kính', 'Tổng dài (m)', 'Khối lượng (kg)'],
    ...ds.map((d) => [`${p.labelUnit}${d}`, fmt2(q.byD[d].len), fmt2(q.byD[d].kg)]),
    ['Cộng', fmt2(ds.reduce((s, d) => s + q.byD[d].len, 0)), fmt2(q.totKg)],
  ];
  const W = cols.reduce((s, v) => s + v, 0);
  E.text(X(W / 2), Y(-5), 'TỔNG HỢP KHỐI LƯỢNG', mm(4.2), 'NOTE', { al: 'c', bold: true });
  const extra: Array<[string, string, boolean]> = [];
  qtyGroups(p, q).forEach((gr) =>
    gr.rows.forEach((r) =>
      extra.push([
        gr.label.join(' ') + (r[0] ? ' – ' + r[0].toLowerCase() : ''),
        fmt2(r[1]),
        r[0] === 'Cộng',
      ]),
    ),
  );
  extra.push(['Hàm lượng thép (kg/m³)', fmt(q.ratio, 1), false]);
  const tot = (rows.length + extra.length) * RH;
  E.rect(X(0), Y(0), X(W), Y(tot), 'TBL');
  let x = 0;
  cols.slice(0, -1).forEach((w) => {
    x += w;
    E.line(X(x), Y(0), X(x), Y(rows.length * RH), 'TBL');
  });
  rows.forEach((r, i) => {
    E.line(X(0), Y((i + 1) * RH), X(W), Y((i + 1) * RH), 'TBL');
    let xx = 0;
    r.forEach((s, j) => {
      E.text(X(xx + cols[j] / 2), Y(i * RH + RH / 2), s, mm(2.6), 'NOTE', {
        al: 'c',
        va: 'm',
        bold: i === 0 || i === rows.length - 1,
      });
      xx += cols[j];
    });
  });
  extra.forEach((r, i) => {
    const y = (rows.length + i) * RH;
    E.line(X(0), Y(y + RH), X(W), Y(y + RH), 'TBL');
    E.text(X(2), Y(y + RH / 2), r[0], mm(2.6), 'NOTE', { va: 'm', bold: r[2] });
    E.text(X(W - 2), Y(y + RH / 2), r[1], mm(2.6), 'NOTE', { al: 'r', va: 'm', bold: true });
  });
  return E;
}

export function notesFor(p: Project, idx: number, ctx: CadContext): Ents {
  const m = ctx.mm;
  const E = new Ents();
  const U = p.labelUnit;
  let L: string[];
  const rebar = [
    `- Bề dầy lớp bê tông bảo vệ trung bình ${fmt(p.cover)}cm.`,
    `- Thép đường kính ${U}>=10 dùng thép nhóm ${p.steel}.`,
    `- Thép đường kính ${U}<10 dùng thép nhóm CB240-T.`,
    '- Khối lượng chi tiết được diễn dải ở bảng tổng hợp chung.',
  ];
  if (keyOn(p)) rebar.push('- Bản vẽ chi tiết chân khay có bản vẽ riêng.');
  const gA = ancOn(p) ? geom(p).an : null;
  const dA = gA ? (isD(p) ? (p.rb.k1?.d ?? 0) : (p.rb.an?.d ?? 0)) : 0;
  const btA = blindT(p);
  const anMain = gA
    ? `- Neo ${U}${dA} khoan cấy vào nền đá, lưới ${fmt(gA.a * 10)}x${fmt(gA.a * 10)}, dài ${fmt(gA.L * 10)}mm (trong bản đáy ${fmt(gA.Lc * 10)}mm, dưới đáy bản ${fmt(gA.Lb * 10)}mm${btA > 0 ? `, ăn vào đá ${fmt((gA.Lb - btA) * 10)}mm` : ''}).`
    : '';
  const anNote =
    gA && !isD(p) ? [anMain, '- Nền đá có neo: không dùng khóa chống cắt / chân khay.'] : [];
  rebar.push(...anNote);
  const ref = (n: number): string =>
    `- Bản vẽ này xem cùng bản vẽ bố trí chung tường chắn và bản vẽ bố trí thép (${n}).`;

  if (isD(p) && idx === 0) {
    const pv = p.pvc || { d: 60, a: 150 };
    L = [
      '- Kích thước ghi trong bản vẽ là mm.',
      `- Bê tông tường ${p.concrete}${blindT(p) > 0 ? `; bê tông lót M100 dày ${fmt(blindT(p) * 10)}mm (rộng bằng móng)` : ''}.`,
      `- Chiều dài mỗi đơn nguyên ${fmt(p.Lu / 100, 2)}m, khe lún rộng 20mm.`,
      ...(gA ? [anMain] : []),
      `- Ống thoát nước PVC ${U}${pv.d} @${fmt(pv.a / 100, 2)}m/1 ống, dốc 4% ra mặt trước.`,
      '- Đắp sau lưng tường bằng vật liệu dạng hạt, đầm chặt từng lớp.',
    ];
  } else if (isD(p) && idx === 1) {
    L = [
      '- Kích thước ghi trong bản vẽ là mm.',
      ref(2),
      ...rebar,
      ...(gA
        ? [
            `- Thép neo b7 khoan cấy vào đá bằng keo, ăn vào đá ${fmt((gA.Lb - btA) * 10)}mm; vị trí lỗ khoan xem mặt bằng khoan cấy thép ở bản vẽ (2).`,
          ]
        : []),
      '- Lưới 3 (b4a + b6) đặt ở hai mặt đầu đơn nguyên; thép b4 hình chữ U đặt ở hai đầu bản đáy.',
    ];
  } else if (isD(p) && idx === 2) {
    L = [
      '- Kích thước ghi trong bản vẽ là mm.',
      ref(1),
      ...rebar,
      '- Thép b5 là giằng bản đáy, đặt ở phần gót, bước theo hai phương như nhau.',
    ];
  } else if (isB(p) && (idx === 0 || idx === 1)) {
    L = [
      '- Tường chắn đất thiết kế dạng tường chữ T ngược bằng BTCT, dùng cho đường ô tô.',
      '  Tải trọng thiết kế H30-XB80 với các điều kiện sau:',
      '   + Đất đắp sau lưng tường dùng loại có γ=1.8T/m³, φ=35°.',
      '   + Đất nền có cường độ: R>=2.5kg/cm².',
      '- Kích thước ghi trong bản vẽ là mm.',
      `- Bề dầy lớp bê tông bảo vệ trung bình ${fmt(p.cover)}cm, CJ: vết dừng thi công.`,
      ...rebar.slice(1),
      '- Khe phóng lún rộng 10mm.',
    ];
  } else if (idx === 0 && isC(p)) {
    L = [
      '- Kích thước ghi trong bản vẽ là mm.',
      '- Bản vẽ này xem cùng bản vẽ cắt dọc tường chắn và cắt ngang tuyến kè.',
      '- Bản vẽ này được xem với bản vẽ bố trí thép.',
      '- Khối lượng được tính trong bảng tổng hợp chung.',
      ...anNote,
    ];
  } else if (idx === 0) {
    L = [
      '- Kích thước ghi trong bản vẽ là mm.',
      `- Bê tông tường ${p.concrete}${blindT(p) > 0 ? `; bê tông lót M100 dày ${fmt(blindT(p) * 10)}mm (rộng bằng móng)` : ''}.`,
      `- Chiều dài mỗi đơn nguyên ${fmt(p.Lu / 100, 2)}m, khe lún rộng 10mm.`,
      ...anNote,
    ];
  } else if (idx === 1) {
    L = [
      '- Kích thước ghi trong bản vẽ là mm.',
      ref(2),
      ...rebar,
      ...(isC(p)
        ? [
            '- Thanh thép số 5 được tính với khoảng cách trung bình 20cm/thanh, tính từ dưới lên; khi lên trên cao gặp đầu vát',
            '  sẽ được cắt dần chiều dài cho phù hợp với chiều cao của kè.',
            ...(p.rb.c5a && p.rb.c5a.on !== false
              ? ['  Riêng 2 thanh trên cùng số 5A của đỉnh kè phải để là thanh liền.']
              : []),
          ]
        : []),
    ];
  } else if (idx === 2) {
    L = ['- Kích thước ghi trong bản vẽ là mm.', ref(1), ...rebar];
  } else if (idx === 3) {
    L = ['- Kích thước thanh thép và đường kính ghi bằng mm.'];
  } else if (idx === 4) {
    L = [
      `- Khối lượng tính cho 1 đơn nguyên dài ${fmt(p.Lu / 100, 2)}m.`,
      '- Ván khuôn = diện tích mặt bê tông tiếp xúc ván khuôn (mặt đứng, mặt nghiêng của',
      `  ${isC(p) ? 'bản đáy, thân khối kè' : 'móng, thân tường'}${p.type === 'rib' ? ', sườn' : ''}${p.formEnds === false ? '' : ' và 2 mặt đầu đơn nguyên'}).`,
      `  Không tính: đáy móng${keyOn(p) ? ', chân khóa/khay' : ''} (đổ sát đất), đỉnh tường, mặt trên bản đáy`,
      '  và các mặt nghiêng ≤ 30° so với phương ngang.',
    ];
  } else {
    L = [];
  }
  if (!L.length) return E;
  E.text(0, 0, 'Ghi chú:', m(2), 'NOTE');
  L.forEach((s, i) => E.text(m(2), -m(4.2) * (i + 1), s, m(2), 'NOTE', { raw: /^\s{2,}/.test(s) }));
  return E;
}
