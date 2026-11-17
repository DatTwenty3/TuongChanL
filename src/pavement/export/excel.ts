import * as XLSX from 'xlsx';
import {
  BANG8,
  CAP_DUONG_37_OPTIONS,
  CAP_DUONG_38_OPTIONS,
  F_TYPES,
  G_KINDS,
  LOAI_MAT_38_OPTIONS,
  TAV_SLOPE100,
  bang12K2,
  calcRigid,
  fmt,
  fmtExp,
  fmtI,
  type FlexFormState,
  type FlexResolvedInput,
  type FlexTC1Result,
  type FlexTC2Row,
  type FlexTC3Row,
  type RigidInput,
  type RigidResult,
  type RigidTrafficInputs,
  type SavedRigidOption,
  type Sn37LowResult,
  type Sn37NewResult,
  type Sn37OverlayResult,
} from '../engine';

type Cell = XLSX.CellObject;

function cell(v: number | string | undefined, f?: string, z?: string): Cell {
  const c: Cell = f
    ? { t: 'n', f, ...(v !== undefined ? { v: Number(v) } : {}) }
    : typeof v === 'number'
      ? { t: 'n', v }
      : { t: 's', v: v ?? '' };
  if (z) c.z = z;
  return c;
}

function colL(n: number): string {
  let s = '';
  let m = n + 1;
  while (m > 0) {
    const d = (m - 1) % 26;
    s = String.fromCharCode(65 + d) + s;
    m = Math.floor((m - 1) / 26);
  }
  return s;
}

/* ============================ TCCS 39 EXCEL ============================ */

export function buildRigidTinhToanSheet(I: RigidInput, R: RigidResult): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const set = (a: string, c: Cell) => {
    ws[a] = c;
  };
  const T = (a: string, s: string) => set(a, { t: 's', v: s });

  T('A1', 'KIỂM TOÁN KẾT CẤU MẶT ĐƯỜNG BTXM THEO TCCS 39:2022/TCĐBVN');
  T('B2', 'Công trình:');
  T('C2', I.cap);
  T('B5', 'I. SỐ LIỆU ĐẦU VÀO');
  T('B6', 'Thông số');
  T('C6', 'Giá trị');
  T('D6', 'Đơn vị');
  T('E6', 'Ghi chú / Điều');

  const inp: Array<[string, string, string, string | number, string, string, string, string]> = [
    ['B7', 'Cấp hạng đường', 'C7', I.cap, 'D7', '', 'E7', 'Bảng 9'],
    ['B8', 'Mô hình tính (1: Đ8.3 ; 2: Đ8.4)', 'C8', I.model, 'D8', '', 'E8', 'Điều 8.2.1'],
    ['B9', 'Lớp cách ly BTN (0/1)', 'C9', I.caly, 'D9', '', 'E9', 'Điều 8.4.5'],
    ['B10', 'hc – Chiều dày tấm BTXM', 'C10', I.hc, 'D10', 'm', 'E10', ''],
    ['B11', 'L – Chiều dài tấm', 'C11', I.L, 'D11', 'm', 'E11', 'Điều 5.1.1'],
    ['B12', 'B – Chiều rộng tấm', 'C12', I.B, 'D12', 'm', 'E12', ''],
    ['B13', 'fr – Cường độ kéo uốn TK', 'C13', I.fr, 'D13', 'MPa', 'E13', 'Điều 8.2.3'],
    ['B14', 'Ec – Mô đun đàn hồi BTXM', 'C14', I.Ec, 'D14', 'MPa', 'E14', 'Bảng 11'],
    ['B15', 'μc – Poisson BTXM', 'C15', I.muc, 'D15', '', 'E15', ''],
    ['B16', 'αc – Hệ số dãn nở nhiệt', 'C16', I.ac, 'D16', '1/°C', 'E16', 'Bảng 10'],
    ['B17', 'Tg – Gradien nhiệt lớn nhất', 'C17', I.Tg, 'D17', '°C/m', 'E17', 'Điều 8.2.8'],
    ['B18', 'Ps – Trục tính mỏi', 'C18', I.Ps, 'D18', 'kN', 'E18', 'Điều 8.2.6'],
    ['B19', 'Pmax – Trục nặng nhất', 'C19', I.Pmax, 'D19', 'kN', 'E19', 'Điều 8.2.7'],
    ['B20', 'Ne – Số trục tích lũy', 'C20', I.Ne, 'D20', 'lần', 'E20', 'Phụ lục A'],
    ['B21', 'kr – Triết giảm US', 'C21', I.kr, 'D21', '', 'E21', 'Điều 8.3.1'],
    ['B22', 'kc – Tổng hợp động', 'C22', I.kc, 'D22', '', 'E22', 'Điều 8.3.1'],
    ['B23', 'γr – Độ tin cậy', 'C23', I.gr, 'D23', '', 'E23', 'Bảng 9'],
    ['B24', 'E0 – Mô đun nền đất', 'C24', I.E0, 'D24', 'MPa', 'E24', 'PL B TCCS 38'],
    ['B26', `Eb – Mô đun móng bó (${I.matBound})`, 'C26', I.Eb, 'D26', 'MPa', 'E26', ''],
    ['B27', 'hb – Chiều dày móng bó', 'C27', I.hb, 'D27', 'm', 'E27', ''],
    ['B28', 'μb – Poisson móng bó', 'C28', I.mub, 'D28', '', 'E28', ''],
    ['B29', 'fbr – CĐ kéo uốn móng bó', 'C29', I.fbr, 'D29', 'MPa', 'E29', 'Bảng 3'],
  ];
  inp.forEach((r) => {
    T(r[0], r[1]);
    set(r[2], typeof r[3] === 'number' ? { t: 'n', v: r[3] } : { t: 's', v: r[3] });
    T(r[4], r[5]);
    T(r[6], r[7]);
  });

  T('G31', 'Lớp móng hạt');
  T('H31', 'E (MPa)');
  T('I31', 'h (m)');
  for (let s = 0; s < 5; s++) {
    const l = I.layers[s];
    const rr = 32 + s;
    T('G' + rr, l ? l.name || `Lớp hạt ${s + 1}` : '');
    set('H' + rr, { t: 'n', v: l ? +l.E || 0 : 0 });
    set('I' + rr, { t: 'n', v: l ? +l.h || 0 : 0 });
  }

  T('B35', 'II. MÔ ĐUN NỀN TƯƠNG ĐƯƠNG Et (Điều 8.3.2)');
  const F: Array<[string, string, string, string, number, string, string, string, string]> = [
    [
      'B36',
      'Ex – Mô đun lớp hạt tương đương',
      'C36',
      'IF(SUMPRODUCT(I32:I36,I32:I36)=0,0,SUMPRODUCT(I32:I36,I32:I36,H32:H36)/SUMPRODUCT(I32:I36,I32:I36))',
      R.Ex,
      'D36',
      'MPa',
      'E36',
      '(13)',
    ],
    ['B37', 'hx – Tổng bề dày lớp hạt', 'C37', 'SUM(I32:I36)', R.hx, 'D37', 'm', 'E37', '(15)'],
    ['B38', 'α – Hệ số hồi quy', 'C38', 'IF(C37=0,0,0.86+0.26*LN(C37))', R.alpha, 'D38', '', 'E38', '(14)'],
    ['B39', 'Et – Mô đun nền tương đương', 'C39', 'IF(C37=0,C24,(C36/C24)^C38*C24)', R.Et, 'D39', 'MPa', 'E39', '(12)'],
    ['B40', 'III. ĐỘ CỨNG & BÁN KÍNH ĐỘ CỨNG', '', '', 0, '', '', '', ''],
    ['B41', 'Dc – Độ cứng chịu uốn tấm', 'C41', 'C14*C10^3/(12*(1-C15^2))', R.Dc, 'D41', 'MN.m', 'E41', '(11)'],
    [
      'B42',
      'Db – Độ cứng chịu uốn móng bó',
      'C42',
      'IF(C26=0,0,C26*C27^3/(12*(1-C28^2)))',
      R.Db,
      'D42',
      'MN.m',
      'E42',
      '(25)',
    ],
    ['B43', 'r – Bán kính độ cứng (MH1)', 'C43', '1.21*(C41/C39)^(1/3)', R.r, 'D43', 'm', 'E43', '(11)'],
    ['B44', 'rg – Bán kính độ cứng (MH2)', 'C44', '1.21*((C41+C42)/C39)^(1/3)', R.rg, 'D44', 'm', 'E44', '(25)'],
    ['B45', 'R – Bán kính áp dụng', 'C45', 'IF(C8=1,C43,C44)', R.R, 'D45', 'm', 'E45', ''],
    ['B46', 'IV. ỨNG SUẤT DO TẢI TRỌNG XE', '', '', 0, '', '', '', ''],
    ['B47', 'kf – Hệ số mỏi mặt', 'C47', 'C20^0.057', R.kf, 'D47', '', 'E47', '(16)'],
    ['B48', 'σps (Ps) – MH1', 'C48', '1.47E-3*C43^0.7*C10^-2*C18^0.94', R.sps1, 'D48', 'MPa', 'E48', '(11)'],
    ['B49', 'σpm (Pmax) – MH1', 'C49', '1.47E-3*C43^0.7*C10^-2*C19^0.94', R.spm1, 'D49', 'MPa', 'E49', '(11)'],
    [
      'B50',
      'σps (Ps) – MH2',
      'C50',
      '1.45E-3/(1+C42/C41)*C44^0.65*C10^-2*C18^0.94',
      R.sps2,
      'D50',
      'MPa',
      'E50',
      '(25)',
    ],
    [
      'B51',
      'σpm (Pmax) – MH2',
      'C51',
      '1.45E-3/(1+C42/C41)*C44^0.65*C10^-2*C19^0.94',
      R.spm2,
      'D51',
      'MPa',
      'E51',
      '(25)',
    ],
    ['B52', 'σps – áp dụng', 'C52', 'IF(C8=1,C48,C50)', R.sps, 'D52', 'MPa', 'E52', ''],
    ['B53', 'σpm – áp dụng', 'C53', 'IF(C8=1,C49,C51)', R.spm, 'D53', 'MPa', 'E53', ''],
    ['B54', 'σpr – US kéo uốn mỏi do tải', 'C54', 'C21*C47*C22*C52', R.spr, 'D54', 'MPa', 'E54', '(10)'],
    ['B55', 'σpmax – US do trục nặng nhất', 'C55', 'C21*C22*C53', R.spmax, 'D55', 'MPa', 'E55', '(20)'],
    ['B56', 'V. ỨNG SUẤT DO GRADIEN NHIỆT', '', '', 0, '', '', '', ''],
    ['B57', 't – Thông số nhiệt', 'C57', 'C11/(3*C45)', R.t, 'D57', '', 'E57', '(23/28)'],
    [
      'B58',
      'CL – Uốn vồng (MH1)',
      'C58',
      '1-(SINH(C57)*COS(C57)+COSH(C57)*SIN(C57))/(COS(C57)*SIN(C57)+SINH(C57)*COSH(C57))',
      R.CL1,
      'D58',
      '',
      'E58',
      '(23)',
    ],
    [
      'B59',
      'kn – Độ cứng tiếp xúc',
      'C59',
      'IF(C26=0,3000,IF(C9=1,3000,0.5*(C10/C14+C27/C26)^-1))',
      R.kn,
      'D59',
      'MPa/m',
      'E59',
      '(28)',
    ],
    ['B60', 'rβ – Bán kính tiếp xúc', 'C60', 'IF(C42=0,0,((C41*C42)/((C41+C42)*C59))^0.25)', R.rb, 'D60', 'm', 'E60', '(28)'],
    [
      'B61',
      'ζ – Hệ số kết cấu 2 lớp',
      'C61',
      'IF(C42=0,0,-((C59*C44^4-C41)*C60^3)/((C59*C60^4-C41)*C44^3))',
      R.zeta,
      'D61',
      '',
      'E61',
      '(28)',
    ],
    [
      'B62',
      'CL – Uốn vồng (MH2)',
      'C62',
      '1-(1/(1+C61))*(SINH(C57)*COS(C57)+COSH(C57)*SIN(C57))/(COS(C57)*SIN(C57)+SINH(C57)*COSH(C57))',
      R.CL2,
      'D62',
      '',
      'E62',
      '(28)',
    ],
    ['B63', 'CL – áp dụng', 'C63', 'IF(C8=1,C58,C62)', R.CL, 'D63', '', 'E63', ''],
    ['B64', 'BL – Hệ số US nhiệt tổng hợp', 'C64', '1.77*EXP(-4.48*C10)*C63-0.131*(1-C63)', R.BL, 'D64', '', 'E64', '(23)'],
    ['B65', 'σtmax – US nhiệt lớn nhất', 'C65', 'C16*C10*C14*C17/2*C64', R.stmax, 'D65', 'MPa', 'E65', '(22)'],
    ['B66', 'kt bộ 1', 'C66', '(C13/C65)*(0.841*(C65/C13)^1.323-0.058)', R.kt1, 'D66', '', 'E66', '(24)'],
    ['B67', 'kt bộ 2', 'C67', '(C13/C65)*(0.871*(C65/C13)^1.287-0.071)', R.kt2, 'D67', '', 'E67', '(24)'],
    ['B68', 'kt = max', 'C68', 'MAX(C66,C67)', R.kt, 'D68', '', 'E68', '(24)'],
    ['B69', 'σtr – US nhiệt gây mỏi', 'C69', 'C68*C65', R.str, 'D69', 'MPa', 'E69', '(21)'],
    ['B70', 'VI. ỨNG SUẤT ĐÁY MÓNG BÓ (MH2)', '', '', 0, '', '', '', ''],
    [
      'B71',
      'σbps – US đáy móng do Ps',
      'C71',
      'IF(C42=0,0,1.41E-3/(1+C41/C42)*C44^0.68*C27^-2*C18^0.94)',
      R.sbps,
      'D71',
      'MPa',
      'E71',
      '(27)',
    ],
    ['B72', 'σbpr – US mỏi đáy móng bó', 'C72', 'IF(C42=0,0,C20^0.065*C22*C71)', R.sbpr, 'D72', 'MPa', 'E72', '(26)'],
  ];

  F.forEach((r) => {
    T(r[0], r[1]);
    if (r[3]) {
      set(r[2], cell(r[4], r[3]));
      T(r[5], r[6]);
      T(r[7], r[8]);
    }
  });

  T('B73', 'VII. KIỂM TOÁN TRẠNG THÁI GIỚI HẠN');
  T('B74', 'Điều kiện');
  T('C74', 'Vế trái');
  T('D74', 'Vế phải');
  T('E74', 'Kết luận');
  T('B75', '(6)/(8-1): γr(σpr+σtr) ≤ fr');
  set('C75', cell(R.c1, 'C23*(C54+C69)'));
  set('D75', cell(I.fr, 'C13'));
  set('E75', { t: 's', f: 'IF(C75<=D75,"ĐẠT","KHÔNG ĐẠT")', v: R.p1 ? 'ĐẠT' : 'KHÔNG ĐẠT' });
  T('B76', '(7)/(8-2): γr(σpmax+σtmax) ≤ fr');
  set('C76', cell(R.c2, 'C23*(C55+C65)'));
  set('D76', cell(I.fr, 'C13'));
  set('E76', { t: 's', f: 'IF(C76<=D76,"ĐẠT","KHÔNG ĐẠT")', v: R.p2 ? 'ĐẠT' : 'KHÔNG ĐẠT' });
  T('B77', '(8)/(8-3): γr·σbpr ≤ fbr');
  set('C77', cell(R.c3, 'C23*C72'));
  set('D77', cell(I.fbr, 'C29'));
  set('E77', {
    t: 's',
    f: 'IF(OR(C8=1,C42=0,C29=0),"Không áp dụng",IF(C77<=D77,"ĐẠT","KHÔNG ĐẠT"))',
    v: R.app3 ? (R.p3 ? 'ĐẠT' : 'KHÔNG ĐẠT') : 'Không áp dụng',
  });
  T('B78', 'KẾT LUẬN CHUNG');
  set('E78', {
    t: 's',
    f: 'IF(AND(C75<=D75,C76<=D76,OR(C8=1,C42=0,C29=0,C77<=D77)),"ĐẠT YÊU CẦU","KHÔNG ĐẠT")',
    v: R.p1 && R.p2 && R.p3 ? 'ĐẠT YÊU CẦU' : 'KHÔNG ĐẠT',
  });

  ws['!ref'] = 'A1:I78';
  ws['!cols'] = [
    { wch: 5 },
    { wch: 44 },
    { wch: 16 },
    { wch: 9 },
    { wch: 18 },
    { wch: 2 },
    { wch: 22 },
    { wch: 10 },
    { wch: 8 },
  ];
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
  return ws;
}

export function buildRigidThuyetMinhSheet(): XLSX.WorkSheet {
  const aoa: Array<Array<string | number>> = [
    ['THUYẾT MINH & CÔNG THỨC – TCCS 39:2022/TCĐBVN'],
    [''],
    ['TT', 'Đại lượng', 'Công thức', 'Biểu thức'],
  ];
  const F: Array<[string, string, string, string]> = [
    ['Ex', 'Mô đun lớp hạt tương đương', 'Ex = Σ(hi²·Ei)/Σ(hi²)', '(13)'],
    ['hx', 'Tổng bề dày lớp hạt', 'hx = Σhi', '(15)'],
    ['α', 'Hệ số hồi quy', 'α = 0,86 + 0,26·ln(hx)', '(14)'],
    ['Et', 'Mô đun nền tương đương', 'Et = (Ex/E0)^α·E0', '(12)'],
    ['Dc', 'Độ cứng chịu uốn tấm', 'Dc = Ec·hc³/[12(1-μc²)]', '(11)'],
    ['Db', 'Độ cứng chịu uốn móng bó', 'Db = Eb·hb³/[12(1-μb²)]', '(25)'],
    ['r', 'Bán kính độ cứng (MH1)', 'r = 1,21·(Dc/Et)^(1/3)', '(11)'],
    ['rg', 'Bán kính độ cứng (MH2)', 'rg = 1,21·[(Dc+Db)/Et]^(1/3)', '(25)'],
    ['kf', 'Hệ số mỏi', 'kf = Ne^0,057 (móng bó: Ne^0,065)', '(16)'],
    ['σps', 'US tải trọng – MH1', 'σps = 1,47e-3·r^0,70·hc^-2·P^0,94', '(11)'],
    ['σps', 'US tải trọng – MH2', 'σps = [1,45e-3/(1+Db/Dc)]·rg^0,65·hc^-2·P^0,94', '(25)'],
    ['σpr', 'US kéo uốn mỏi do tải', 'σpr = kr·kf·kc·σps', '(10)'],
    ['σpmax', 'US do trục nặng nhất', 'σpmax = kr·kc·σpm', '(20)'],
    ['t', 'Thông số nhiệt', 't = L/(3r) [MH2: L/(3rg)]', '(23/28)'],
    ['kn', 'Độ cứng tiếp xúc (MH2)', 'kn = ½·(hc/Ec+hb/Eb)^-1 ; =3000 nếu có cách ly', '(28)'],
    ['rβ', 'Bán kính tiếp xúc (MH2)', 'rβ = [Dc·Db/((Dc+Db)·kn)]^(1/4)', '(28)'],
    ['ζ', 'Hệ số kết cấu 2 lớp', 'ζ = -[(kn·rg⁴-Dc)·rβ³]/[(kn·rβ⁴-Dc)·rg³]', '(28)'],
    ['CL', 'Hệ số uốn vồng', 'CL = 1-[1/(1+ζ)]·(Sh·cost+Ch·sint)/(cost·sint+Sh·Ch)', '(23/28)'],
    ['BL', 'Hệ số US nhiệt tổng hợp', 'BL = 1,77·e^(-4,48hc)·CL - 0,131(1-CL)', '(23)'],
    ['σtmax', 'US nhiệt lớn nhất', 'σtmax = αc·hc·Ec·Tg/2·BL', '(22)'],
    ['kt', 'Hệ số mỏi nhiệt', 'kt = (fr/σtmax)[at(σtmax/fr)^bt - ct] (max 2 bộ)', '(24)'],
    ['σtr', 'US nhiệt gây mỏi', 'σtr = kt·σtmax', '(21)'],
    ['σbps', 'US đáy móng bó (MH2)', 'σbps = [1,41e-3/(1+Dc/Db)]·rg^0,68·hb^-2·Ps^0,94', '(27)'],
    ['σbpr', 'US mỏi đáy móng bó', 'σbpr = kf·kc·σbps (kf = Ne^0,065)', '(26)'],
  ];
  F.forEach((f, i) => aoa.push([i + 1, `${f[0]} – ${f[1]}`, f[2], f[3]]));
  aoa.push(
    [''],
    ['Trạng thái giới hạn:'],
    ['(6)/(8-1): γr(σpr+σtr) ≤ fr'],
    ['(7)/(8-2): γr(σpmax+σtmax) ≤ fr'],
    ['(8)/(8-3): γr·σbpr ≤ fbr (chỉ MH2, móng BT nghèo/đầm lăn)'],
  );
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 8 }, { wch: 40 }, { wch: 52 }, { wch: 10 }];
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
  return ws;
}

export function buildRigidNeSheet(tr: RigidTrafficInputs, PsInput: number): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const S = (a: string, v: string) => {
    ws[a] = { t: 's', v };
  };
  const N = (a: string, v: number) => {
    ws[a] = { t: 'n', v };
  };
  const Fm = (a: string, f: string, v: number) => {
    ws[a] = { t: 'n', f, v };
  };
  const Ps = PsInput || 100;
  const grw = tr.grow / 100;
  S('A1', 'XÁC ĐỊNH SỐ TRỤC XE TÍCH LŨY Ne – PHỤ LỤC A, TCCS 39:2022');
  S('A3', 'ADTT – xe nặng 2 chiều, năm đầu');
  N('B3', tr.adtt);
  S('C3', 'xe/ng');
  S('A4', 'f_hướng (phân phối chiều)');
  N('B4', tr.fhuong);
  S('C4', '0,5–0,6');
  S('A5', 'f_làn (phân phối làn)');
  N('B5', tr.flan);
  S('C5', 'Bảng A.1');
  S('A6', 'n – số trục đơn / 3000 xe điều tra');
  N('B6', tr.naxle);
  S('C6', 'trục');
  S('A7', 'gr – suất tăng trưởng năm');
  N('B7', grw);
  S('C7', 'thập phân');
  S('A8', 't – thời hạn phục vụ');
  N('B8', tr.tyear);
  S('C8', 'năm');
  S('A9', 'η – hệ số phân bố ngang');
  N('B9', tr.eta);
  S('C9', 'Bảng A.2');
  S('A10', 'Ps – tải trọng trục tính mỏi');
  N('B10', Ps);
  S('C10', 'kN');
  S('A12', 'ADTT_làn = ADTT·f_hướng·f_làn');
  Fm('B12', 'B3*B4*B5', tr.adtt * tr.fhuong * tr.flan);
  S('C12', 'xe/ng·làn');
  S('A14', 'Pi (kN)');
  S('B14', 'pi (%)');
  S('C14', 'kni=(Pi/Ps)^16');
  S('D14', 'kni·pi/100');

  let last = 14;
  tr.spec.forEach((s, i) => {
    const r = 15 + i;
    last = r;
    N('A' + r, s.P);
    N('B' + r, s.p);
    Fm('C' + r, `(A${r}/$B$10)^16`, Math.pow(s.P / Ps, 16));
    Fm('D' + r, `C${r}*B${r}/100`, (Math.pow(s.P / Ps, 16) * s.p) / 100);
  });
  const sumv = tr.spec.reduce((a, s) => a + (Math.pow(s.P / Ps, 16) * s.p) / 100, 0);
  const adttlan = tr.adtt * tr.fhuong * tr.flan;
  const Ns1 = adttlan * (tr.naxle / 3000) * sumv;
  const Ne = grw > 0 ? Ns1 * 365 * ((Math.pow(1 + grw, tr.tyear) - 1) / grw) * tr.eta : Ns1 * 365 * tr.tyear * tr.eta;
  const sr = last + 1;
  S('A' + sr, 'Σ(kni·pi)');
  Fm('D' + sr, `SUM(D15:D${last})`, sumv);
  const r1 = sr + 2;
  S('A' + r1, 'Ns¹ = ADTT_làn·(n/3000)·Σ');
  Fm('B' + r1, `B12*(B6/3000)*D${sr}`, Ns1);
  S('C' + r1, 'trục/ng·làn');
  const r2 = r1 + 1;
  S('A' + r2, 'Ne = Ns¹·365·[(1+gr)^t−1]/gr·η');
  Fm('B' + r2, `B${r1}*365*((1+B7)^B8-1)/B7*B9`, Ne);
  S('C' + r2, 'lần');
  ws['!ref'] = 'A1:D' + (r2 + 1);
  ws['!cols'] = [{ wch: 36 }, { wch: 16 }, { wch: 14 }, { wch: 14 }];
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
  return ws;
}

export function buildRigidSweepSheet(I: RigidInput): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const S = (a: string, v: string) => {
    ws[a] = { t: 's', v };
  };
  const N = (a: string, v: number, z?: string) => {
    ws[a] = { t: 'n', v, z: z || '0.000' };
  };
  S('A1', 'DÒ CHIỀU DÀY TẤM BTXM (giữ nguyên thông số khác) – tính tại thời điểm xuất');
  ['A3:hc (cm)', 'B3:σpr', 'C3:σpmax', 'D3:σtr', 'E3:σtmax', 'F3:(8-1)', 'G3:(8-2)', 'H3:Kết luận'].forEach((x) => {
    const [a, v] = x.split(':');
    S(a, v);
  });
  let r = 4;
  let minH: number | null = null;
  for (let h = 0.16; h <= 0.341; h += 0.01) {
    const hc = Math.round(h * 100) / 100;
    const R = calcRigid({ ...I, hc });
    N('A' + r, hc * 100, '0.0');
    N('B' + r, R.spr);
    N('C' + r, R.spmax);
    N('D' + r, R.str);
    N('E' + r, R.stmax);
    N('F' + r, R.c1);
    N('G' + r, R.c2);
    const ok = R.p1 && R.p2 && R.p3;
    S('H' + r, ok ? 'ĐẠT' : 'KHÔNG ĐẠT');
    if (ok && minH === null) minH = hc;
    r++;
  }
  S('A' + (r + 1), '→ Chiều dày tấm tối thiểu đạt yêu cầu:');
  S('C' + (r + 1), minH ? `${fmt(minH * 100, 1)} cm` : '> 34 cm');
  ws['!ref'] = 'A1:H' + (r + 1);
  ws['!cols'] = [{ wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 13 }];
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];
  return ws;
}

export function buildRigidCompareSheet(options: SavedRigidOption[]): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const S = (a: string, v: string) => {
    ws[a] = { t: 's', v };
  };
  const N = (a: string, v: number) => {
    ws[a] = { t: 'n', v, z: '0.000' };
  };
  S('A1', 'SO SÁNH CÁC PHƯƠNG ÁN');
  const L: Array<[string, (o: SavedRigidOption) => string | number]> = [
    ['Tên', (o) => o.name],
    ['Mô hình', (o) => `MH${o.state.input.model}`],
    ['hc (cm)', (o) => o.state.input.hc * 100],
    ['fr (MPa)', (o) => o.state.input.fr],
    ['Ec (MPa)', (o) => o.state.input.Ec],
    ['Eb (MPa)', (o) => o.state.input.Eb],
    ['Ne', (o) => o.state.input.Ne],
    ['σpr', (o) => o.result.spr],
    ['σpmax', (o) => o.result.spmax],
    ['σtmax', (o) => o.result.stmax],
    ['(8-1)', (o) => o.result.c1],
    ['(8-2)', (o) => o.result.c2],
    ['Kết luận', (o) => (o.result.p1 && o.result.p2 && o.result.p3 ? 'ĐẠT' : 'KHÔNG ĐẠT')],
  ];
  const col = (i: number) => String.fromCharCode(66 + i);
  L.forEach((row, ri) => {
    const r = ri + 3;
    S('A' + r, row[0]);
    options.forEach((o, ci) => {
      const v = row[1](o);
      const a = col(ci) + r;
      if (typeof v === 'number') N(a, v);
      else S(a, v);
    });
  });
  ws['!ref'] = 'A1:' + col(options.length - 1) + (L.length + 3);
  ws['!cols'] = [{ wch: 14 }].concat(options.map(() => ({ wch: 15 })));
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(1, options.length) } }];
  return ws;
}

export function buildRigidWorkbook(
  I: RigidInput,
  R: RigidResult,
  traffic: RigidTrafficInputs,
  options: SavedRigidOption[],
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildRigidThuyetMinhSheet(), 'Thuyết minh');
  XLSX.utils.book_append_sheet(wb, buildRigidTinhToanSheet(I, R), 'Tính toán');
  XLSX.utils.book_append_sheet(wb, buildRigidNeSheet(traffic, I.Ps), 'Ne (Phụ lục A)');
  XLSX.utils.book_append_sheet(wb, buildRigidSweepSheet(I), 'Dò chiều dày');
  if (options.length) {
    XLSX.utils.book_append_sheet(wb, buildRigidCompareSheet(options), 'So sánh PA');
  }
  return wb;
}

/* ============================ TCCS 38 EXCEL ============================ */

function betaFormula(hd: string, nGtOne: boolean): string {
  if (!nGtOne) return '1';
  return `IF(${hd}<=0.5,1.033,IF(${hd}>=2,1.114*${hd}^0.12,IF(${hd}<=0.75,1.033+(${hd}-0.5)/0.25*(1.069-1.033),IF(${hd}<=1,1.069+(${hd}-0.75)/0.25*(1.107-1.069),IF(${hd}<=1.25,1.107+(${hd}-1)/0.25*(1.136-1.107),IF(${hd}<=1.5,1.136+(${hd}-1.25)/0.25*(1.178-1.136),IF(${hd}<=1.75,1.178+(${hd}-1.5)/0.25*(1.198-1.178),1.198+(${hd}-1.75)/0.25*(1.210-1.198))))))))`;
}

function echFormula(E0: string, E1: string, H: string, D: string): string {
  return `1.05*${E0}/((1+${E0}/${E1})/SQRT(1+4*(${H}/${D})^2*(${E0}/${E1})^-0.67)+${E0}/${E1})`;
}

function skuMatFormula(h1: string, E1: string, Echm: string, D: string): string {
  const htd = `(1.1*${h1}*(${E1}/${Echm})^(1/3))`;
  return `(4/PI())*(${h1}/${D})*(${E1}/${Echm})*(1-(2/PI())*ATAN(${htd}/${D}))*ATAN(${D}/${htd})^2`;
}

function skuMongFormula(E1: string, E2: string, E3: string, h: string, D: string): string {
  return `(1.29*(${E1}/${E2})^-0.185*(${D}/${h})-0.203*(${E2}/${E1})-0.283)/(9.3*(${E3}/${E2})+0.83)`;
}

function tavSlopeFormula(phiRef: string): string {
  const T = TAV_SLOPE100;
  let f = `${T[T.length - 1].s}`;
  for (let i = T.length - 2; i >= 0; i--) {
    f = `IF(${phiRef}<=${T[i + 1].phi},${T[i].s}+(${phiRef}-${T[i].phi})/${T[i + 1].phi - T[i].phi}*${T[i + 1].s - T[i].s},${f})`;
  }
  return `IF(${phiRef}<=${T[0].phi},${T[0].s},${f})`;
}

function tavFormula(phiRef: string, hRef: string): string {
  return `(${tavSlopeFormula(phiRef)})/100*${hRef}`;
}

function writeOdemarkChain(
  set: (a: string, c: Cell) => void,
  S: (a: string, v: string) => void,
  col0: number,
  row0: number,
  rowsBU: Array<{ hRef: string; ERef: string }>,
  label: string,
) {
  const cH = colL(col0);
  const cE = colL(col0 + 1);
  const cK = colL(col0 + 2);
  const cT = colL(col0 + 3);
  const cHc = colL(col0 + 4);
  const cEc = colL(col0 + 5);
  S(colL(col0 - 1) + row0, label);
  let r = row0;
  rowsBU.forEach((L, i) => {
    set(cH + r, cell(undefined, L.hRef));
    set(cE + r, cell(undefined, L.ERef));
    if (i === 0) {
      set(cHc + r, cell(undefined, `${cH}${r}`));
      set(cEc + r, cell(undefined, `${cE}${r}`));
      S(cK + r, '');
      S(cT + r, '');
    } else {
      const pr = r - 1;
      set(cK + r, cell(undefined, `${cH}${r}/${cHc}${pr}`));
      set(cT + r, cell(undefined, `${cE}${r}/${cEc}${pr}`));
      set(cHc + r, cell(undefined, `${cHc}${pr}+${cH}${r}`));
      set(cEc + r, cell(undefined, `${cEc}${pr}*((1+${cK}${r}*${cT}${r}^(1/3))/(1+${cK}${r}))^3`));
    }
    r++;
  });
  const rEnd = r - 1;
  return { Href: `${cHc}${rEnd}`, Etbref: `${cEc}${rEnd}`, lastRow: rEnd, n: rowsBU.length };
}

interface FlexTrafficSheetRefs {
  ws: XLSX.WorkSheet;
  rNtk: number;
  rNtt: number;
  rNe10: number;
  rNe15: number;
  rNeMain: number;
}

export function buildFlexTrafficSheet(state: FlexFormState): FlexTrafficSheetRefs {
  const ws: XLSX.WorkSheet = {};
  const set = (a: string, c: Cell) => {
    ws[a] = c;
  };
  const S = (a: string, v: string) => set(a, { t: 's', v });
  S('A1', 'XÁC ĐỊNH LƯU LƯỢNG TRỤC XE TÍNH TOÁN – PHỤ LỤC A, TCCS 38:2022');
  S('A3', 'Trục tiêu chuẩn Ptt (kN)');
  set('B3', cell(state.Ptt));
  S('A5', 'Loại xe');
  S('B5', 'Pt (kN)');
  S('C5', 'Ps (kN)');
  S('D5', 'ms');
  S('E5', 'C2 sau');
  S('F5', 'K/c cụm (m)');
  S('G5', 'ni');
  S('H5', 'Đóng góp N (trục tc/ngđ)');
  let r = 6;
  state.vehicles.forEach((v) => {
    S('A' + r, v.name);
    set('B' + r, cell(v.Pt));
    set('C' + r, cell(v.Ps));
    set('D' + r, cell(v.ms));
    set('E' + r, cell(v.banh === '4banh' ? 0.38 : 1.0));
    set('F' + r, cell(v.spacing));
    set('G' + r, cell(v.ni));
    const f = `IF(B${r}>=25,1*6.4*G${r}*(B${r}/$B$3)^4.4,0)+IF(C${r}>=25,IF(AND(D${r}>1,F${r}>3),D${r}*(1*E${r}*G${r}*(C${r}/$B$3)^4.4),(1+1.2*(D${r}-1))*E${r}*G${r}*(C${r}/$B$3)^4.4),0)`;
    set('H' + r, cell(undefined, f));
    r++;
  });
  const lastVeh = r - 1;
  S('A' + r, 'Ntk – tổng trục tiêu chuẩn/ngày đêm (2 chiều)');
  set('B' + r, cell(undefined, `SUM(H6:H${lastVeh})`));
  const rNtk = r;
  r += 2;
  S('A' + r, 'fL – hệ số phân bố làn');
  set('B' + r, cell(state.fL || 0.55));
  const rfL = r;
  r++;
  S('A' + r, 'Ntt = Ntk·fL (trục/ngày đêm/làn – dùng tra Bảng 9)');
  set('B' + r, cell(undefined, `B${rNtk}*B${rfL}`));
  const rNtt = r;
  r += 2;
  S('A' + r, 'q – tăng trưởng xe hàng năm');
  set('B' + r, cell(state.q / 100));
  const rq = r;
  r++;

  let rNe10 = r;
  let rNe15 = r;
  let rNeMain = r;
  const specs: Array<[string, number]> = [
    ['Ne (t=10 năm, k1 BTN loại II)', 10],
    ['Ne (t=15 năm, k1 BTN loại I/polime)', 15],
    ['Ne (t chính, dùng cho lớp gia cố vô cơ & Bảng 9→Ne tổng)', state.t],
  ];
  specs.forEach(([lab, tt], idx) => {
    S('A' + r, lab);
    set('B' + r, cell(tt));
    const f =
      state.ntkloai === 'dau'
        ? `IF(B${rq}<=0,B${rNtt}*365*B${r},B${rNtt}*365*((1+B${rq})^B${r}-1)/B${rq})`
        : `IF(B${rq}<=0,B${rNtt}*365*B${r},B${rNtt}*365*((1+B${rq})^B${r}-1)/(B${rq}*(1+B${rq})^(B${r}-1)))`;
    set('C' + r, cell(undefined, f));
    if (idx === 0) rNe10 = r;
    if (idx === 1) rNe15 = r;
    if (idx === 2) rNeMain = r;
    r++;
  });

  ws['!ref'] = 'A1:H' + r;
  ws['!cols'] = [{ wch: 40 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 16 }];
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];
  return { ws, rNtk, rNtt, rNe10, rNe15, rNeMain };
}

export function buildFlexTinhToanSheet(
  I: FlexResolvedInput,
  tc1: FlexTC1Result,
  refs: Omit<FlexTrafficSheetRefs, 'ws'>,
): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const set = (a: string, c: Cell) => {
    ws[a] = c;
  };
  const S = (a: string, v: string) => set(a, { t: 's', v });
  const capLabel = CAP_DUONG_38_OPTIONS.find((o) => o.value === I.capDuong)?.label || I.capDuong;

  S('A1', 'KIỂM TOÁN KẾT CẤU ÁO ĐƯỜNG MỀM THEO TCCS 38:2022/TCĐBVN');
  S('B3', 'Cấp đường');
  S('C3', capLabel);
  S('B4', 'Loại tầng mặt');
  S('C4', I.loaiMat);
  S('B5', 'Độ tin cậy thiết kế');
  set('C5', cell(parseFloat(I.dotincay)));
  S('B6', 'Ptt (kN)');
  set('C6', cell(I.traf.Ptt));
  S('B7', 'D (cm)');
  set('C7', cell(undefined, 'IF(C6>=120,36,33)'));
  S('B8', 'p (MPa)');
  set('C8', cell(I.p));

  S('E3', 'Bảng 8');
  S('E4', 'Độ tin cậy');
  S('F4', 'Kcd_dv');
  S('G4', 'Kcd_kutr');
  const B8T = [
    [0.98, 1.29, 1.1],
    [0.95, 1.17, 1.0],
    [0.9, 1.1, 0.94],
    [0.85, 1.06, 0.9],
    [0.8, 1.02, 0.87],
  ];
  B8T.forEach((row, i) => {
    const rr = 5 + i;
    set('E' + rr, cell(row[0]));
    set('F' + rr, cell(row[1]));
    set('G' + rr, cell(row[2]));
  });
  S('B9', 'Kcd (độ võng)');
  set('C9', cell(undefined, 'VLOOKUP(C5,$E$5:$G$9,2,0)'));
  S('B10', 'Kcd (kéo uốn & trượt)');
  set('C10', cell(undefined, 'VLOOKUP(C5,$E$5:$G$9,3,0)'));

  S('B12', 'II. CÁC LỚP KẾT CẤU (từ trên xuống)');
  const hdr = ['STT', 'Tên lớp', 'Loại', 'h (cm)', 'E-võng', 'E-trượt', 'E-kéo uốn', 'Rku (MPa)', 'C (MPa)', 'φ (độ)'];
  hdr.forEach((h, i) => S(colL(1 + i) + '13', h));
  const LR0 = 14;
  const n = I.layers.length;
  I.layers.forEach((l, i) => {
    const r = LR0 + i;
    set('B' + r, cell(i + 1));
    S('C' + r, l.name);
    S('D' + r, F_TYPES[l.type].label);
    set('E' + r, cell(l.h));
    set('F' + r, cell(l.Ev));
    set('G' + r, cell(l.Et));
    set('H' + r, cell(l.Ek));
    set('I' + r, cell(l.Rku));
    set('J' + r, cell(l.C));
    set('K' + r, cell(l.phi));
  });
  const LRend = LR0 + n - 1;
  let r = LRend + 2;
  S('B' + r, 'III. NỀN ĐẤT');
  r++;
  S('B' + r, 'E0 – tính võng');
  set('C' + r, cell(I.E0v));
  const rE0v = r;
  r++;
  S('B' + r, 'E0 – tính trượt');
  set('C' + r, cell(I.E0t));
  const rE0t = r;
  r++;
  S('B' + r, 'C0');
  set('C' + r, cell(I.C0));
  const rC0 = r;
  r++;
  S('B' + r, 'φ0');
  set('C' + r, cell(I.phi0));
  const rPhi0 = r;
  r++;
  S('B' + r, 'k3 nền');
  set('C' + r, cell(I.k3_0));
  const rk3_0 = r;
  r += 2;

  S('B' + r, 'IV. GIAO THÔNG (xem sheet "Giao thông")');
  r++;
  S('B' + r, 'Ntt (trục/ngđ/làn)');
  set('C' + r, cell(undefined, `'Giao thông'!B${refs.rNtt}`));
  r++;
  S('B' + r, 'Ne (t chính)');
  set('C' + r, cell(undefined, `'Giao thông'!C${refs.rNeMain}`));
  r += 2;

  S('B' + r, 'V. TC1 – ĐỘ VÕNG ĐÀN HỒI (Điều 9.2)');
  r++;
  S('B' + r, 'Quy đổi Odemark từ dưới lên (cột: h, E, k, t, H_cum, E_tb_cum)');
  r++;
  const bottomUp = [...Array(n).keys()].reverse().map((i) => ({ hRef: `E${LR0 + i}`, ERef: `F${LR0 + i}` }));
  const chain = writeOdemarkChain(set, S, 1, r, bottomUp, 'Chuỗi quy đổi (võng)');
  r = chain.lastRow + 1;
  S('B' + r, 'H – tổng bề dày');
  set('C' + r, cell(undefined, chain.Href));
  const rH = r;
  r++;
  S('B' + r, 'H/D');
  set('C' + r, cell(undefined, `C${rH}/$C$7`));
  const rHD = r;
  r++;
  S('B' + r, 'β (Bảng 11 / ct.6)');
  set('C' + r, cell(undefined, betaFormula(`C${rHD}`, n > 1)));
  const rBeta = r;
  r++;
  S('B' + r, "E'tb = β·Etb (khống chế ≤ max Eᵢ)");
  set('C' + r, cell(undefined, `MIN(C${rBeta}*${chain.Etbref},MAX(F${LR0}:F${LRend}))`));
  const rEtbc = r;
  r++;
  S('B' + r, 'Ech (công thức E.1, tham khảo Hình 2)');
  set('C' + r, cell(undefined, echFormula(`C${rE0v}`, `C${rEtbc}`, `C${rH}`, '$C$7')));
  const rEch = r;
  r++;
  S('B' + r, 'Eyc tra Bảng 9 (nhập từ ứng dụng)');
  set('C' + r, cell(Math.round(tc1.EycTab)));
  const rEycTab = r;
  r++;
  S('B' + r, 'Eyc tối thiểu Bảng 10');
  set('C' + r, cell(Math.round(tc1.EycMin)));
  const rEycMin = r;
  r++;
  S('B' + r, 'Eyc dùng kiểm toán = MAX');
  set('C' + r, cell(undefined, `MAX(C${rEycTab},C${rEycMin})`));
  const rEyc = r;
  r++;
  S('B' + r, 'Kcd_dv');
  set('C' + r, cell(undefined, '$C$9'));
  const rKdv = r;
  r++;
  S('B' + r, 'Yêu cầu Kcd_dv·Eyc');
  set('C' + r, cell(undefined, `C${rKdv}*C${rEyc}`));
  const rReq = r;
  r++;
  S('B' + r, 'Kết luận TC1');
  set('C' + r, { t: 's', f: `IF(C${rEch}>=C${rReq},"ĐẠT","KHÔNG ĐẠT")`, v: tc1.pass ? 'ĐẠT' : 'KHÔNG ĐẠT' });
  r += 2;

  S('B' + r, 'VI. TC2 – KÉO UỐN Ở ĐÁY CÁC LỚP LIỀN KHỐI (Điều 9.4)');
  r++;
  const tc2mat = I.layers.map((l, i) => ({ l, i, meta: F_TYPES[l.type] })).filter((x) => x.meta.group !== 'roi');
  if (I.loaiMat === 'B1' || I.loaiMat === 'B2' || !tc2mat.length) {
    S('B' + r, '(Tầng mặt B1/B2 hoặc không có lớp liền khối – không yêu cầu)');
    r += 2;
  } else {
    tc2mat.forEach(({ l, i, meta }) => {
      S('B' + r, `Lớp: ${l.name} (${meta.group === 'mat' ? 'Hình 7/E.2' : 'Hình 8/E.4'})`);
      r++;
      const h1f = `SUM(E${LR0}:E${LR0 + i})`;
      S('B' + r, 'h1 (cm)');
      set('C' + r, cell(undefined, h1f));
      const rh1 = r;
      r++;
      const E1f =
        meta.group === 'mat'
          ? `SUMPRODUCT(E${LR0}:E${LR0 + i},H${LR0}:H${LR0 + i})/SUM(E${LR0}:E${LR0 + i})`
          : i > 0
            ? `SUMPRODUCT(E${LR0}:E${LR0 + i - 1},H${LR0}:H${LR0 + i - 1})/SUM(E${LR0}:E${LR0 + i - 1})`
            : '0';
      S('B' + r, 'E1 (MPa)');
      set('C' + r, cell(undefined, E1f));
      const rE1 = r;
      r++;
      const belowIdx: number[] = [];
      for (let j = i + 1; j < n; j++) belowIdx.push(j);
      let rEchm: number;
      if (!belowIdx.length) {
        S('B' + r, 'Echm (không có lớp dưới → = E0 võng)');
        set('C' + r, cell(undefined, `C${rE0v}`));
        rEchm = r;
        r++;
      } else {
        const bu = belowIdx.slice().reverse().map((j) => ({ hRef: `E${LR0 + j}`, ERef: `H${LR0 + j}` }));
        const ch = writeOdemarkChain(set, S, 9, r, bu, 'Quy đổi lớp dưới (kéo uốn)');
        r = ch.lastRow + 1;
        S('B' + r, 'H dưới');
        set('C' + r, cell(undefined, ch.Href));
        const rHbelow = r;
        r++;
        S('B' + r, 'HD dưới');
        set('C' + r, cell(undefined, `C${rHbelow}/$C$7`));
        const rhdB = r;
        r++;
        S('B' + r, 'β dưới');
        set('C' + r, cell(undefined, betaFormula(`C${rhdB}`, ch.n > 1)));
        const rbB = r;
        r++;
        S('B' + r, "E'tb dưới");
        set('C' + r, cell(undefined, `MIN(C${rbB}*${ch.Etbref},MAX(${belowIdx.map((j) => 'H' + (LR0 + j)).join(',')}))`));
        const rEtbB = r;
        r++;
        S('B' + r, 'Echm');
        set('C' + r, cell(undefined, echFormula(`C${rE0v}`, `C${rEtbB}`, `C${rHbelow}`, '$C$7')));
        rEchm = r;
        r++;
      }
      S('B' + r, 'σ̄ku (đơn vị)');
      const skuBarF =
        meta.group === 'mat'
          ? skuMatFormula(`C${rh1}`, `C${rE1}`, `C${rEchm}`, '$C$7')
          : skuMongFormula(`C${rE1}`, `H${LR0 + i}`, `C${rEchm}`, `C${rh1}`, '$C$7');
      set('C' + r, cell(undefined, skuBarF));
      const rSkuBar = r;
      r++;
      S('B' + r, 'kb (Điều 9.4.2)');
      set('C' + r, cell(0.85));
      const rKb = r;
      r++;
      S('B' + r, 'σku = σ̄ku·p·kb (10)');
      set('C' + r, cell(undefined, `C${rSkuBar}*$C$8*C${rKb}`));
      const rSku = r;
      r++;
      const NeRef =
        meta.life === 15
          ? `'Giao thông'!C${refs.rNe15}`
          : meta.life === 10
            ? `'Giao thông'!C${refs.rNe10}`
            : `'Giao thông'!C${refs.rNeMain}`;
      S('B' + r, 'Ne dùng tính k1');
      set('C' + r, cell(undefined, NeRef));
      const rNeL = r;
      r++;
      const k1f =
        meta.group === 'mat'
          ? `11.11/C${rNeL}^0.22`
          : l.type === 'gcdat'
            ? `2.22/C${rNeL}^0.11`
            : `2.86/C${rNeL}^0.11`;
      S('B' + r, 'k1');
      set('C' + r, cell(undefined, k1f));
      const rk1 = r;
      r++;
      S('B' + r, 'k2');
      set('C' + r, cell(meta.k2));
      const rk2 = r;
      r++;
      S('B' + r, 'Rtt = k1·k2·Rku');
      set('C' + r, cell(undefined, `C${rk1}*C${rk2}*I${LR0 + i}`));
      const rRtt = r;
      r++;
      S('B' + r, 'Cho phép = Rtt/Kcd_ku');
      set('C' + r, cell(undefined, `C${rRtt}/$C$10`));
      const rAllow = r;
      r++;
      S('B' + r, 'Kết luận');
      set('C' + r, { t: 's', f: `IF(C${rSku}<=C${rAllow},"ĐẠT","KHÔNG ĐẠT")` });
      r += 2;
    });
  }

  S('B' + r, 'VII. TC3 – CẮT TRƯỢT (Điều 9.3)');
  r++;
  const points: Array<{ idx: number; label: string; Cref: string; k3?: number; k3ref?: string; phiRef: string }> = [];
  I.layers.forEach((l, i) => {
    if (l.type === 'hatroi' && l.shear) {
      points.push({ idx: i, label: 'Đỉnh lớp: ' + l.name, Cref: `J${LR0 + i}`, k3: 3.0, phiRef: `K${LR0 + i}` });
    }
  });
  points.push({ idx: n, label: 'Nền đất', Cref: `C${rC0}`, k3ref: `C${rk3_0}`, phiRef: `C${rPhi0}` });

  if (I.loaiMat === 'B1' || I.loaiMat === 'B2') {
    S('B' + r, '(Tầng mặt B1/B2 – không yêu cầu)');
  } else {
    points.forEach((p) => {
      S('B' + r, p.label);
      r++;
      const upIdx = [...Array(p.idx).keys()];
      let rEtbcUp: number;
      let rHup: number | null;
      if (!upIdx.length) {
        S('B' + r, 'E1 (không có lớp trên)');
        set('C' + r, cell(0));
        rEtbcUp = r;
        rHup = null;
        r++;
      } else {
        const bu = upIdx.slice().reverse().map((j) => ({ hRef: `E${LR0 + j}`, ERef: `G${LR0 + j}` }));
        const ch = writeOdemarkChain(set, S, 9, r, bu, 'Quy đổi lớp trên (trượt)');
        r = ch.lastRow + 1;
        S('B' + r, 'H trên');
        set('C' + r, cell(undefined, ch.Href));
        rHup = r;
        r++;
        S('B' + r, 'HD trên');
        set('C' + r, cell(undefined, `C${rHup}/$C$7`));
        const rhdU = r;
        r++;
        S('B' + r, 'β trên');
        set('C' + r, cell(undefined, betaFormula(`C${rhdU}`, ch.n > 1)));
        const rbU = r;
        r++;
        S('B' + r, "E'tb trên (=E1)");
        set('C' + r, cell(undefined, `MIN(C${rbU}*${ch.Etbref},MAX(${upIdx.map((j) => 'G' + (LR0 + j)).join(',')}))`));
        rEtbcUp = r;
        r++;
      }
      const lowIdx: number[] = [];
      for (let j = p.idx; j < n; j++) lowIdx.push(j);
      let rE2: number;
      if (!lowIdx.length) {
        S('B' + r, 'E2 (= E0 trượt)');
        set('C' + r, cell(undefined, `C${rE0t}`));
        rE2 = r;
        r++;
      } else {
        const bu = lowIdx.slice().reverse().map((j) => ({ hRef: `E${LR0 + j}`, ERef: `G${LR0 + j}` }));
        const ch = writeOdemarkChain(set, S, 9, r, bu, 'Quy đổi lớp dưới (trượt)');
        r = ch.lastRow + 1;
        S('B' + r, 'H dưới');
        set('C' + r, cell(undefined, ch.Href));
        const rHlo = r;
        r++;
        S('B' + r, 'HD dưới');
        set('C' + r, cell(undefined, `C${rHlo}/$C$7`));
        const rhdL = r;
        r++;
        S('B' + r, 'β dưới');
        set('C' + r, cell(undefined, betaFormula(`C${rhdL}`, ch.n > 1)));
        const rbL = r;
        r++;
        S('B' + r, "E'tb dưới");
        set('C' + r, cell(undefined, `MIN(C${rbL}*${ch.Etbref},MAX(${lowIdx.map((j) => 'G' + (LR0 + j)).join(',')}))`));
        const rEtbL = r;
        r++;
        S('B' + r, 'E2 = Echm');
        set('C' + r, cell(undefined, echFormula(`C${rE0t}`, `C${rEtbL}`, `C${rHlo}`, '$C$7')));
        rE2 = r;
        r++;
      }
      S('B' + r, 'H1/D (tra Hình 4/5)');
      set('C' + r, cell(undefined, rHup ? `C${rHup}/$C$7` : '0'));
      r++;
      S('B' + r, 'E1/E2 (tra Hình 4/5)');
      set('C' + r, cell(undefined, `C${rEtbcUp}/C${rE2}`));
      r++;
      const TaxpVal = I.shearManual['shear_' + p.idx] || 0;
      S('B' + r, 'Tax/p (nhập từ toán đồ Hình 4/5)');
      set('C' + r, cell(TaxpVal));
      const rTaxp = r;
      r++;
      S('B' + r, 'Tax = (Tax/p)·p');
      set('C' + r, cell(undefined, `C${rTaxp}*$C$8`));
      const rTax = r;
      r++;
      S('B' + r, 'Tav (tự động, số hoá Hình 6)');
      set('C' + r, cell(undefined, tavFormula(p.phiRef, rHup ? `C${rHup}` : '0')));
      const rTav = r;
      r++;
      S('B' + r, 'k2 (Bảng 12)');
      set('C' + r, cell(bang12K2(I.traf.Ntt)));
      const rk2s = r;
      r++;
      S('B' + r, 'C (lực dính)');
      set('C' + r, cell(undefined, p.Cref));
      const rCp = r;
      r++;
      S('B' + r, 'k3');
      set('C' + r, p.k3ref ? cell(undefined, p.k3ref) : cell(p.k3 ?? 3));
      const rk3p = r;
      r++;
      S('B' + r, 'Ctt = C·0,6·k2·k3');
      set('C' + r, cell(undefined, `C${rCp}*0.6*C${rk2s}*C${rk3p}`));
      const rCtt = r;
      r++;
      S('B' + r, 'Cho phép = Ctt/Kcd_tr');
      set('C' + r, cell(undefined, `C${rCtt}/$C$10`));
      const rAllow3 = r;
      r++;
      S('B' + r, 'Vế trái = Tax+Tav');
      set('C' + r, cell(undefined, `C${rTax}+C${rTav}`));
      const rLhs3 = r;
      r++;
      S('B' + r, 'Kết luận');
      set('C' + r, { t: 's', f: `IF(C${rLhs3}<=C${rAllow3},"ĐẠT","KHÔNG ĐẠT")` });
      r += 2;
    });
  }

  ws['!ref'] = 'A1:P' + (r + 5);
  ws['!cols'] = [
    { wch: 4 },
    { wch: 40 },
    { wch: 26 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 8 },
    { wch: 4 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
  ];
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
  return ws;
}

export function buildFlexThuyetMinhSheet(
  I: FlexResolvedInput,
  tc1: FlexTC1Result,
  tc2: FlexTC2Row[],
  tc3: FlexTC3Row[],
): XLSX.WorkSheet {
  const P = (x: number, d = 3) => fmt(x, d);
  const okAll = tc1.pass && tc2.every((r) => r.pass) && tc3.every((r) => r.pass);
  const Ktr = BANG8[I.dotincay].kutr;
  const capLabel = CAP_DUONG_38_OPTIONS.find((o) => o.value === I.capDuong)?.label || I.capDuong;
  const matLabel = LOAI_MAT_38_OPTIONS.find((o) => o.value === I.loaiMat)?.label || I.loaiMat;

  const aoa: Array<Array<string | number>> = [
    ['BẢNG TÍNH KẾT CẤU ÁO ĐƯỜNG MỀM'],
    ['(Tiêu chuẩn áp dụng: TCCS 38:2022/TCĐBVN)'],
    [''],
    ['I. SỐ LIỆU ĐẦU VÀO'],
    [''],
    ['1/ Thông số chung'],
    ['Thông số', 'Giá trị'],
    ['Cấp đường', capLabel],
    ['Loại tầng mặt', matLabel],
    ['Độ tin cậy thiết kế (Bảng 7)', I.dotincay],
    ['Tải trọng trục tính toán tiêu chuẩn', `${I.traf.Ptt} kN`],
    ['Đường kính vệt bánh xe tính toán, D', `${I.D} cm`],
    ['Áp lực tính toán tiêu chuẩn, p', `${P(I.p, 2)} MPa`],
    ['Mô đun đàn hồi nền đường – tính võng, E0', `${fmtI(I.E0v)} MPa`],
    ['Mô đun đàn hồi nền đường – tính trượt, E0', `${fmtI(I.E0t)} MPa`],
    ['Lực dính / góc ma sát nền đất, C – φ', `${P(I.C0, 3)} MPa – ${I.phi0}°`],
    ['Mô đun đàn hồi yêu cầu, Eyc = max(Bảng 9, Bảng 10)', `${P(tc1.Eyc, 0)} MPa (Bảng 9: ${P(tc1.EycTab, 0)}; Bảng 10: ${P(tc1.EycMin, 0)})`],
    ['Hệ số cường độ về độ võng (Bảng 8), Kcd_dv', P(tc1.Kdv, 3)],
    ['Hệ số cường độ về kéo uốn (Bảng 8), Kcd_ku', P(BANG8[I.dotincay].kutr, 3)],
    ['Hệ số cường độ về cắt trượt (Bảng 8), Kcd_tr', P(Ktr, 3)],
    ['Lưu lượng trục tính toán, Ntt', `${fmtI(I.traf.Ntt)} trục/ngđ/làn`],
    [`Số trục xe tiêu chuẩn tích luỹ, Ne (t=${P(I.traf.t, 0)} năm)`, `${fmtExp(I.traf.Ne, 3)} trục`],
    [''],
    ['2/ Cấu tạo kết cấu (từ dưới lên)'],
    ['Lớp kết cấu', 'Loại vật liệu', 'h (cm)', 'Ev', 'Et', 'Ek', 'Rku', 'C', 'φ'],
  ];
  [...I.layers].reverse().forEach((l) =>
    aoa.push([
      l.name,
      F_TYPES[l.type].label,
      fmt(l.h, 1),
      fmtI(l.Ev),
      fmtI(l.Et),
      fmtI(l.Ek),
      l.Rku ? fmt(l.Rku, 2) : '–',
      l.type === 'hatroi' ? fmt(l.C, 3) : '–',
      l.type === 'hatroi' ? l.phi : '–',
    ]),
  );
  aoa.push(['Nền đất', '–', '–', fmtI(I.E0v), fmtI(I.E0t), '–', '–', fmt(I.C0, 3), I.phi0]);
  aoa.push(['']);

  aoa.push(['II. TRÌNH TỰ TÍNH TOÁN']);
  aoa.push(['Kiểm toán theo Điều 9 TCCS 38:2022/TCĐBVN: quy đổi hệ nhiều lớp về hệ hai lớp theo Odemark (5–6), sau đó kiểm tra độ võng đàn hồi (9.2), kéo uốn (9.4) và cắt trượt (9.3).']);
  aoa.push(['']);
  aoa.push(["a/ Đổi tầng 2 lớp một từ dưới lên (mô đun tính độ võng) – biểu thức (5): E'tb = E1[(1+k·∛t)/(1+k)]³ , k=h2/h1 , t=E2/E1"]);
  aoa.push(['Lớp kết cấu', 'Ei (MPa)', 't=E2/E1', 'hi (cm)', 'k=h2/h1', 'Htb (cm)', "E'tb (MPa)"]);
  tc1.red.steps.forEach((s) =>
    aoa.push([
      s.name,
      fmtI(s.E),
      s.t === null ? '–' : fmt(s.t, 3),
      fmt(s.h, 1),
      s.k === null ? '–' : fmt(s.k, 3),
      fmt(s.Htb, 1),
      fmt(s.Etb, 1),
    ]),
  );
  aoa.push(['']);
  aoa.push(['b/ Hệ số điều chỉnh β và mô đun đàn hồi trung bình đã điều chỉnh']);
  aoa.push([`Với H/D = ${fmt(tc1.red.H, 1)}/${I.D} = ${fmt(tc1.red.HD, 4)} ⇒ tra Bảng 11 được β = ${fmt(tc1.red.beta, 4)}.`]);
  aoa.push([`Vậy: Etb_dc = β × E'tb = ${fmt(tc1.red.beta, 4)} × ${fmt(tc1.red.Etb, 2)} = ${fmt(tc1.red.beta * tc1.red.Etb, 2)} MPa.`]);
  if (tc1.red.capped) {
    aoa.push([`LƯU Ý (chú thích Bảng 11): trị số Etb_dc tính được LỚN HƠN mô đun lớn nhất trong các lớp đem quy đổi (${fmtI(tc1.red.maxE)} MPa) ⇒ lấy Etb_dc = ${fmt(tc1.red.Etbc, 1)} MPa (đã áp dụng giới hạn).`]);
  }
  aoa.push(['']);
  aoa.push(['c/ Kiểm tra cường độ chung theo tiêu chuẩn độ võng đàn hồi (TC1) – biểu thức (4): Ech ≥ Kcd_dv·Eyc']);
  aoa.push([`Ta có: H/D = ${fmt(tc1.red.HD, 4)} ; E0/Etb_dc = ${fmtI(I.E0v)}/${fmt(tc1.red.Etbc, 2)} = ${fmt(I.E0v / tc1.red.Etbc, 4)}.`]);
  aoa.push([`Áp dụng biểu thức giải tích gần đúng (E.1), Phụ lục E, thay cho việc đọc thủ công toán đồ Hình 2 ⇒ Ech = ${fmt(tc1.Ech, 2)} MPa.`]);
  aoa.push([`Kcd_dv × Eyc = ${fmt(tc1.Kdv, 3)} × ${fmt(tc1.Eyc, 0)} = ${fmt(tc1.req, 2)} MPa.`]);
  aoa.push([`Kết quả nghiệm toán: Ech = ${fmt(tc1.Ech, 2)}${tc1.pass ? ' ≥ ' : ' < '}${fmt(tc1.req, 2)} MPa ⇒ KẾT LUẬN: ${tc1.pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}`]);
  aoa.push(['']);
  aoa.push(['d/ Kiểm tra cường độ theo tiêu chuẩn chịu kéo uốn (TC2) – biểu thức (9): σku ≤ Rtt_ku/Kcd_ku , σku=σ̄ku·p·kb (10) , Rtt_ku=k1·k2·Rku (11)']);
  if (!tc2.length) aoa.push(['Tầng mặt cấp thấp B1/B2 hoặc không có lớp liền khối nào – không yêu cầu kiểm tra theo Điều 9.1.4.3.']);
  tc2.forEach((r) => {
    const l = I.layers[r.idx];
    const Rtt = r.k1 * r.k2 * l.Rku;
    aoa.push([`• Đáy lớp ${r.name} (${r.group === 'mat' ? 'tầng mặt, tra E.2/E.3' : 'tầng móng, tra E.4'})`]);
    aoa.push([`  h1 = ${fmt(r.h1, 1)} cm ; E1 = ${fmt(r.E1, 1)} MPa (bình quân gia quyền, mô đun kéo uốn) ; Ech.m = ${fmt(r.Echm, 2)} MPa (theo (E.1) như bước b/).`]);
    aoa.push([`  σ̄ku = ${fmt(r.skuBar, 4)} ⇒ σku = σ̄ku·p·kb = ${fmt(r.skuBar, 4)} × ${fmt(I.p, 2)} × ${fmt(r.kb, 2)} = ${fmt(r.sku, 4)} MPa.`]);
    aoa.push([`  Ne = ${fmtExp(r.Ne, 3)} trục ⇒ k1 = ${fmt(r.k1, 3)} ; k2 = ${fmt(r.k2, 2)} ; Rku = ${fmt(l.Rku, 2)} MPa ⇒ Rtt_ku = k1·k2·Rku = ${fmt(Rtt, 3)} MPa.`]);
    aoa.push([`  Kcd_ku = ${fmt(BANG8[I.dotincay].kutr, 2)} ⇒ Rtt_ku/Kcd_ku = ${fmt(r.allow, 3)} MPa.`]);
    aoa.push([`  σku = ${fmt(r.sku, 4)}${r.pass ? ' < ' : ' > '}${fmt(r.allow, 3)} MPa ⇒ ${r.pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}`]);
  });
  aoa.push(['']);
  aoa.push(['e/ Kiểm tra cường độ theo tiêu chuẩn chịu cắt trượt (TC3) – biểu thức (7): Tax+Tav ≤ Ctt/Kcd_tr , Ctt=C·k1·k2·k3 (8)']);
  if (!tc3.length) aoa.push(['Tầng mặt cấp thấp B1/B2 – không yêu cầu kiểm tra theo Điều 9.1.4.3.']);
  tc3.forEach((r) => {
    const C0 = r.Ctt / (r.k1s * r.k2s * r.k3s);
    aoa.push([`• Tại ${r.label}`]);
    aoa.push([`  H1/D = ${fmt(r.H1, 1)}/${I.D} = ${fmt(r.HD, 3)} ; E1/E2 = ${fmt(r.E1, 1)}/${fmt(r.E2, 1)} = ${fmt(r.ratio, 2)} ; φ = ${r.phi}°.`]);
    aoa.push([`  Tra toán đồ Hình 4/5 được Tax/p = ${fmt(r.Taxp, 4)} ⇒ Tax = (Tax/p)·p = ${fmt(r.Taxp, 4)} × ${fmt(I.p, 2)} = ${fmt(r.Tax, 4)} MPa.`]);
    aoa.push([`  Tav (tự động, số hoá Hình 6 theo φ và H1) = ${fmt(r.Tav, 4)} MPa.`]);
    aoa.push([`  Ctt = C·k1·k2·k3 = ${fmt(C0, 3)} × ${fmt(r.k1s, 2)} × ${fmt(r.k2s, 2)} × ${fmt(r.k3s, 2)} = ${fmt(r.Ctt, 4)} MPa ; Kcd_tr = ${fmt(Ktr, 2)} ⇒ Ctt/Kcd_tr = ${fmt(r.allow, 4)} MPa.`]);
    aoa.push([`  Tax+Tav = ${fmt(r.Tax, 4)} + (${fmt(r.Tav, 4)}) = ${fmt(r.lhs, 4)}${r.pass ? ' ≤ ' : ' > '}${fmt(r.allow, 4)} MPa ⇒ ${r.pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}`]);
  });
  aoa.push(['']);
  aoa.push(['III. KẾT LUẬN CHUNG']);
  aoa.push(['Tiêu chuẩn giới hạn', 'Giá trị', '', 'Cho phép', '', 'Kết luận']);
  aoa.push(['TC1 – Độ võng đàn hồi (4)', fmt(tc1.Ech, 2), tc1.pass ? '≥' : '<', fmt(tc1.req, 2), 'MPa', tc1.pass ? 'ĐẠT' : 'KHÔNG ĐẠT']);
  tc2.forEach((r) => aoa.push([`TC2 – Kéo uốn đáy ${r.name}`, fmt(r.sku, 4), r.pass ? '≤' : '>', fmt(r.allow, 3), 'MPa', r.pass ? 'ĐẠT' : 'KHÔNG ĐẠT']));
  tc3.forEach((r) => aoa.push([`TC3 – Cắt trượt tại ${r.label}`, fmt(r.lhs, 4), r.pass ? '≤' : '>', fmt(r.allow, 4), 'MPa', r.pass ? 'ĐẠT' : 'KHÔNG ĐẠT']));
  aoa.push(['']);
  aoa.push([okAll ? 'KẾT CẤU ÁO ĐƯỜNG MỀM ĐẠT YÊU CẦU theo TCCS 38:2022' : 'KẾT CẤU CHƯA ĐẠT – CẦN ĐIỀU CHỈNH CHIỀU DÀY/MÔ ĐUN CÁC LỚP']);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 46 }, { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 8 }];
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } }];
  return ws;
}

export function buildFlexWorkbook(
  state: FlexFormState,
  I: FlexResolvedInput,
  tc1: FlexTC1Result,
  tc2: FlexTC2Row[],
  tc3: FlexTC3Row[],
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const trafSheet = buildFlexTrafficSheet(state);
  XLSX.utils.book_append_sheet(wb, buildFlexThuyetMinhSheet(I, tc1, tc2, tc3), 'Thuyết minh');
  XLSX.utils.book_append_sheet(wb, trafSheet.ws, 'Giao thông');
  XLSX.utils.book_append_sheet(wb, buildFlexTinhToanSheet(I, tc1, trafSheet), 'Tính toán');
  return wb;
}

/* ============================ TCCS 37 EXCEL ============================ */

export function buildSN37NewSheet(N: Sn37NewResult): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const set = (a: string, c: Cell) => {
    ws[a] = c;
  };
  const S = (a: string, v: string) => set(a, { t: 's', v });
  const capLabel = CAP_DUONG_37_OPTIONS.find((o) => o.value === N.t.capduong)?.label || N.t.capduong;

  S('A1', 'THIẾT KẾ MỚI — CHỈ SỐ KẾT CẤU SN (TCCS 37:2022/TCĐBVN, nền AASHTO 1993)');
  S('B3', "W80 – ESAL's thiết kế");
  set('C3', cell(N.t.w80));
  S('B4', 'Cấp đường');
  S('C4', capLabel);
  S('B5', 'p0 / pt');
  set('C5', cell(N.t.p0));
  set('D5', cell(N.t.pt));
  S('B6', 'ΔPSI = p0−pt');
  set('C6', cell(undefined, 'C5-D5', '0.00'));
  S('B7', 'R – độ tin cậy (%)');
  set('C7', cell(N.t.R));
  S('B8', 'S0');
  set('C8', cell(N.t.S0));
  S('B9', 'ZR = NORM.S.INV(1−R/100)');
  set('C9', cell(undefined, 'NORM.S.INV(1-C7/100)', '0.000'));
  S('B10', 'MR hữu hiệu nền đất (MPa)');
  set('C10', cell(N.MR, undefined, '0.0'));
  S('B11', '  — cách xác định');
  S(
    'C11',
    N.t.mrmode === 'direct'
      ? 'Nhập trực tiếp'
      : N.t.mrmode === 'cbr'
        ? `Từ CBR=${N.t.mrval}% (PL.G.2)`
        : `Từ GI=${N.t.mrval} (PL.G.2)`,
  );

  S('B13', 'GIẢI SN — PT (8)/(9): dùng Data ▸ What-If Analysis ▸ Goal Seek, đặt ô C16 = ô C14, đổi ô C15 (SN)');
  S('B14', 'log10(W80) mục tiêu');
  set('C14', cell(undefined, 'LOG10(C3)', '0.0000'));
  S('B15', 'SN (thử/đã giải — đổi ô này khi Goal Seek)');
  set('C15', cell(N.SN, undefined, '0.000'));
  S('B16', 'log10(W80) tính từ SN (kiểm tra, phải = C14)');
  set(
    'C16',
    cell(undefined, 'C9*C8+9.36*LOG10(C15+1)-0.2+LOG10(C6/2.7)/(0.40+1094/(C15+1)^5.19)+2.32*LOG10(C10)-3.06', '0.0000'),
  );
  S('B17', 'Sai số');
  set('C17', cell(undefined, 'C16-C14', '0.00000'));

  S('B19', 'CHIỀU DÀY CÁC LỚP — 2,54·SN = Σaᵢ·Dᵢ  (11)');
  const hdr = ['STT', 'Tên lớp', 'Loại (công thức Phụ lục G)', 'Giá trị nhập', 'Đơn vị', 'aᵢ', 'Dᵢ (cm)', 'aᵢ·Dᵢ'];
  hdr.forEach((h, i) => S(colL(1 + i) + '20', h));
  const LR0 = 21;
  const n = N.rows.length;
  N.rows.forEach((r, i) => {
    const rr = LR0 + i;
    set('B' + rr, cell(i + 1));
    S('C' + rr, r.name);
    S('D' + rr, `${G_KINDS[r.kind].label} ${G_KINDS[r.kind].eqName}`);
    set('E' + rr, cell(r.val));
    S('F' + rr, G_KINDS[r.kind].unit);
    set('G' + rr, cell(r.a, undefined, '0.000'));
    if (i < n - 1) {
      set('H' + rr, cell(r.D, undefined, '0.0'));
      set('I' + rr, cell(undefined, `G${rr}*H${rr}`, '0.000'));
    } else {
      const sumRef = n > 1 ? `SUM(I${LR0}:I${LR0 + n - 2})` : '0';
      set('H' + rr, cell(undefined, `(2.54*$C$15-${sumRef})/G${rr}`, '0.0'));
      set('I' + rr, cell(undefined, `G${rr}*H${rr}`, '0.000'));
    }
  });
  const LRend = LR0 + n - 1;
  const r2 = LRend + 2;
  S('B' + r2, 'Σ(aᵢ·Dᵢ) tính lại');
  set('C' + r2, cell(undefined, `SUM(I${LR0}:I${LRend})`, '0.000'));
  S('B' + (r2 + 1), '2,54 × SN yêu cầu');
  set('C' + (r2 + 1), cell(undefined, '2.54*C15', '0.000'));
  S('B' + (r2 + 3), 'Tổng bề dày BTN tầng mặt');
  set('C' + (r2 + 3), cell(N.totalBTN, undefined, '0.0'));
  S(
    'B' + (r2 + 4),
    `Bảng 5 (W80≤${N.b5.max === Infinity ? '>20 triệu' : fmtI(N.b5.max)}): BTN tối thiểu / móng trên hạt / móng trên hạt trộn nhựa`,
  );
  S('C' + (r2 + 4), `${N.b5.btn} cm / ${N.b5.hat} cm / ${N.b5.hatnhua} cm`);
  ws['!ref'] = 'A1:J' + (r2 + 6);
  ws['!cols'] = [{ wch: 3 }, { wch: 34 }, { wch: 30 }, { wch: 12 }, { wch: 8 }, { wch: 9 }, { wch: 10 }, { wch: 10 }];
  return ws;
}

export function buildSN37OverlaySheet(O: Sn37OverlayResult): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const set = (a: string, c: Cell) => {
    ws[a] = c;
  };
  const S = (a: string, v: string) => set(a, { t: 's', v });

  S('A1', 'TĂNG CƯỜNG (OVERLAY) — TCCS 37:2022/TCĐBVN');
  S('B3', "Nf – ESAL's tương lai");
  set('C3', cell(O.Nf));
  S('B4', 'R (%) / S0');
  set('C4', cell(O.R));
  set('D4', cell(O.S0));
  S('B5', 'p1 / p2');
  set('C5', cell(O.p1));
  set('D5', cell(O.p2));
  S('B6', 'ΔPSI = p1−p2');
  set('C6', cell(undefined, 'C5-D5', '0.00'));
  S('B7', 'ZR = NORM.S.INV(1−R/100)');
  set('C7', cell(undefined, 'NORM.S.INV(1-C4/100)', '0.000'));
  S('B8', 'MR thiết kế nền hiện hữu');
  set('C8', cell(O.MR, undefined, '0.0'));
  S('B10', 'log10(Nf) mục tiêu');
  set('C10', cell(undefined, 'LOG10(C3)', '0.0000'));
  S('B11', 'SNf (thử/đã giải — Goal Seek nếu đổi số liệu)');
  set('C11', cell(O.SNf, undefined, '0.000'));
  S('B12', 'log10(Nf) tính từ SNf (kiểm tra, = C10)');
  set(
    'C12',
    cell(undefined, 'C7*D4+9.36*LOG10(C11+1)-0.2+LOG10(C6/2.7)/(0.40+1094/(C11+1)^5.19)+2.32*LOG10(C8)-3.06', '0.0000'),
  );

  let r = 14;
  function writeFinal(rSNeff: number) {
    S('B' + r, 'SNol = SNf − SNeff  (19)');
    set('C' + r, cell(undefined, `C11-C${rSNeff}`, '0.000'));
    const rSNol = r;
    r++;
    S('B' + r, 'EAC lớp phủ (MPa)');
    set('C' + r, cell(O.Eac, undefined, '0'));
    const rEac = r;
    r++;
    S('B' + r, 'aol = MAX(0,MIN(0,44 ; 0,40·log10(EAC·0,145038/450)+0,44))  (16)');
    set('C' + r, cell(undefined, `MAX(0,MIN(0.44,0.40*LOG10(C${rEac}*0.145038/450)+0.44))`, '0.000'));
    const rAol = r;
    r++;
    S('B' + r, 'Dol = 2,54·SNol/aol  (18)');
    set('C' + r, cell(undefined, `2.54*C${rSNol}/C${rAol}`, '0.0'));
    r++;
    return r;
  }

  S(
    'B' + r,
    'XÁC ĐỊNH SNeff — phương pháp: ' +
      (O.detail.method === 'fwd'
        ? 'a) Đo võng FWD (7.3.1)'
        : O.detail.method === 'survey'
          ? 'b) Khảo sát hiện trạng (7.3.2)'
          : 'c) Tuổi thọ còn lại (7.3.3)'),
  );
  r += 1;

  if (O.detail.method === 'fwd') {
    const d = O.detail;
    S('B' + r, 'P (kN) / a (cm) / D (cm)');
    set('C' + r, cell(d.P));
    set('D' + r, cell(d.a));
    set('E' + r, cell(d.D));
    const rP = r;
    r++;
    S('B' + r, 'r (cm) / dr (cm) / d0 (cm) / C hiệu chỉnh');
    set('C' + r, cell(d.r));
    set('D' + r, cell(d.dr));
    set('E' + r, cell(d.d0));
    set('F' + r, cell(d.C));
    const rMeas = r;
    r++;
    S('B' + r, 'p = 10P/(π·a²)');
    set('C' + r, cell(undefined, `10*C${rP}/(PI()*D${rP}^2)`, '0.000'));
    const rP2 = r;
    r++;
    S('B' + r, 'MR = 2,4P/(dr·r)  (24)');
    set('C' + r, cell(undefined, `2.4*C${rP}/(D${rMeas}*C${rMeas})`, '0.0'));
    const rMRfwd = r;
    r++;
    S('B' + r, 'MR thiết kế = C·MR  (26)');
    set('C' + r, cell(undefined, `F${rMeas}*C${rMRfwd}`, '0.0'));
    r++;
    S('B' + r, 'Ep (thử/đã giải — Goal Seek để khớp d0)');
    set('C' + r, cell(d.Ep, undefined, '0.0'));
    const rEp = r;
    r++;
    S('B' + r, 'd0 tính từ Ep — ptr (22) (đặt = d0 đo bằng Goal Seek)');
    set(
      'C' + r,
      cell(
        undefined,
        `1.5*C${rP2}*D${rP}*(1/(C${rMRfwd}*SQRT(1+(E${rP}/D${rP}*(C${rEp}/C${rMRfwd})^(1/3))^2))+(1-1/SQRT(1+(E${rP}/D${rP})^2))/C${rEp})`,
        '0.00000',
      ),
    );
    r++;
    S('B' + r, 'd0 đo (mục tiêu)');
    set('C' + r, cell(d.d0, undefined, '0.00000'));
    r++;
    S('B' + r, 'SNeff = 0,0093·D·Ep^(1/3)  (21)');
    set('C' + r, cell(undefined, `0.0093*E${rP}*C${rEp}^(1/3)`, '0.000'));
    const rSNeff = r;
    r += 2;
    r = writeFinal(rSNeff);
  } else if (O.detail.method === 'survey') {
    const d = O.detail;
    S('B' + r, 'Lớp');
    S('C' + r, 'aᵢ');
    S('D' + r, 'Dᵢ (cm)');
    S('E' + r, 'aᵢ·Dᵢ');
    r++;
    const rStart = r;
    d.layers.forEach((l) => {
      S('B' + r, l.name);
      set('C' + r, cell(l.a, undefined, '0.000'));
      set('D' + r, cell(l.D, undefined, '0.0'));
      set('E' + r, cell(undefined, `C${r}*D${r}`, '0.000'));
      r++;
    });
    const rEnd = r - 1;
    S('B' + r, 'Σaᵢ·Dᵢ');
    set('C' + r, cell(undefined, `SUM(E${rStart}:E${rEnd})`, '0.000'));
    const rSum = r;
    r++;
    S('B' + r, 'SNeff = Σaᵢ·Dᵢ/2,54  (27)');
    set('C' + r, cell(undefined, `C${rSum}/2.54`, '0.000'));
    const rSNeff = r;
    r += 2;
    r = writeFinal(rSNeff);
  } else {
    const d = O.detail;
    S('B' + r, 'SN0 ban đầu');
    set('C' + r, cell(d.SN0, undefined, '0.000'));
    const rSN0 = r;
    r++;
    S('B' + r, 'Np / N1,5');
    set('C' + r, cell(d.Np));
    set('D' + r, cell(d.N15));
    const rN = r;
    r++;
    S('B' + r, 'RL = 100(1−Np/N1,5)  (29)');
    set('C' + r, cell(undefined, `100*(1-C${rN}/D${rN})`, '0.00'));
    r++;
    S('B' + r, 'CF (tra Hình 15 — số hoá gần đúng, giá trị từ ứng dụng)');
    set('C' + r, cell(d.CF, undefined, '0.000'));
    const rCF = r;
    r++;
    S('B' + r, 'SNeff = CF·SN0  (28)');
    set('C' + r, cell(undefined, `C${rCF}*C${rSN0}`, '0.000'));
    const rSNeff = r;
    r += 2;
    r = writeFinal(rSNeff);
  }

  ws['!ref'] = 'A1:G' + (r + 2);
  ws['!cols'] = [{ wch: 3 }, { wch: 52 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }];
  return ws;
}

export function buildSN37LowSheet(L: Sn37LowResult): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const set = (a: string, c: Cell) => {
    ws[a] = c;
  };
  const S = (a: string, v: string) => set(a, { t: 's', v });
  S('A1', 'LƯU LƯỢNG THẤP (ĐIỀU 8) — TCCS 37:2022/TCĐBVN');
  S('B3', 'Loại tầng mặt');
  S('C3', L.loai === 'nhua' ? 'Trộn nhựa / láng nhựa' : 'Cấp phối đá');
  S('B4', "ESAL's thiết kế");
  set('C4', cell(L.esal));
  S('B5', 'Cấp lưu lượng (Điều 8.4.1/8.4.2)');
  S('C5', L.level);
  S('B6', 'MR nền đường');
  set('C6', cell(L.MR, undefined, '0.0'));
  S('B7', 'Chất lượng nền (Điều 8.4.3)');
  S('C7', L.quality);
  S('B8', 'Độ tin cậy R áp dụng');
  S('C8', `${L.Rrel}%`);
  let r = 10;
  if (L.loai === 'nhua' && L.row) {
    S('B' + r, `SN tra Bảng ${L.tableNo} (R=${L.Rrel}%)`);
    S('C' + r, String(L.snr));
    r += 2;
    S('B' + r, `Kết cấu đề xuất — Bảng ${L.tableNo2}:`);
    r++;
    S('B' + r, 'SN trung bình');
    S('C' + r, String(L.row.sn));
    r++;
    const fo = (o: [number, number, number] | 'KD' | 'CT') =>
      o === 'KD' ? 'KD – không nên dùng' : o === 'CT' ? 'CT – cần cải thiện nền trước' : `M/MT/MĐ = ${o[0]}/${o[1]}/${o[2]} cm`;
    S('B' + r, 'Láng nhựa 2 lớp (LN/MT/MĐ)');
    S('C' + r, L.row.ln === 'KD' ? 'KD – không nên dùng' : `LN/MT/MĐ = ${L.row.ln[0]}/${L.row.ln[1]}/${L.row.ln[2]} cm`);
    r++;
    S('B' + r, 'Đá dăm thấm nhập nhựa (M/MT/MĐ)');
    S('C' + r, fo(L.row.dd));
    r++;
    S('B' + r, 'Bê tông nhựa (M/MT/MĐ)');
    S('C' + r, fo(L.row.bt));
    r++;
  } else {
    S('B' + r, 'Chiều dày lớp cấp phối đá (E≥200MPa, Bảng 19)');
    S('C' + r, L.th === '**' ? '** cần thiết kế khác/cải thiện nền' : `${L.th} cm`);
    r++;
  }
  ws['!ref'] = 'A1:C' + (r + 2);
  ws['!cols'] = [{ wch: 3 }, { wch: 40 }, { wch: 34 }];
  return ws;
}

export function buildSN37Workbook(N: Sn37NewResult, O: Sn37OverlayResult, L: Sn37LowResult): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSN37NewSheet(N), 'TK moi');
  XLSX.utils.book_append_sheet(wb, buildSN37OverlaySheet(O), 'Tang cuong');
  XLSX.utils.book_append_sheet(wb, buildSN37LowSheet(L), 'Luu luong thap');
  return wb;
}

export function downloadWorkbook(wb: XLSX.WorkBook, filename: string): void {
  XLSX.writeFile(wb, filename, { cellStyles: true });
}
