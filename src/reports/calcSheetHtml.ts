import {
  CALC,
  buildBars,
  calcGsOut,
  keyOn,
  quantities,
  setCalcDec as setEngineCalcDec,
  unitW,
  type CalcRunResult,
  type CalcValidResult,
  type CantiCalcResult,
  type RibCalcResult,
} from '../engine';
import type { CalcGlobalComboResult } from '../types/project';
import type { EngineProject } from '../engine/types';
import { calcExtChecks, calcExtInputs, calcExtLoads, calcExtSum } from './calcExtFigures';
import { calcFeSheet } from './calcFeCharts';
import { cfAnchor, cfBase, cfLoads, cfPressure, cfRbScheme, cfRC, cfSection, cfWeights } from './calcFigures';
import { calcFemSheet, calcGsSheet } from './calcGsFemCharts';
import { calcRibDims, calcRibRebarRows, calcSheetRib } from './calcRibSheet';
import {
  cnf,
  resetReportFigCounter,
  setCalcDec as setReportDec,
  setFemSecNo,
  setGsSecNo,
} from './cfig';
import {
  CALC_ROCKN,
  CD_LAB,
  S_KEYS,
  calcPjBlock,
  calcTipText,
  cdLab,
  sExp,
  sF,
  sFig,
  sFootPress,
  sH2,
  sH3,
  sKL,
  sKeyE,
  sKeyU,
  sOk,
  sRC,
  sRow,
  sRowT,
  sTab,
  sTx,
} from './reportHelpers';

export interface CalcRbScheduleRow {
  key: string;
  keys: string[];
  mark: string;
  name: string;
  d: number;
  a: number;
  n: number;
  L: number;
  As: number | null;
  kg: number;
  spaced: boolean;
}

export interface CalcRbScheduleResult {
  res: ReturnType<typeof buildBars>;
  rows: CalcRbScheduleRow[];
  Lum: number;
  kg: number;
  vol: number;
  ratio: number;
}

export function calcSheetHead(
  P: EngineProject,
  R: CalcValidResult,
): { h: string; sec: number } {
  const tf = cnf;
  const g = R.g;
  const I = R.I;
  const Ld = R.Ld;
  const w = Ld.w0;
  const c = (P.calc || {}) as NonNullable<EngineProject['calc']>;
  const an = R.an;
  const rib = R.model === 'rib';
  const hasKey = keyOn(P) && P.tpl !== 'C';

  let h = '';
  h += `<h1 class="ttl">TÍNH TOÁN VÀ KIỂM TOÁN TƯỜNG CHẮN BÊ TÔNG CỐT THÉP THEO TIÊU CHUẨN THIẾT KẾ CẦU ĐƯỜNG BỘ TCVN 11823:2017</h1>`;
  h += calcPjBlock(P as never);
  h += `<p class="small">Đơn vị: kN, m, kPa (kN/m²), MPa. Tính cho 1 m dài tường.</p>`;
  h +=
    sH2('1.&nbsp;&nbsp;TIÊU CHUẨN THIẾT KẾ VÀ TÀI LIỆU THAM KHẢO') +
    sTx(
      '- TCVN 11823:2017 Thiết kế cầu đường bộ: Phần 3 (Tải trọng và hệ số tải trọng), Phần 5 (Kết cấu bê tông), Phần 10 (Nền móng), Phần 11 (Mố, trụ và tường chắn);',
    ) +
    sTx(
      '- AASHTO LRFD Bridge Design Specifications, 7th Ed. (2014): đối chiếu các điều khoản tương ứng của TCVN 11823.',
    );

  h += sH2('2.&nbsp;&nbsp;MÔ HÌNH TÍNH TOÁN VÀ KÍCH THƯỚC TƯỜNG CHẮN');
  h += sFig(
    cfSection(R as never),
    'Mô hình tính toán và kích thước tường chắn (O - gốc tọa độ, C - tâm đáy bản đáy, AT - mặt phẳng tính áp lực đất)',
  );
  h += sTx(
    'Tường đứng BTCT ngàm vào bản đáy; mặt trước, mặt sau tường đứng có thể nghiêng; bản đáy đáy phẳng, mặt trên mũi và gót có thể vát. Gốc tọa độ O tại mép trước đáy bản đáy.' +
      (hasKey
        ? ' Chân khay (nếu có) dưới bản đáy được kể vào trọng lượng bản đáy; không kể sức kháng bị động của đất trước chân khay.'
        : ''),
  );
  h += sTx(calcTipText(P as never, tf, 'Tham khảo kinh nghiệm thiết kế'));
  h +=
    sRow('Chiều cao tường đứng (từ đỉnh bản đáy đến đỉnh tường)', 'H', tf(I.H, 3), 'm') +
    sRow('Bề dày đỉnh tường đứng', 't', tf(I.t, 3), 'm') +
    sRow('Độ nghiêng mặt trước tường đứng (1 : n1)', 'n1', tf(I.n1, 4), '') +
    sRow(
      'Độ nghiêng mặt sau tường đứng (1 : n2; dương khi tường dày dần xuống chân)',
      'n2',
      tf(I.n2, 4),
      '',
    ) +
    sRow('Bề rộng mũi bản đáy (phía trước tường đứng)', 'b1', tf(I.b1, 3), 'm') +
    sRow('Bề rộng gót bản đáy (phía sau tường đứng)', 'b4', tf(I.b4, 3), 'm') +
    sRow('Chiều dày bản đáy tại tường đứng', 'hm', tf(I.hm, 3), 'm') +
    sRow('Chiều dày bản đáy tại mép mũi', 'ht', tf(I.ht, 3), 'm') +
    sRow('Chiều dày bản đáy tại mép gót', 'hh', tf(I.hh, 3), 'm') +
    sRow('Chiều dày đất phủ phía trước, trên mép mũi', 'hf', tf(I.hf, 3), 'm');
  h +=
    sRow('Bề dày chân tường đứng tb = t + (n1 + n2).H', 'tb', tf(g.tb, 3), 'm') +
    sRow('Bề rộng bản đáy B = b1 + tb + b4', 'B', tf(g.B, 3), 'm') +
    sRow('Chiều cao toàn tường (từ đáy bản đáy đến đỉnh tường)', 'H + hm', tf(g.yT, 3), 'm') +
    sRow('Chiều sâu chôn móng (tại mũi) Df = ht + hf', 'Df', tf(I.ht + I.hf, 3), 'm') +
    sRow(
      'Chiều cao mặt phẳng tính áp lực đất (mặt phẳng thẳng đứng qua mép gót)',
      "H'",
      tf(g.Hp, 3),
      'm',
    );
  if (rib) h += calcRibDims(P, R as RibCalcResult);

  const modeMap: Record<string, string> = {
    none: 'Mặt đất đắp nằm ngang, ngang đỉnh tường',
    flat: 'Đất đắp cao hơn đỉnh tường, mặt đất nằm ngang (bậc thẳng đứng sau lưng tường)',
  };
  const mode =
    modeMap[P.fillMode || 'none'] ||
    'Mặt đất đắp có mái taluy phía trên đỉnh tường, độ dốc 1 : ' + tf(I.m, 2);

  h += sH2('3.&nbsp;&nbsp;SỐ LIỆU TÍNH TOÁN ĐẦU VÀO');
  h +=
    sH3('3.1. Mặt đất và tải trọng phía sau tường') +
    sTx(mode + '.') +
    sRow(
      'Chiều cao mái taluy phía trên đỉnh tường (0 = mặt đất nằm ngang ngang đỉnh tường)',
      'Hs',
      tf(I.Hs, 3),
      'm',
    ) +
    (I.Hs > 1e-9 && I.m > 1e-9
      ? sRow('Độ dốc mái taluy phía trên đỉnh tường (1 : m)', 'm', tf(I.m, 2), '')
      : '') +
    sRow(
      'Tải trọng chất thêm phân bố đều trên mặt đất đắp (tĩnh tải - ES)',
      'q',
      tf(I.q, 2),
      'kPa',
    ) +
    (I.qL > 1e-9
      ? sRow(
          'Hoạt tải phân bố đều trên mặt đất đắp (xe thi công, người đi bộ - LS)',
          'qL',
          tf(I.qL, 2),
          'kPa',
        )
      : '') +
    sRow('Hoạt tải xe phía sau tường', '', I.LL ? 'Có (HL-93)' : 'Không', '') +
    (I.LL
      ? sRow(
          'Khoảng cách nằm ngang từ mặt sau đỉnh tường đến mép làn xe (khi có mái taluy tính từ đỉnh mái)',
          'd',
          tf(I.dT0, 2),
          'm',
        )
      : '');

  h +=
    sH3('3.2. Đất đắp sau lưng tường') +
    sRow('Trọng lượng riêng đất đắp', 'γs', tf(I.gs, 2), 'kN/m³') +
    sRow('Góc ma sát trong có hiệu của đất đắp', "φ'f", tf(I.phi, 1), 'độ') +
    sRow(
      'Góc ma sát giữa đất đắp và lưng tường đứng (TCVN 11823-3, Bảng 22; dùng khi tính kết cấu tường đứng)',
      'δ',
      tf(I.dw, 1),
      'độ',
    ) +
    sRow(
      'Góc ma sát trên mặt phẳng tính áp lực AT (qua mép gót)' +
        (I.dvA ? ' - lấy bằng góc dốc mặt đất tại mặt phẳng đó (đất - đất)' : ' - nhập'),
      'δAT',
      tf(Ld.dv, 2),
      'độ',
    ) +
    sRow('Lực dính đơn vị của đất đắp trên mặt trượt', "c'", tf(I.cs, 2), 'kPa');

  const iftMap: Record<string, string> = {
    n: 'Mặt bê tông đã đông cứng sạch, không tạo nhám',
    r: 'Mặt bê tông đã đông cứng sạch, tạo nhám biên độ 6 mm',
    m: 'Đổ liền khối',
  };

  h +=
    sH3('3.3. Vật liệu bê tông cốt thép') +
    sRow('Trọng lượng riêng bê tông cốt thép', 'γc', tf(I.gc, 2), 'kN/m³') +
    sRow(
      `Cường độ chịu nén quy định của bê tông ở 28 ngày (mác ${P.concrete})`,
      "f'c",
      tf(I.fc, 1),
      'MPa',
    ) +
    sRow(`Cốt thép ${P.steel}: giới hạn chảy`, 'fy', tf(I.fy, 0), 'MPa') +
    sRow('Kích thước cốt liệu lớn nhất', 'ag', tf(I.ag, 0), 'mm') +
    sRow(
      'Điều kiện tiếp xúc khi kiểm soát nứt (TCVN 11823-5, Điều 7.3.4)',
      'γe',
      tf(I.ge, 2),
      '',
      I.ge >= 1 ? 'Loại 1' : 'Loại 2',
    ) +
    sRow('Chiều dày lớp bê tông bảo vệ cốt thép ngoài cùng', 'c', tf(P.cover * 10, 0), 'mm') +
    (rib
      ? calcRibRebarRows(P, R as RibCalcResult)
      : sRow(
          'Từ mặt bê tông đến tâm thanh dọc chịu lực thân tường (đặt trong thanh ngang): c + Φngang + Φ/2 (mặt sau ; mặt trước)',
          'dc',
          tf(I.cov + I.sbd / 2, 1) + ' ; ' + tf(I.cov + I.sfd / 2, 1),
          'mm',
        ) +
        sRow(
          'Từ mặt bê tông đến tâm cốt thép bản đáy: thớ dưới ; thớ trên',
          'dc',
          tf(I.covB + I.fbd / 2, 1) + ' ; ' + tf(I.covT + I.ftd / 2, 1),
          'mm',
        ) +
        sTx('Cốt thép chủ (đường kính Φ và khoảng cách a):') +
        sRow(
          'Tường đứng - mặt sau (phía đất đắp)',
          'Φ ; a',
          tf(I.sbd, 0) + ' ; ' + tf(I.sbs, 0),
          'mm',
        ) +
        sRow('Tường đứng - mặt trước', 'Φ ; a', tf(I.sfd, 0) + ' ; ' + tf(I.sfs, 0), 'mm') +
        sRow('Bản đáy - mặt trên', 'Φ ; a', tf(I.ftd, 0) + ' ; ' + tf(I.fts, 0), 'mm') +
        sRow('Bản đáy - mặt dưới', 'Φ ; a', tf(I.fbd, 0) + ' ; ' + tf(I.fbs, 0), 'mm') +
        sRow(
          'Cốt thép nằm ngang tường đứng (mỗi mặt)',
          'Φ ; a',
          tf(I.hd, 0) + ' ; ' + tf(I.hs, 0),
          'mm',
        ) +
        sRow(
          'Cốt thép dọc tường của bản đáy (mỗi mặt)',
          'Φ ; a',
          tf(I.ld, 0) + ' ; ' + tf(I.ls, 0),
          'mm',
        ) +
        sRowT('Mối nối thi công chân tường đứng - bản đáy', iftMap[I.ift] || ''));

  h += sH3('3.4. Nền dưới đáy móng');
  if (I.rock) {
    h +=
      sRowT('Loại nền dưới đáy móng', 'Nền đá') +
      sRow(
        'Góc ma sát giữa đáy bản đáy bê tông và đá (dùng khi tính trượt)',
        'φf',
        tf(I.phif, 1),
        'độ',
      );
    if (R.brm === 'cp') {
      h +=
        sRow(
          'Khối đá nền: lực dính ; góc ma sát trong ; trọng lượng riêng',
          'c ; φ ; γ',
          tf(I.cR, 1) + ' ; ' + tf(I.phiR, 1) + ' ; ' + tf(I.gR, 1),
          'kPa ; độ ; kN/m³',
        ) +
        sRow(
          'Hệ số sức kháng chịu tải - phương pháp lý thuyết (TCVN 11823-10, Bảng 8)',
          'φb',
          tf(I.phibR, 2),
          '',
        );
    } else if (R.brm === 'rock') {
      h +=
        sRow('Cường độ chịu nén một trục của mẫu đá nguyên dạng', 'qu', tf(I.qu, 1), 'MPa') +
        sRow('Chỉ số chất lượng khối đá RMR (TCVN 11823-10, Điều 4.6.4)', 'RMR', tf(I.RMR, 0), '') +
        sRowT('Nhóm đá (Bảng 10.4.6.4-4)', CALC_ROCKN[I.rockT] || '') +
        sRow(
          'Hệ số sức kháng chịu tải - móng trên đá (TCVN 11823-10, Bảng 8)',
          'φb',
          tf(I.phibR, 2),
          '',
        );
    } else {
      h += sRow('Sức kháng tính toán của nền theo thí nghiệm', 'qR', tf(I.qRu, 1), 'kPa');
    }

    h += sRowT('Neo thép khoan vào đá', I.anc ? 'Có' : 'Không bố trí');
    if (an && an.dw) {
      h +=
        sRow(
          'Thép neo (chốt) khoan cấy vào đá: đường kính ; giới hạn chảy',
          'Φ ; fy',
          tf(I.ad, 0) + ' ; ' + tf(I.afy, 0),
          'mm ; MPa',
        ) +
        sRow(
          'Chiều dài chốt: trong đá (từ đáy bản đáy, trừ lớp bê tông lót) ; trong bản đáy',
          'Lr ; La',
          tf(I.aLr, 2) + ' ; ' + tf(I.aLc, 2),
          'm',
        ) +
        sRow(
          'Khoảng cách các chốt theo chiều dài tường ; số hàng chốt theo bề rộng bản đáy',
          'sa ; nh',
          tf(I.as, 2) + ' ; ' + an.rows.length,
          'm ; hàng',
        ) +
        sRow(
          'Vị trí các hàng chốt (x tính từ mép mũi)',
          'x',
          I.aX.map((v) => tf(v, 2)).join(' ; '),
          'm',
        ) +
        sRow(
          'Cường độ chịu cắt của chốt τ = κ.fy ; hệ số sức kháng cắt',
          'κ ; φs',
          tf(I.aTv, 2) + ' ; ' + tf(I.phs, 2),
          '',
        );
    } else if (an) {
      h +=
        sRow(
          'Đường kính thanh neo ; giới hạn chảy',
          'Φ ; fy',
          tf(I.ad, 0) + ' ; ' + tf(I.afy, 0),
          'mm ; MPa',
        ) +
        sRow('Đường kính lỗ khoan', 'Dh', tf(I.aDh, 0), 'mm') +
        sRow(
          'Chiều dài neo trong đá (tính từ đáy bản đáy) ; trong bản đáy',
          'Lr ; La',
          tf(I.aLr, 2) + ' ; ' + tf(I.aLc, 2),
          'm',
        ) +
        sRow('Cường độ chịu nén của vữa bơm lỗ khoan', "f'c,v", tf(I.agf, 0), 'MPa') +
        sRow(
          'Cường độ dính bám danh định vữa - đá' +
            (c.tauA === 'tay'
              ? ' (theo thí nghiệm kéo neo)'
              : ' (tham khảo Bảng C11.9.4.2-1, theo nhóm đá)'),
          'τn',
          tf(I.atau, 2),
          'MPa',
        ) +
        sRow('Khoảng cách neo theo chiều dài tường', 'sa', tf(I.as, 2), 'm') +
        sRow(
          'Vị trí các hàng neo (tọa độ x tính từ mép mũi)',
          'x',
          I.aX.map((v) => tf(v, 2)).join(' ; '),
          'm',
        ) +
        sRow(
          'Hệ số ma sát mặt tiếp xúc bê tông - đá khi tính lực kẹp của neo (TCVN 11823-5, Điều 8.4.3)',
          'μ',
          tf(I.amu, 2),
          '',
        ) +
        sRowT('Neo chống lật', I.aOT ? 'Kể lực neo khi kiểm tra lệch tâm' : 'Không kể');
    }
  } else {
    const brmMap: Record<string, string> = {
      lt: 'Lý thuyết theo c, φ (Điều 10.6.3.1.2)',
      spt: 'Theo SPT (Điều 10.6.3.1.3)',
      kt: 'Nhập qR theo thí nghiệm',
    };
    h +=
      sRowT(
        'Loại nền dưới đáy móng',
        I.soil === 'd' ? 'Nền đất dính (sét)' : 'Nền đất rời (cát, sỏi)',
      ) +
      sRow('Trọng lượng riêng đất nền', 'γ', tf(I.gf, 2), 'kN/m³') +
      sRow('Góc ma sát trong của đất nền', 'φf', tf(I.phif, 1), 'độ') +
      sRow('Lực dính của đất nền', 'c', tf(I.cf, 1), 'kPa') +
      (I.soil === 'd'
        ? sRow(
            'Cường độ kháng cắt không thoát nước (đất dính, dùng khi tính trượt)',
            'Su',
            tf(I.Su, 1),
            'kPa',
          )
        : '') +
      (R.W
        ? sRow(
            'Chiều sâu mực nước ngầm tính từ mặt đất phía trước mũi (lấy theo cao độ mực nước phía trước hF, mục 3.5)',
            'Dw',
            tf(R.DwE, 2),
            'm',
          )
        : sRow(
            'Chiều sâu mực nước ngầm tính từ mặt đất phía trước (99 = không có nước ngầm)',
            'Dw',
            tf(I.Dw, 2),
            'm',
          )) +
      sRowT('Cách xác định sức kháng đỡ', brmMap[I.brm] || '');

    if (I.brm === 'lt') {
      h += sRow(
        'Hệ số sức kháng chịu tải - phương pháp lý thuyết (TCVN 11823-10, Bảng 8)',
        'φb',
        tf(I.phib, 2),
        '',
      );
    } else if (I.brm === 'spt') {
      h +=
        sRow('Số búa SPT trung bình tại đáy móng (chưa hiệu chỉnh)', 'N', tf(I.Nspt, 0), 'búa') +
        sRow('Hệ số chiết giảm do tải trọng nghiêng', 'Ri', tf(I.Ri, 2), '') +
        sRow(
          'Hệ số sức kháng chịu tải - phương pháp bán thực nghiệm SPT (Bảng 8)',
          'φb',
          tf(I.phibS, 2),
          '',
        );
    } else {
      h += sRow('Sức kháng tính toán của nền theo thí nghiệm', 'qR', tf(I.qRu, 1), 'kPa');
    }
  }

  h +=
    sRow('Hệ số sức kháng trượt (TCVN 11823-10, Bảng 8)', 'φτ', tf(I.phit, 2), '') +
    sRow('Hệ số điều chỉnh tải trọng η = ηD.ηR.ηI (TCVN 11823-1, Điều 3.2)', 'η', tf(I.eta, 2), '');
  h += calcExtInputs(P, R);

  h += sH2('4.&nbsp;&nbsp;TẢI TRỌNG TÁC DỤNG LÊN TƯỜNG CHẮN');
  h +=
    sTx(
      'Sơ đồ các tải trọng tiêu chuẩn (chưa nhân hệ số) tác dụng lên 1 m dài tường và phản lực nền ở trạng thái sử dụng (SD I); từng thành phần được tính ở các mục nhỏ dưới đây, tổ hợp tải trọng ở mục 5.',
    ) +
    sFig(
      cfLoads(R as never),
      'Sơ đồ tải trọng tiêu chuẩn tác dụng lên tường (mũi tên chỉ chiều và điểm đặt, không vẽ theo tỷ lệ lực; không kể sức kháng bị động của đất trước mũi)',
    );

  let sDC = 0;
  let sEV = 0;
  const nmOf = (l: { nm?: string }) =>
    hasKey && l.nm === 'Bản đáy' ? 'Bản đáy (kể cả chân khay)' : (l.nm || '');
  const Wt = Ld.L.filter((l) => l.ty === 'DC' || l.ty === 'EV').map((l, i) => {
    if (l.ty === 'DC') sDC -= l.Fy;
    else sEV -= l.Fy;
    return [
      String(i + 1) + '. ' + nmOf(l),
      l.ty,
      tf(l.A, 3),
      tf(l.g, 2),
      tf(-l.Fy, 2),
      tf(l.x, 3),
      tf(l.y, 3),
    ];
  });
  Wt.push(['Tổng DC ; tổng EV', '', '', '', tf(sDC, 2) + ' ; ' + tf(sEV, 2), '', '']);

  h +=
    sH3('4.1. Trọng lượng bản thân (DC) và đất đắp trên gót (EV)') +
    sTx(
      'Trọng lượng từng phần bằng diện tích nhân trọng lượng riêng, đặt tại trọng tâm; tọa độ x, y tính từ gốc O (mép trước đáy bản đáy). Đất phủ phía trên mũi không kể đến (có lợi cho ổn định).' +
        (rib
          ? ' Sườn tăng cường tính vào DC theo diện tích mặt cắt đứng nhân hệ số quy đổi ψ (mục 2); khối đất bị sườn chiếm chỗ được trừ khỏi EV (khối lượng âm).'
          : ''),
    ) +
    sFig(cfWeights(R as never), 'Sơ đồ chia khối tính trọng lượng') +
    sTab(
      ['Thành phần', 'Loại', 'Diện tích (m²)', 'γ (kN/m³)', 'Trọng lượng (kN)', 'x (m)', 'y (m)'],
      Wt,
    );

  const coul = I.Hs <= 1e-9 || g.betaV < I.phi ? CALC.coulomb(90, I.phi, Ld.dv, g.betaV) : NaN;
  h +=
    sH3('4.2. Áp lực đất chủ động (EH) - TCVN 11823-3, Điều 11.5.3') +
    sTx(
      `Ổn định tường và sức kháng nền: áp lực đất tính trên mặt phẳng thẳng đứng đi qua mép gót bản đáy (AT), khối đất giữa mặt phẳng này và lưng tường đứng tính vào EV. Góc ma sát trên mặt phẳng AT lấy ${I.dvA ? 'bằng góc dốc mặt đất tại mặt phẳng tính áp lực' : 'theo số liệu nhập'}: δ = ${tf(Ld.dv, 1)}°.`,
    ) +
    sTx(
      I.Hs > 1e-9
        ? `Mặt đất phía sau gãy khúc (${I.m > 1e-9 ? 'mái dốc 1:' + tf(I.m, 2) + ' ' : 'bậc thẳng đứng '}cao ${tf(I.Hs, 2)} m rồi nằm ngang): lực đẩy chủ động xác định bằng phương pháp nêm thử (thử dần mặt trượt phẳng góc ρ, lấy giá trị lớn nhất), cùng giả thiết của lý thuyết Coulomb.`
        : 'Mặt đất nằm ngang: lực đẩy chủ động theo Coulomb; kết quả được kiểm tra lại bằng phương pháp nêm thử.',
    ) +
    sF(
      String.raw`K_a = \dfrac{\sin^2(\theta + \phi'_f)}{\Gamma\,\sin^2\theta\,\sin(\theta - \delta)}\ ;\quad \Gamma = \left[1 + \sqrt{\dfrac{\sin(\phi'_f + \delta)\,\sin(\phi'_f - \beta)}{\sin(\theta - \delta)\,\sin(\theta + \beta)}}\right]^2\quad (\text{PT 3.11.5.3-1, -2})`,
    ) +
    sF(String.raw`P_a = \tfrac12\,K_a\,\gamma_s\,H'^2`) +
    sTab(
      ['Đại lượng', 'Ký hiệu', 'Giá trị', 'Đơn vị'],
      [
        ['Góc mặt phẳng tính áp lực với phương ngang', 'θ', tf(90, 2), 'độ'],
        ['Góc mặt đất tại mặt phẳng tính áp lực', 'β', tf(g.betaV, 2), 'độ'],
        [
          'Góc ma sát trong đất đắp ; góc ma sát trên mặt phẳng AT',
          "φ'f ; δ",
          tf(I.phi, 1) + ' ; ' + tf(Ld.dv, 1),
          'độ',
        ],
        [
          'Hệ số áp lực chủ động Coulomb',
          'Ka',
          Number.isFinite(coul) ? tf(coul, 4) : 'không áp dụng',
          '',
        ],
        ['Góc mặt trượt tới hạn (nêm thử)', 'ρ', tf(w.rho, 2), 'độ'],
        ['Hệ số áp lực tương đương (nêm thử)', 'Ka', tf(w.Ka, 4), ''],
        ['Chiều cao mặt phẳng tính áp lực', "H'", tf(g.Hp, 3), 'm'],
        ['Lực đẩy chủ động', 'Pa', tf(w.P, 2), 'kN'],
        [
          'Thành phần nằm ngang ; thẳng đứng',
          'Pa,h ; Pa,v',
          tf(-w.F[0], 2) + ' ; ' + tf(-w.F[1], 2),
          'kN',
        ],
        ['Điểm đặt (cao hơn đáy bản đáy H\'/3)', '', tf(g.Hp / 3, 3), 'm'],
      ],
    );

  h +=
    sH3(
      '4.3. Tải trọng chất thêm (ES) và hoạt tải chất thêm (LS) - TCVN 11823-3, Điều 11.6.1, 11.6.4',
    ) +
    sTx(
      I.q > 1e-9
        ? `Tải chất thêm phân bố đều q = ${tf(I.q, 2)} kPa trên mặt đất từ ${I.Hs > 1e-9 ? 'đỉnh mái taluy' : 'mép sau đỉnh tường'}: phần nằm trên gót tác dụng thẳng đứng lên gót; phần ngoài mặt phẳng AT gây áp lực ngang, tính bằng nêm thử có kể q.`
        : 'Không có tải chất thêm phân bố đều (q = 0).',
    ) +
    sF(
      String.raw`\Delta p = K_a\,\gamma_s\,h_{eq}\ ;\quad P_{LS} = \Delta p\,H'\quad (\text{PT 3.11.6.4-1})`,
    ) +
    sTx(
      I.qL > 1e-9
        ? `Hoạt tải phân bố đều qL = ${tf(I.qL, 2)} kPa (xe thi công, người đi bộ) xét như hoạt tải chất thêm LS: áp lực ngang tính bằng nêm thử có kể qL, phần nằm trên gót tác dụng thẳng đứng lên gót; hệ số tải trọng của LS.`
        : '',
    ) +
    sTx(
      !I.LL
        ? 'Không có hoạt tải xe phía sau tường: không xét LS.'
        : Ld.lsOn
          ? `Mép làn xe cách lưng tường d = ${tf(I.dT, 2)} m ≤ H'/2: chiều cao đất tương đương heq = ${tf(Ld.heq, 3)} m (Bảng 3.11.6.4-2, nội suy theo H' và d). Lực ngang PLS = ${tf(Ld.PLS, 2)} kN đặt tại H'/2; phần hoạt tải nằm trên gót (từ x = ${tf(Ld.x0, 2)} m đến mép gót) tác dụng thẳng đứng lên gót, chỉ kể khi kiểm tra sức kháng nền và kết cấu (CĐ I-b), không kể khi kiểm tra lệch tâm, trượt (CĐ I-a).`
          : `Mép làn xe cách lưng tường d = ${tf(I.dT, 2)} m > H'/2: không xét LS (Điều 11.6.4).`,
    ) +
    sFig(cfPressure(R as never), 'Áp lực đất trên mặt phẳng tính áp lực AT và trên lưng tường đứng');

  const C0 = g.C0;
  const ex4 = calcExtLoads(P, R);
  h += ex4.h;
  h +=
    sH3(`4.${ex4.n}. Tổng hợp tải trọng chưa nhân hệ số (đối với tâm đáy bản đáy C)`) +
    sTx('C là trung điểm đáy bản đáy. Mômen dương khi làm tường lật về phía trước (phía mũi).') +
    sTab(
      ['Tải trọng', 'Loại', 'V (kN)', 'H (kN)', 'x (m)', 'y (m)', 'MC (kN.m)'],
      Ld.L.map((l) => [
        nmOf(l),
        l.ty,
        tf(-l.Fy, 2),
        tf(-l.Fx, 2),
        tf(l.x, 3),
        tf(l.y, 3),
        tf((l.x - C0[0]) * l.Fy - (l.y - C0[1]) * l.Fx, 2),
      ]),
    );

  const T = [
    'DC',
    'EV',
    'EH',
    'ES',
    'LSh',
    'LSv',
    ...(R.W ? ['WA'] : []),
    ...(R.E ? ['EQ'] : []),
  ] as const;
  const TN: Record<string, string> = {
    DC: 'DC',
    EV: 'EV',
    EH: 'EH',
    ES: 'ES',
    LSh: 'LS (ngang)',
    LSv: 'LS (đứng)',
    WA: 'WA',
    EQ: 'EQ',
  };
  const CLs = R.CL || CALC.COMB;

  h +=
    sH2('5.&nbsp;&nbsp;TỔ HỢP TẢI TRỌNG - TCVN 11823-3, BẢNG 3, BẢNG 4') +
    sTx(
      'CĐ I-a: tải trọng thẳng đứng lấy hệ số nhỏ nhất, tải trọng ngang lớn nhất (kiểm tra lệch tâm, trượt; không kể thành phần đứng của LS). CĐ I-b: các hệ số lớn nhất (kiểm tra sức kháng nền, kết cấu). CĐ I-c: tải đứng lớn nhất, áp lực đất ngang nhỏ nhất (kiểm tra sức kháng nền và bản đáy khi áp lực ngang có lợi). SD I: hệ số 1,0 (kiểm soát nứt; tải trọng không hệ số khi tính hệ số tải trọng nghiêng).' +
        (R.E
          ? ` CĐ ĐB I-a, I-b: tổ hợp Đặc biệt I (động đất) - tải trọng thường xuyên lấy hệ số γp như CĐ I-a, I-b, hoạt tải lấy hệ số γEQ = ${tf(R.E.gq, 2)}, nước WA và động đất EQ lấy hệ số 1,0, η = 1,0.`
          : '') +
        (R.W ? ' Áp lực nước WA lấy hệ số 1,0 (Bảng 3.4.1-1).' : ''),
    ) +
    sTab(
      ['Tổ hợp', ...T.map((t) => TN[t])],
      CLs.map((cb) => {
        const fMap = cb.f as Record<string, number>;
        const mnMap = cb.mn as unknown as Record<string, boolean>;
        return [
          cb.nm,
          ...T.map((t) =>
            tf(cb.sd || cb.noEta ? fMap[t] : mnMap[t] ? fMap[t] / I.eta : fMap[t] * I.eta, 2),
          ),
        ];
      }),
    ) +
    sTab(
      ['Tổ hợp', 'V (kN)', 'H (kN)', 'MC (kN.m)', 'e (m)'],
      R.C.map((cc) => [
        cc.nm,
        tf(cc.V),
        tf(cc.H),
        tf(cc.M),
        tf(cc.e, 3) + (cc.toToe ? ' (phía mũi)' : ' (phía gót)'),
      ]),
    );

  const S2 = R.C.filter((cc) => !cc.sd);
  const HD = ['Đại lượng', 'Ký hiệu', ...S2.map((cc) => cdLab({ k: cc.k, nm: cc.nm })), 'Đơn vị'];
  const rw = (
    lab: string,
    sym: string,
    f: (cc: (typeof S2)[number]) => number | string,
    u: string,
    d = 3,
  ): string[] => [
    lab,
    sym,
    ...S2.map((cc) => {
      const v = f(cc);
      return typeof v === 'string' ? v : tf(v, d);
    }),
    u,
  ];

  h +=
    sH2('6.&nbsp;&nbsp;KIỂM TOÁN ĐỘ LỆCH TÂM - TCVN 11823-11, ĐIỀU 6.3.3') +
    sTx(
      `Móng trên nền ${I.rock ? 'đá: hợp lực nằm trong 9/10 bề rộng đáy (e ≤ 0,45B)' : 'đất: hợp lực nằm trong 2/3 bề rộng đáy (e ≤ B/3)'}.` +
        (R.E
          ? I.rock
            ? ' Tổ hợp Đặc biệt I (động đất): nền đá giữ giới hạn e ≤ 0,45B.'
            : ` Tổ hợp Đặc biệt I (TCVN 11823-11, Điều 6.5.1): hợp lực nằm trong vùng giữa có bề rộng thay đổi tuyến tính từ 2/3B (γEQ = 0) đến 8/10B (γEQ = 1): e ≤ (1/3 + 0,0667γEQ).B = ${tf(R.E.eLimK, 4)}B với γEQ = ${tf(R.E.gq, 2)}.`
          : ''),
    );

  const aOT = an && I.aOT;
  if (aOT) {
    h += sTx(
      'Kể đến lực neo chống lật: các hàng neo nằm ở nửa đáy móng phía đối diện với hợp lực làm việc chịu kéo với sức kháng tính toán Tr (mục 9); lực neo cộng vào lực thẳng đứng tại vị trí hàng neo.',
    );
  }

  h +=
    sTab(HD, [
      rw('Lực thẳng đứng', 'V', (cc) => cc.N, 'kN', 2),
      rw('Mômen đối với tâm C', 'MC', (cc) => cc.M, 'kN.m', 2),
      rw('Độ lệch tâm e = |MC|/V', 'e', (cc) => cc.e, 'm'),
      ...(aOT
        ? [
            rw('Lực neo chống lật ΣTr', 'ΣTr', (cc) => (cc.an ? cc.an.N - cc.N : 0), 'kN', 2),
            rw('Độ lệch tâm khi kể lực neo', "e'", (cc) => (cc.an ? cc.an.e : cc.e), 'm'),
          ]
        : []),
      rw(
        'Giới hạn lệch tâm',
        I.rock ? '0,45B' : R.E ? 'B/3 ; ĐB: ' + tf(R.E.eLimK, 4) + 'B' : 'B/3',
        (cc) => cc.eLim ?? 0,
        'm',
      ),
      rw('Kiểm tra', '', (cc) => sOk(Boolean(cc.okE)), ''),
    ]) +
    sKL(
      R.ok.e,
      'Độ lệch tâm của hợp lực ĐẠT YÊU CẦU.',
      'Độ lệch tâm của hợp lực KHÔNG ĐẠT - cần tăng bề rộng gót hoặc bố trí neo chống lật.',
    );

  h +=
    sH2('7.&nbsp;&nbsp;KIỂM TOÁN TRƯỢT - TCVN 11823-10, ĐIỀU 6.3.4') +
    (an && an.dw
      ? sF(
          String.raw`H \le R_R = \phi_s\,\Sigma A_b\,\kappa f_y\quad (\text{dowel - chốt chịu cắt})`,
        )
      : sF(
          String.raw`H \le R_R = \phi_\tau R_\tau${an ? String.raw` + \mu\,\Sigma T_r` : ''}\quad (\text{PT 10.6.3.4-1})`,
        )) +
    (I.rock
      ? sTx('Nền đá: Rτ = V.tanδ, δ - góc ma sát giữa đáy bản đáy bê tông và đá.')
      : I.soil === 'd'
        ? sF(
            String.raw`R_\tau = \min\left(S_u;\ 0.5\,\sigma'_v\right) B\ ;\quad \sigma'_v = V/B\quad (\text{PT 10.6.3.4-3, -4})`,
          )
        : sF(
            String.raw`R_\tau = V\tan\delta_b\ ;\quad \tan\delta_b = \tan\phi_f\quad (\text{PT 10.6.3.4-2})`,
          )) +
    (an && an.dw
      ? sTx(
          `Lực ngang được truyền xuống nền đá qua các chốt thép khoan cấy cắt qua mặt tiếp xúc đáy móng - đá; sức kháng trượt lấy bằng tổng sức kháng cắt của các chốt (bỏ qua ma sát đáy móng, thiên về an toàn): RR = φs.ΣAb.κ.fy, κ = ${tf(I.aTv, 2)}, φs = ${tf(I.phs, 2)} (tổ hợp Đặc biệt: φ = 1,0).`,
        )
      : an
        ? sTx(
            `Neo thép khoan vào đá cắt qua mặt tiếp xúc đáy móng - đá tạo lực kẹp ép mặt tiếp xúc; phần sức kháng trượt do neo lấy theo cơ chế ma sát cắt (TCVN 11823-5, Điều 8.4.1): μ.ΣTr, trong đó ΣTr là tổng sức kháng kéo tính toán của các thanh neo trên 1 m dài tường (mục 9), μ = ${tf(I.amu, 2)} hệ số ma sát (Điều 8.4.3).`,
          )
        : '') +
    sTx(
      'Bỏ qua sức kháng bị động của đất phía trước mũi' +
        (hasKey ? ' và của chân khay' : '') +
        ' (thiên về an toàn).',
    ) +
    sTab(HD, [
      rw('Lực thẳng đứng', 'V', (cc) => cc.N, 'kN', 2),
      ...(an && an.dw
        ? []
        : [
            rw(
              I.rock || I.soil !== 'd' ? 'Hệ số ma sát' : "Su ; 0,5σ'v",
              I.rock || I.soil !== 'd' ? 'tanδ' : '',
              (cc) =>
                I.rock || I.soil !== 'd'
                  ? Math.tan((I.phif * Math.PI) / 180)
                  : tf(I.Su, 1) + ' ; ' + tf((0.5 * cc.N) / g.B, 1),
              I.soil === 'd' && !I.rock ? 'kPa' : '',
              4,
            ),
          ]),
      ...(an && an.dw
        ? []
        : [
            rw('Sức kháng trượt danh định', 'Rτ', (cc) => cc.sl!.Rt, 'kN', 2),
            rw('Hệ số sức kháng trượt', 'φτ', (cc) => cc.sl!.phiT, '', 2),
          ]),
      ...(an
        ? [
            rw(
              an.dw ? 'Sức kháng cắt của các chốt (φ.ΣAb.κ.fy)' : 'Sức kháng trượt do neo μ.ΣTr',
              '',
              (cc) => cc.sl!.Ra,
              'kN',
              2,
            ),
          ]
        : []),
      rw('Sức kháng trượt tính toán', 'RR', (cc) => cc.sl!.RR, 'kN', 2),
      rw('Lực ngang tính toán', 'H', (cc) => cc.Hd, 'kN', 2),
      rw('Kiểm tra H ≤ RR', '', (cc) => sOk(cc.sl!.ok), ''),
    ]) +
    sKL(
      R.ok.sl,
      'Tường ĐẠT YÊU CẦU về trượt.',
      I.rock
        ? 'Tường KHÔNG ĐẠT về trượt - cần tăng số lượng, đường kính neo hoặc làm răng chống trượt.'
        : 'Tường KHÔNG ĐẠT về trượt - cần tăng bề rộng bản đáy hoặc làm răng chống trượt.',
    );

  const bm = R.brm;
  h +=
    sH2(
      '8.&nbsp;&nbsp;KIỂM TOÁN SỨC KHÁNG ĐỠ CỦA NỀN - TCVN 11823-10, ĐIỀU 6.3.1 (NỀN ĐẤT), ĐIỀU 6.3.2 (NỀN ĐÁ)',
    ) +
    sTx(
      I.rock
        ? 'Móng trên nền đá: ứng suất đáy móng phân bố tuyến tính trên toàn bề rộng B, lấy giá trị lớn nhất σmax (TCVN 11823-11, Điều 6.3.2).'
        : "Móng trên nền đất: ứng suất đáy móng phân bố đều trên bề rộng có hiệu B' = B − 2e (TCVN 11823-11, Điều 6.3.2).",
    ) +
    (I.rock
      ? sF(
          String.raw`e \le \dfrac{B}{6}:\ \sigma_{max} = \dfrac{V}{B}\left(1 + \dfrac{6e}{B}\right)\ ;\quad e > \dfrac{B}{6}:\ \sigma_{max} = \dfrac{2V}{3\,(B/2 - e)}\quad (\text{PT 11.6.3.2-2, -3})`,
        )
      : sF(String.raw`\sigma_V = \dfrac{V}{B'}\ ;\quad B' = B - 2e\quad (\text{PT 11.6.3.2-1})`));

  h += sFig(cfBase(R as never), 'Phân bố ứng suất đáy móng (CĐ I-a, CĐ I-b)');
  if (bm === 'rock') {
    h += sF(
      String.raw`q_R = \phi_b\,q_n\ ;\quad q_n = \left[\sqrt{s} + \sqrt{m\sqrt{s} + s}\right]q_u\ ;\quad m = m_i\,e^{(RMR - 100)/14}\ ;\quad s = e^{(RMR - 100)/6}\quad (\text{Điều 10.6.3.2.2 ; Bảng 10.4.6.4-4})`,
    );
  } else if (bm === 'lt' || bm === 'cp') {
    h +=
      sF(
        String.raw`q_R = \phi_b\,q_n\ ;\quad q_n = c\,N_{cm} + \gamma\,D_f\,N_{qm}\,C_{wq} + 0.5\,\gamma\,B'\,N_{\gamma m}\,C_{w\gamma}\quad (\text{PT 10.6.3.1.2a-1})`,
      ) +
      sTx(
        (bm === 'cp'
          ? `Khối đá nền được đặc trưng bằng lực dính cR = ${tf(I.cR, 1)} kPa, góc ma sát trong φR = ${tf(I.phiR, 1)}°, trọng lượng riêng γR = ${tf(I.gR, 1)} kN/m³ (theo báo cáo khảo sát); sức kháng tính theo lý thuyết sức chịu tải với bề rộng có hiệu B' = B − 2e. `
          : '') +
          'Móng băng (L ≫ B): Sc = Sq = Sγ = 1; tải trọng nghiêng theo phương B: n = 2; dq = 1; H, V là tải trọng không hệ số (SD I).',
      );
  } else if (bm === 'spt') {
    h += sF(
      String.raw`q_R = \phi_b\,q_n\ ;\quad q_n = 3.2\cdot10^{-5}\,N_{corr}\,B'\left(C_{wq} + C_{w\gamma}\dfrac{D_f}{B'}\right)R_i\ (\text{MPa})\quad (\text{PT 10.6.3.1.3-1})`,
    );
  } else {
    h += sTx('Sức kháng đỡ tính toán của nền lấy theo kết quả thí nghiệm.');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const br = (cc: (typeof S2)[number]): any => cc.br;
  const rows8: string[][] = [
    rw('Lực thẳng đứng', 'V', (cc) => cc.N, 'kN', 2),
    rw('Độ lệch tâm', 'e', (cc) => cc.e, 'm'),
    ...(I.rock
      ? [rw('Ứng suất lớn nhất (phân bố tuyến tính)', 'σmax', (cc) => cc.sigB ?? 0, 'kPa', 2)]
      : [
          rw('Bề rộng có hiệu', "B'", (cc) => cc.Bp ?? 0, 'm'),
          rw("Ứng suất thẳng đứng (phân bố đều trên B')", 'σV', (cc) => cc.sigU ?? 0, 'kPa', 2),
        ]),
  ];
  const exp3 = (v: number) => sExp(v, 3);
  if (bm === 'rock') {
    rows8.push(
      rw(
        'Cường độ nén một trục của đá ; RMR ; mi (nhóm ' + I.rockT + ')',
        'qu ; RMR ; mi',
        (cc) => tf(br(cc).qu, 1) + ' ; ' + tf(br(cc).RMR, 0) + ' ; ' + tf(br(cc).mi, 0),
        'MPa ; ; ',
      ),
      rw('Hằng số khối đá', 'm ; s', (cc) => tf(br(cc).m, 4) + ' ; ' + exp3(br(cc).s), ''),
      rw('Sức kháng danh định', 'qn', (cc) => br(cc).qn, 'kPa', 1),
    );
  } else if (bm === 'lt' || bm === 'cp') {
    rows8.push(
      rw(
        'Hệ số khả năng chịu tải (φ = ' + tf(bm === 'cp' ? I.phiR : I.phif, 1) + '°)',
        'Nc ; Nq ; Nγ',
        (cc) => tf(br(cc).F.Nc, 2) + ' ; ' + tf(br(cc).F.Nq, 2) + ' ; ' + tf(br(cc).F.Ng, 2),
        '',
      ),
      rw(
        'Hệ số tải trọng nghiêng',
        'ic ; iq ; iγ',
        (cc) => tf(br(cc).ic, 3) + ' ; ' + tf(br(cc).iq, 3) + ' ; ' + tf(br(cc).ig, 3),
        '',
      ),
      rw(
        'Hệ số mực nước ngầm',
        'Cwq ; Cwγ',
        (cc) => tf(br(cc).Cwq, 2) + ' ; ' + tf(br(cc).Cwg, 2),
        '',
      ),
      rw('Sức kháng danh định', 'qn', (cc) => br(cc).qn, 'kPa', 2),
    );
  } else if (bm === 'spt') {
    rows8.push(
      rw(
        'Số búa SPT ; số búa hiệu chỉnh',
        'N ; Ncorr',
        (cc) => tf(br(cc).N, 0) + ' ; ' + tf(br(cc).Ncorr, 2),
        'búa',
      ),
      rw('Sức kháng danh định', 'qn', (cc) => br(cc).qn, 'kPa', 2),
    );
  }

  rows8.push(
    rw(
      'Hệ số sức kháng',
      'φb',
      (cc) =>
        br(cc).phiE != null
          ? br(cc).phiE
          : bm === 'rock' || bm === 'cp'
            ? I.phibR
            : bm === 'spt'
              ? I.phibS
              : bm === 'lt'
                ? I.phib
                : '-',
      '',
      2,
    ),
    rw('Sức kháng đỡ tính toán', 'qR', (cc) => br(cc).qR, 'kPa', 2),
    rw('Kiểm tra ' + (I.rock ? 'σmax' : 'σV') + ' ≤ qR', '', (cc) => sOk(Boolean(cc.okB)), ''),
  );

  h +=
    sTab(HD, rows8) +
    sKL(
      R.ok.br,
      I.rock ? 'Nền đá ĐẢM BẢO sức kháng đỡ.' : 'Nền đất ĐẢM BẢO sức kháng đỡ.',
      I.rock
        ? 'Nền đá KHÔNG ĐẢM BẢO sức kháng đỡ.'
        : 'Nền đất KHÔNG ĐẢM BẢO sức kháng đỡ - cần mở rộng bản đáy hoặc gia cố nền.',
    );

  let sec = 9;
  if (an && an.dw) {
    h +=
      sH2(`${sec}.&nbsp;&nbsp;KIỂM TOÁN CHỐT THÉP CHỊU CẮT TẠI MẶT TIẾP XÚC ĐÁY MÓNG - NỀN ĐÁ`) +
      sTx(
        `Chốt thép Φ${tf(I.ad, 0)} (fy = ${tf(I.afy, 0)} MPa) khoan cấy vào đá trong lỗ khoan đường kính Dh = ${tf(I.aDh, 0)} mm, bơm vữa xi măng cường độ f'c = ${tf(I.agf, 0)} MPa; chiều dài trong đá Lr = ${tf(I.aLr, 2)} m, chiều dài chôn trong bản đáy La = ${tf(I.aLc, 2)} m. Bố trí ${an.rows.length} hàng chốt tại x = ${an.rows.map((r) => tf(r.x, 2)).join(' ; ')} m, khoảng cách theo chiều dài tường ${tf(I.as, 2)} m (theo bản vẽ).`,
      ) +
      sFig(cfAnchor(R as never), 'Bố trí chốt thép khoan vào nền đá') +
      sTx(
        'Lực ngang tại đáy móng được truyền xuống đá bằng sức kháng cắt của các chốt. Sức kháng cắt của một chốt lấy bằng κ.fy.Ab (κ - tỷ số cường độ cắt/cường độ chảy, lấy theo bảng tính tham khảo), nhân hệ số sức kháng cắt φs; tổ hợp Đặc biệt lấy φs = 1,0.',
      ) +
      sF(String.raw`Q_r = \phi_s\,n\,A_b\,\kappa f_y`) +
      sRow('Diện tích một chốt', 'Ab', tf(an.As, 1), 'mm²') +
      sRow('Cường độ cắt tính toán của thép κ.fy', 'κ.fy', tf(an.tv, 1), 'MPa') +
      sRow('Số chốt trên 1 m dài tường', 'n', tf(an.nT, 3), 'chốt/m') +
      sRow('Sức kháng cắt danh định Qn = n.Ab.κ.fy', 'Qn', tf(an.Qn, 2), 'kN/m') +
      sRow(
        'Sức kháng cắt tính toán Qr = φs.Qn (φs = ' + tf(I.phs, 2) + ')',
        'Qr',
        tf(an.Qd, 2),
        'kN/m',
      ) +
      sTx(
        'Kiểm tra chiều dài chôn chốt: chốt chỉ chịu cắt (không chịu kéo) nên chiều dài chôn lấy theo cấu tạo, không kiểm tra chiều dài phát triển chịu kéo.',
      ) +
      sKL(
        R.ok.sl,
        'Chốt thép ĐẠT YÊU CẦU chịu cắt (xem mục 7).',
        'Chốt thép KHÔNG ĐẠT yêu cầu chịu cắt - tăng số lượng hoặc đường kính chốt.',
      );
    sec++;
  } else if (an) {
    h +=
      sH2(`${sec}.&nbsp;&nbsp;KIỂM TOÁN NEO THÉP KHOAN VÀO NỀN ĐÁ`) +
      sTx(
        `Thanh neo cốt thép Φ${tf(I.ad, 0)} (fy = ${tf(I.afy, 0)} MPa) đặt trong lỗ khoan đường kính Dh = ${tf(I.aDh, 0)} mm, bơm vữa xi măng cường độ f'c = ${tf(I.agf, 0)} MPa; chiều dài neo trong đá Lr = ${tf(I.aLr, 2)} m, chiều dài neo trong bản đáy La = ${tf(I.aLc, 2)} m. Bố trí ${an.rows.length} hàng neo tại x = ${an.rows.map((r) => tf(r.x, 2)).join(' ; ')} m, khoảng cách theo chiều dài tường ${tf(I.as, 2)} m.`,
      ) +
      sFig(cfAnchor(R as never), 'Bố trí neo thép khoan vào nền đá') +
      sTx(
        '<b>a) Sức kháng kéo tính toán của một thanh neo</b> (TCVN 11823-11, Điều 9.4.2 ; hệ số sức kháng theo Điều 5.7: kéo thanh thép thường φs = 0,90; nhổ neo khỏi đá, giá trị dính bám tham khảo φp = 0,50).',
      ) +
      sF(String.raw`T_r = \min\left(\phi_s\,A_s\,f_y\ ;\ \phi_p\,\pi\,D_h\,\tau_n\,L_r\right)`) +
      sRow('Diện tích một thanh neo', 'As', tf(an.As, 1), 'mm²') +
      sRow('Sức kháng kéo của thanh thép φs.As.fy', 'Trs', tf(an.Trs, 2), 'kN') +
      sRow(
        'Cường độ dính bám danh định vữa - đá' +
          (c.tauA === 'tay'
            ? ' (theo thí nghiệm)'
            : ' (tham khảo Bảng C11.9.4.2-1, cận dưới theo loại đá)'),
        'τn',
        tf(I.atau, 2),
        'MPa',
      ) +
      sRow('Sức kháng nhổ neo khỏi đá φp.π.Dh.τn.Lr', 'Trp', tf(an.Trp, 2), 'kN') +
      sRow('Sức kháng kéo tính toán của một thanh neo', 'Tr', tf(an.Tr, 2), 'kN') +
      sRow(
        'Số thanh neo trên 1 m dài tường ; tổng sức kháng',
        'n ; ΣTr',
        tf(an.nT, 3) + ' ; ' + tf(an.sum, 2),
        '; kN',
      ) +
      sTx(
        '<b>b) Chiều dài phát triển của thanh neo</b> (TCVN 11823-5, Điều 11.2.1.1): đoạn neo trong vữa và trong bản đáy không nhỏ hơn chiều dài phát triển cơ bản.',
      ) +
      sF(
        String.raw`l_{db} = \max\left(\dfrac{0.02\,A_b\,f_y}{\sqrt{f'_c}}\ ;\ 0.06\,d_b\,f_y\right)`,
      ) +
      sRow(
        `Chiều dài phát triển trong vữa (f'c = ${tf(I.agf, 0)} MPa) ; chiều dài neo trong đá`,
        'ldb ; Lr',
        tf(an.ldg, 0) + ' ; ' + tf(I.aLr * 1e3, 0),
        'mm',
        sOk(an.okLg),
      ) +
      sRow(
        `Chiều dài phát triển trong bản đáy (f'c = ${tf(I.fc, 0)} MPa) ; chiều dài neo trong bản đáy`,
        'ldb ; La',
        tf(an.ldc, 0) + ' ; ' + tf(I.aLc * 1e3, 0),
        'mm',
        sOk(an.okLc),
      ) +
      sKL(
        Boolean(R.ok.an),
        'Neo thép ĐẠT YÊU CẦU về chiều dài neo.',
        'Neo thép KHÔNG ĐẠT về chiều dài neo - cần tăng chiều dài neo.',
      );
    sec++;
  }

  const ex = calcExtChecks(P, R, sec);
  return { h: h + ex.h, sec: ex.sec };
}

export function calcSheetTailCanti(
  P: EngineProject,
  R: CantiCalcResult,
  secIn: number,
  hIn: string,
): string {
  let sec = secIn;
  let h = hIn;
  const tf = cnf;
  const g = R.g;
  const I = R.I;
  const an = R.an;
  const M = R.M;
  const st = R.st;
  const Sf = R.Sf;

  h +=
    sH2(`${sec}.&nbsp;&nbsp;KIỂM TOÁN TƯỜNG ĐỨNG BTCT - TCVN 11823-5`) +
    sTx(
      `Bê tông f'c = ${tf(I.fc, 1)} MPa, Ec = ${tf(M.Ec, 1)} MPa, β1 = ${tf(M.b1, 3)}; cốt thép fy = ${tf(I.fy, 0)} MPa, Es = 200000 MPa. Tường đứng tính như công xôn ngàm tại đỉnh bản đáy; áp lực đất tác dụng lên lưng tường đứng (mặt phẳng từ chân đến đỉnh lưng tường, góc ma sát đất - tường δ = ${tf(I.dw, 1)}°) tính bằng nêm thử như mục 4.2.`,
    ) +
    sFig(cfRC(R as never), 'Vị trí các mặt cắt kiểm toán và bố trí cốt thép') +
    sH3(`${sec}.1. Mặt cắt 1-1: chân tường đứng (h = ${tf(st.h * 1e3, 0)} mm)`) +
    sTx(
      `Lực đẩy chủ động trên lưng tường đứng Pa = ${tf(st.w.P, 2)} kN (Ka = ${tf(st.w.Ka, 4)}, cao ${tf(st.Hs, 3)} m)${st.PLS > 0 ? `; hoạt tải chất thêm PLS = ${tf(st.PLS, 2)} kN (heq = ${tf(st.heq, 3)} m)` : ''}. Mômen dương gây kéo mặt sau (phía đất đắp).`,
    ) +
    sRC(st.Sb as never, M as never, st.rc as never, ['mặt sau (phía đất đắp)', 'mặt trước']);

  const fc = R.ifc;
  h +=
    sH3(
      `${sec}.2. Ma sát cắt tại mối nối thi công chân tường đứng - đỉnh bản đáy (TCVN 11823-5, Điều 8.4)`,
    ) +
    sF(
      String.raw`V_{ri} = \phi\,V_{ni} \ge V_u\ ;\quad V_{ni} = c\,A_{cv} + \mu\left(A_{vf} f_y + P_c\right) \le \min\left(K_1 f'_c A_{cv}\ ;\ K_2 A_{cv}\right)\quad (\text{PT 8.4.1-1, -2, -3})`,
    ) +
    sTx(
      `Mặt tiếp xúc: ${fc.T.nm} - c = ${tf(fc.T.c, 2)} MPa, μ = ${tf(fc.T.mu, 1)}, K1 = ${tf(fc.T.K1, 2)}, K2 = ${tf(fc.T.K2, 1)} MPa (Điều 8.4.3). Avf: cốt thép đứng hai mặt tường đi qua mối nối; Pc: trọng lượng tường đứng (hệ số 0,9); φ = 0,90.`,
    ) +
    sRow(
      'Diện tích mặt tiếp xúc ; diện tích cốt thép qua mối nối',
      'Acv ; Avf',
      tf(fc.Acv, 0) + ' ; ' + tf(fc.Avf, 1),
      'mm²',
    ) +
    sRow('Lực nén thường xuyên vuông góc mặt tiếp xúc', 'Pc', tf(fc.Pc, 2), 'kN') +
    sRow(
      "c.Acv + μ(Avf.fy + Pc) ; K1.f'c.Acv ; K2.Acv",
      'Vni',
      tf(fc.Vn1, 1) + ' ; ' + tf(fc.Vl1, 1) + ' ; ' + tf(fc.Vl2, 1),
      'kN',
    ) +
    sRow(
      'Sức kháng cắt tính toán ; lực cắt tính toán',
      'Vri ; Vu',
      tf(fc.Vr, 2) + ' ; ' + tf(fc.Vu, 2),
      'kN',
      sOk(fc.ok),
    ) +
    sRow(
      'Cốt thép tối thiểu qua mối nối Avf ≥ 0,35.Acv/fy (Điều 8.4.4)',
      'Avf,min',
      tf(fc.Avmin, 1),
      'mm²',
      sOk(fc.okMin),
    ) +
    sKL(
      R.ok.stem && R.ok.ifc,
      'Tường đứng ĐẠT YÊU CẦU.',
      'Tường đứng KHÔNG ĐẠT - cần tăng chiều dày hoặc cốt thép.',
    );
  sec++;

  const fs = R.toe;
  const hs = R.heel;
  h +=
    sH2(`${sec}.&nbsp;&nbsp;KIỂM TOÁN BẢN ĐÁY BTCT - TCVN 11823-5`) +
    sTx(
      `Phản lực nền phân bố tuyến tính theo tải trọng tính toán (TCVN 11823-10, Điều 6.5): ${sFootPress(fs as never)}.`,
    ) +
    sH3(
      `${sec}.1. Mặt cắt 2-2: mũi bản đáy tại mép trước tường đứng (h = ${tf(I.hm * 1e3, 0)} mm)`,
    ) +
    sTx(
      `Phản lực nền trên mũi trừ trọng lượng bản thân mũi (hệ số 0,9 - có lợi): ${[
        sKeyU(fs as never),
        sKeyE(fs as never),
      ]
        .filter((k): k is NonNullable<typeof k> => Boolean(k))
        .map((k) => {
          const entry = fs[k]!;
          return `${CD_LAB[k]} M = ${tf(entry.Mr, 2)} − ${tf(entry.Md, 2)} = ${tf(entry.M, 2)} kN.m, V = ${tf(entry.V, 2)} kN`;
        })
        .join('; ')} (lực cắt lấy tại mép tường, thiên về an toàn). Mômen dương gây kéo thớ dưới.`,
    ) +
    sRC(Sf as never, M as never, fs.rc as never, ['thớ dưới', 'thớ trên']) +
    sH3(`${sec}.2. Mặt cắt 3-3: gót bản đáy tại mép sau tường đứng (h = ${tf(I.hm * 1e3, 0)} mm)`) +
    sTx(
      `Tải trọng trên gót (bản thân, đất đắp, tải chất thêm, hoạt tải và thành phần đứng của áp lực đất tại mép gót) trừ phản lực nền dưới gót: ${S_KEYS.filter(
        (k) => hs[k],
      )
        .map((k) => `${CD_LAB[k]} M = ${tf(-hs[k]!.M, 2)} kN.m, V = ${tf(hs[k]!.V, 2)} kN`)
        .join('; ')}. Mômen âm gây kéo thớ trên.`,
    ) +
    sRC(Sf as never, M as never, hs.rc as never, ['thớ dưới', 'thớ trên']) +
    sKL(
      R.ok.toe && R.ok.heel,
      'Bản đáy ĐẠT YÊU CẦU.',
      'Bản đáy KHÔNG ĐẠT - cần tăng chiều dày hoặc cốt thép.',
    );
  sec++;

  const sS = R.shS;
  const sF2 = R.shF;
  h +=
    sH2(`${sec}.&nbsp;&nbsp;CỐT THÉP CHỐNG CO NGÓT VÀ NHIỆT ĐỘ - TCVN 11823-5, ĐIỀU 10.8`) +
    sF(
      String.raw`A_s \ge \dfrac{0.75\,b\,h}{2\,(b + h)\,f_y}\ ;\quad 0.233 \le A_s \le 1.27\ (\text{mm}^2/\text{mm})\ ;\quad s \le \min(3h\ ;\ 450\ \text{mm})`,
    ) +
    sTab(
      [
        'Bộ phận',
        'b ; h (mm)',
        'Cốt thép mỗi mặt',
        'As (mm²/mm)',
        'As yêu cầu (mm²/mm)',
        's ; smax (mm)',
        'Kết quả',
      ],
      [
        [
          'Tường đứng - cốt thép nằm ngang',
          tf(g.Hst * 1e3, 0) + ' ; ' + tf(g.tmean * 1e3, 0),
          `Φ${tf(I.hd, 0)} a ${tf(I.hs, 0)}`,
          tf(sS.As, 3),
          tf(sS.req, 3),
          tf(sS.s, 0) + ' ; ' + tf(sS.smax, 0),
          sOk(sS.ok),
        ],
        [
          'Bản đáy - cốt thép dọc tường',
          tf(g.B * 1e3, 0) + ' ; ' + tf(I.hm * 1e3, 0),
          `Φ${tf(I.ld, 0)} a ${tf(I.ls, 0)}`,
          tf(sF2.As, 3),
          tf(sF2.req, 3),
          tf(sF2.s, 0) + ' ; ' + tf(sF2.smax, 0),
          sOk(sF2.ok),
        ],
      ],
    ) +
    sKL(
      R.ok.sh,
      'Cốt thép phân bố ĐẠT YÊU CẦU.',
      'Cốt thép phân bố KHÔNG ĐẠT - cần tăng đường kính hoặc giảm khoảng cách.',
    );
  sec++;

  if (R.fe && !R.fe.err) {
    const oFE = calcFeSheet(P, R, sec);
    h += oFE.h;
    sec = oFE.sec;
  }
  {
    const oFem = calcFemSheet(P, R, sec);
    h += oFem.h;
    sec = oFem.sec;
  }
  {
    const oGs = calcGsSheet(P, R, sec);
    h += oGs.h;
    sec = oGs.sec;
  }
  {
    const oRb = calcRbSheet(P, R, sec);
    h += oRb.h;
    sec = oRb.sec;
  }

  h +=
    sH2(`${sec}.&nbsp;&nbsp;CÁC KIỂM TRA KHÁC`) +
    (R.slope || calcGsOut(P)
      ? ''
      : sTx(
          '- Ổn định tổng thể (TCVN 11823-11, Điều 6.2.3): chưa kiểm tra trong bảng tính này; cần phân tích ổn định mái dốc (cung trượt) khi tường đặt trên sườn dốc hoặc nền yếu.',
        )) +
    sTx(
      I.rock
        ? '- Nền đá có khe nứt nghiêng về phía mặt tự do phải kiểm tra thêm ổn định trượt theo mặt yếu.'
        : '- Lún (TTGH sử dụng, TCVN 11823-10, Điều 6.2): tính riêng khi nền đất dính hoặc có lớp đất yếu.',
    ) +
    (R.E
      ? ''
      : sTx(
          '- Động đất: chưa xét (xét theo TCVN 11823-11, Điều 6.5 và Phụ lục A khi công trình yêu cầu).',
        )) +
    (R.W
      ? ''
      : sTx(
          '- Nước ngầm: chưa xét (không có mực nước sau lưng, dưới đáy móng); khi có nước phải kể áp lực nước, đẩy ngược và kiểm tra xói ngầm.',
        ));
  sec++;

  const SUM: Array<[string, string, boolean | string]> = [
    ['Độ lệch tâm của hợp lực', 'TCVN 11823-11, Điều 6.3.3', R.ok.e],
    ['Trượt theo đáy móng', 'TCVN 11823-10, Điều 6.3.4', R.ok.sl],
    ['Sức kháng đỡ của nền', 'TCVN 11823-10, Điều 6.3.1, 6.3.2', R.ok.br],
    ...(an && !an.dw
      ? [['Chiều dài neo thép vào đá', 'TCVN 11823-5, Điều 11.2.1.1', Boolean(R.ok.an)] as [string, string, boolean]]
      : []),
    ...calcExtSum(R),
    ['Tường đứng: uốn, cốt thép tối thiểu, nứt, cắt', 'TCVN 11823-5, Điều 7.3, 8.3', R.ok.stem],
    ['Ma sát cắt mối nối chân tường', 'TCVN 11823-5, Điều 8.4', R.ok.ifc],
    ['Bản đáy - mũi: uốn, cốt thép tối thiểu, nứt, cắt', 'TCVN 11823-5, Điều 7.3, 8.3', R.ok.toe],
    ['Bản đáy - gót: uốn, cốt thép tối thiểu, nứt, cắt', 'TCVN 11823-5, Điều 7.3, 8.3', R.ok.heel],
    ['Cốt thép co ngót và nhiệt độ', 'TCVN 11823-5, Điều 10.8', R.ok.sh],
  ];

  h +=
    sH2(`${sec}.&nbsp;&nbsp;TỔNG HỢP KẾT QUẢ KIỂM TOÁN`) +
    sTab(
      ['STT', 'Hạng mục kiểm toán', 'Căn cứ', 'Kết quả'],
      SUM.map((r, i) => [
        String(i + 1),
        r[0],
        r[1],
        typeof r[2] === 'boolean' ? sOk(r[2]) : r[2],
      ]),
      ['c', 'l', 'l', 'c'],
    ) +
    `<p class="kl ${R.ok.all ? 'ok' : 'bad'}">KẾT LUẬN CHUNG: ${R.ok.all ? 'TƯỜNG CHẮN ĐẠT YÊU CẦU THEO TẤT CẢ CÁC HẠNG MỤC KIỂM TOÁN.' : 'TƯỜNG CHẮN KHÔNG ĐẠT - XEM CÁC HẠNG MỤC KHÔNG ĐẠT Ở BẢNG TRÊN.'}</p>`;

  return h;
}

export function calcRbSchedule(P: EngineProject): CalcRbScheduleResult {
  const res = buildBars(P);
  const q = quantities(P, res);
  const Lum = Math.max(P.Lu, 1) / 100;
  const rows: Omit<CalcRbScheduleRow, 'keys'>[] = res.bars
    .filter((b) => !b.pile && b.items && b.items.length && b.d > 0)
    .map((b) => {
      const w = unitW(b.d);
      const A1 = (Math.PI * b.d * b.d) / 400;
      const ba = b.a ?? 0;
      const a = ba > 0 ? ba * 10 : 0;
      const L = b.items.reduce((t, v) => t + v, 0) / b.items.length / 1e3;
      const spaced = a > 0 && Array.isArray(b.pos) && b.pos.length > 0;
      const n = spaced ? ((b.items.length / b.pos!.length) * 1e3) / a : b.items.length / Lum;
      return {
        key: b.key,
        mark: String(b.mark),
        name: b.name,
        d: b.d,
        a,
        n,
        L,
        As: a > 0 && !b.tie && !b.A ? (1e3 / a) * A1 : null,
        kg: n * L * w,
        spaced,
      };
    });

  const kg = rows.reduce((t, r) => t + r.kg, 0);
  const vol = q.vol / Lum;
  const rows2: CalcRbScheduleRow[] = [];
  rows.forEach((r) => {
    const m = rows2.find(
      (x) =>
        x.mark === r.mark &&
        x.name === r.name &&
        x.d === r.d &&
        x.a === r.a &&
        Math.abs(x.L - r.L) < 5e-4,
    );
    if (m) {
      m.n += r.n;
      m.kg += r.kg;
      m.keys.push(r.key);
    } else {
      rows2.push(Object.assign({ keys: [r.key] }, r));
    }
  });

  return { res, rows: rows2, Lum, kg, vol, ratio: vol > 0 ? kg / vol : 0 };
}

export function calcRbOk(R: CalcValidResult): boolean {
  const k = R.ok;
  let base: boolean;
  if (R.model === 'rib') {
    const rk = (R as RibCalcResult).ok;
    base = Boolean(rk.stem && rk.rib && rk.tie && rk.toe && rk.heel && rk.sh);
  } else {
    const ck = (R as CantiCalcResult).ok;
    base = Boolean(ck.stem && ck.ifc && ck.toe && ck.heel && ck.sh);
  }
  return Boolean(
    base &&
      (!R.an || R.an.dw || k.an !== false) &&
      !(R.fe && !R.fe.err && R.fe.basis === 'fe' && R.fe.ok === false),
  );
}

export function calcRbSheet(
  P: EngineProject,
  R: CalcValidResult,
  sec: number,
): { h: string; sec: number } {
  const tf = cnf;
  const S = calcRbSchedule(P);
  const rows = S.rows;
  const nm = (t: number) => (sec ? `${sec}.${t}. ` : '');
  const ok = calcRbOk(R);

  let h = sH2(
    `${sec ? sec + '.&nbsp;&nbsp;' : ''}BỐ TRÍ CỐT THÉP VÀ THỐNG KÊ KHỐI LƯỢNG CHO 1 M DÀI TƯỜNG`,
  );
  h += sTx(
    `Cốt thép lấy đúng theo bản vẽ (cùng một số liệu Φ, a với mục nhập cốt thép của tab Bản vẽ và tab Tính toán). Chiều dày lớp bê tông bảo vệ (đến mặt thanh ngoài cùng): c = ${tf(P.cover * 10, 0)} mm. Số trong ngoặc là mác thép của bản vẽ.`,
  );
  h += sFig(
    cfRbScheme(P as never, R as never, S.res as never),
    'Sơ đồ bố trí cốt thép chính trên mặt cắt ngang (mác thép, đường kính Φ và khoảng cách a theo bảng thống kê)',
  );
  h += sH3(nm(1) + 'Diễn giải bố trí');
  rows.forEach((r) => {
    h += sTx(
      `- (${r.mark}) ${r.name}: bố trí đường kính Φ${tf(r.d, 0)}${r.a > 0 ? ' khoảng cách a' + tf(r.a, 0) + ' mm' : ''}, chiều dài mỗi thanh ${tf(r.L, 2)} m.`,
    );
  });

  h +=
    sH3(nm(2) + 'Bảng thống kê chi tiết cốt thép (cho 1 m dài tường)') +
    sTab(
      [
        'Vị trí cốt thép',
        'Đường kính Ø (mm)',
        'Khoảng cách a (mm)',
        'Số lượng (thanh/m)',
        'Chiều dài thanh (m)',
        'As bố trí (cm²/m)',
        'Khối lượng thép (kg/m)',
      ],
      rows
        .map((r) => [
          `(${r.mark}) ${r.name}`,
          tf(r.d, 0),
          r.a > 0 ? tf(r.a, 0) : '–',
          tf(r.n, 2),
          tf(r.L, 2),
          r.As == null ? '–' : tf(r.As, 2),
          tf(r.kg, 2),
        ])
        .concat([['<b>Tổng cộng</b>', '', '', '', '', '', `<b>${tf(S.kg, 2)}</b>`]]),
      ['l', 'c', 'c', '', '', '', ''],
    ) +
    sRow('Khối lượng cốt thép trên 1 m dài tường', 'Gs', tf(S.kg, 2), 'kg/m') +
    sRow('Thể tích bê tông trên 1 m dài tường', 'Vc', tf(S.vol, 3), 'm³/m') +
    sRow('Hàm lượng cốt thép', 'μ', tf(S.ratio, 1), 'kg/m³') +
    sTx(
      `Ghi chú: thép rải đều theo chiều dài tường có số lượng 1000/a thanh trên 1 m; thép chạy dọc tường, thép sườn, thép neo và các thanh đặt ở đầu đơn nguyên tính trung bình trên chiều dài đơn nguyên Lu = ${tf(S.Lum, 2)} m (số thanh chia Lu). As = 1000/a × diện tích một thanh (một lớp hoặc một mặt, theo phương rải thép). Khối lượng = số lượng × chiều dài × khối lượng đơn vị (7850 kg/m³); bảng thống kê khối lượng của bản vẽ tính cho cả đơn nguyên, kể cả thanh đầu mút nên lớn hơn chút.`,
    ) +
    sKL(
      ok,
      'Bố trí cốt thép thỏa mãn điều kiện an toàn chịu lực của các mặt cắt kiểm toán (uốn, cốt thép tối thiểu, nứt, cắt, ma sát cắt, cốt thép chống co ngót).',
      'Bố trí cốt thép CHƯA thỏa mãn điều kiện an toàn ở một số mặt cắt - xem các mục kiểm toán ở trên, điều chỉnh Φ, a hoặc dùng nút "Áp dụng" ở mục Cốt thép & đề xuất (tab Tính toán).',
    );

  return { h, sec: sec ? sec + 1 : 0 };
}

export function calcRbView(P: EngineProject, R: CalcValidResult): string {
  const dec = (P.calc && P.calc.dec) === ',' ? ',' : '.';
  setReportDec(dec);
  setEngineCalcDec(dec);
  resetReportFigCounter(0);
  return calcRbSheet(P, R, 0).h;
}

export function calcSheetCanti(P: EngineProject, R: CantiCalcResult): string {
  const o = calcSheetHead(P, R);
  return calcSheetTailCanti(P, R, o.sec, o.h);
}

export function calcSheetHTML(
  P: EngineProject,
  R: CalcRunResult | null | undefined,
): string {
  const dec = (P.calc && P.calc.dec) === ',' ? ',' : '.';
  setReportDec(dec);
  setEngineCalcDec(dec);
  resetReportFigCounter(0);
  setFemSecNo(0);
  setGsSecNo(0);
  if (!R || R.error) {
    return `<p class="kl bad">Không tính được: ${R && R.error ? R.error : ''}</p>`;
  }
  if ('unsupported' in R && R.unsupported) {
    return `<p class="small">${R.msg}</p>`;
  }
  const Rv = R as CalcValidResult;
  if (Rv.model === 'canti') {
    return calcSheetCanti(P, Rv as CantiCalcResult);
  }
  return calcSheetRib(P, Rv as RibCalcResult);
}
