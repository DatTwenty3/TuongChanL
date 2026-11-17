import {
  BANG8,
  CAP_DUONG_38_OPTIONS,
  F_TYPES,
  G_KINDS,
  LOAI_MAT_38_OPTIONS,
  calcRigid,
  fmt,
  fmtExp,
  fmtI,
  log10,
  snEquationLHS,
  type FlexResolvedInput,
  type FlexTC1Result,
  type FlexTC2Row,
  type FlexTC3Row,
  type RigidInput,
  type RigidResult,
  type RigidTrafficInputs,
  type Sn37LowResult,
  type Sn37NewResult,
  type Sn37OverlayResult,
} from '../engine';

export function buildRigidWordDoc(I: RigidInput, R: RigidResult, tr: RigidTrafficInputs): string {
  const m1 = I.model === 1;
  const P = (x: number, d = 3) => fmt(x, d);
  const layerRows = I.layers
    .filter((l) => l.h > 0)
    .map((l, i) => `<tr><td>Lớp hạt ${i + 1}: ${l.name}</td><td class=n>E=${fmtI(l.E)} MPa; h=${P(l.h, 3)} m</td></tr>`)
    .join('');
  const inpTable = `<table class=t>
   <tr><td>Cấp hạng đường</td><td class=n>${I.cap}</td></tr>
   <tr><td>Mô hình tính</td><td class=n>MH${I.model} – ${m1 ? 'tấm một lớp (Điều 8.3)' : 'tấm hai lớp tách rời (Điều 8.4)'}</td></tr>
   <tr><td>Chiều dày tấm BTXM h<sub>c</sub></td><td class=n>${P(I.hc * 100, 1)} cm</td></tr>
   <tr><td>Kích thước tấm L × B</td><td class=n>${P(I.L, 2)} × ${P(I.B, 2)} m</td></tr>
   <tr><td>Cường độ kéo uốn TK f<sub>r</sub></td><td class=n>${P(I.fr, 2)} MPa</td></tr>
   <tr><td>Mô đun đàn hồi BTXM E<sub>c</sub></td><td class=n>${fmtI(I.Ec)} MPa (μ<sub>c</sub>=${P(I.muc, 2)})</td></tr>
   <tr><td>Hệ số dãn nở nhiệt α<sub>c</sub></td><td class=n>${I.ac.toExponential(2).replace('.', ',')} 1/°C</td></tr>
   <tr><td>Gradien nhiệt T<sub>g</sub></td><td class=n>${I.Tg} °C/m</td></tr>
   <tr><td>Tải trọng trục P<sub>s</sub> / P<sub>max</sub></td><td class=n>${I.Ps} / ${I.Pmax} kN</td></tr>
   <tr><td>Số trục tích lũy N<sub>e</sub></td><td class=n>${fmtI(I.Ne)} lần</td></tr>
   <tr><td>Hệ số k<sub>r</sub> / k<sub>c</sub> / γ<sub>r</sub></td><td class=n>${P(I.kr, 2)} / ${P(I.kc, 2)} / ${P(I.gr, 2)}</td></tr>
   <tr><td>Mô đun nền đất E<sub>0</sub></td><td class=n>${fmtI(I.E0)} MPa</td></tr>
   ${I.Eb > 0 ? `<tr><td>Móng trên bó (${I.matBound})</td><td class=n>E<sub>b</sub>=${fmtI(I.Eb)} MPa; h<sub>b</sub>=${P(I.hb, 3)} m; μ<sub>b</sub>=${P(I.mub, 2)}</td></tr>` : ''}
   ${layerRows}
  </table>`;
  const vd = (name: string, lhs: number, op: string, rhs: number, pass: boolean, na: boolean) =>
    `<tr><td>${name}</td><td class=n>${na ? '—' : P(lhs, 3)}</td><td class=c>${op}</td><td class=n>${na ? '—' : P(rhs, 2)}</td><td class=c style="font-weight:700;color:${na ? '#777' : pass ? '#1c7a45' : '#c0392b'}">${na ? 'Không xét' : pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}</td></tr>`;
  const ok = R.p1 && R.p2 && R.p3;
  const Psv = I.Ps || 100;
  const grw = tr.grow / 100;
  const adttlan = tr.adtt * tr.fhuong * tr.flan;
  const sm = tr.spec.reduce((a, s) => a + (Math.pow(s.P / Psv, 16) * s.p) / 100, 0);
  const Ns1 = adttlan * (tr.naxle / 3000) * sm;
  const NeV = grw > 0 ? Ns1 * 365 * ((Math.pow(1 + grw, tr.tyear) - 1) / grw) * tr.eta : Ns1 * 365 * tr.tyear * tr.eta;
  const specRows = tr.spec
    .map(
      (s) =>
        `<tr><td class=n>${s.P}</td><td class=n>${s.p}</td><td class=n>${P(Math.pow(s.P / Psv, 16), 2)}</td><td class=n>${P((Math.pow(s.P / Psv, 16) * s.p) / 100, 3)}</td></tr>`,
    )
    .join('');
  const neSec = `<h2>Phụ lục A. Xác định N<sub>e</sub> theo lưu lượng</h2>
   <p class=fx>ADTT<sub>làn</sub> = ADTT·f<sub>hướng</sub>·f<sub>làn</sub> = ${tr.adtt}·${P(tr.fhuong, 2)}·${P(tr.flan, 2)} = <b>${P(adttlan, 1)}</b> xe/ng·làn</p>
   <table class=t><tr><td><b>P<sub>i</sub> (kN)</b></td><td class=n><b>p<sub>i</sub> (%)</b></td><td class=n><b>k<sub>ni</sub>=(P<sub>i</sub>/P<sub>s</sub>)¹⁶</b></td><td class=n><b>k<sub>ni</sub>·p<sub>i</sub>/100</b></td></tr>${specRows}<tr><td colspan=3 style="text-align:right"><b>Σ(k<sub>ni</sub>·p<sub>i</sub>)</b></td><td class=n><b>${P(sm, 3)}</b></td></tr></table>
   <p class=fx>N<sub>s</sub>¹ = ADTT<sub>làn</sub>·(n/3000)·Σ = ${P(adttlan, 1)}·(${tr.naxle}/3000)·${P(sm, 3)} = <b>${P(Ns1, 2)}</b> trục/ng·làn <span class=eq>(A.2)</span></p>
   <p class=fx>N<sub>e</sub> = N<sub>s</sub>¹·365·[(1+g<sub>r</sub>)<sup>t</sup>−1]/g<sub>r</sub>·η = <b>${fmtI(NeV)}</b> lần <span class=eq>(A.3)</span></p>`;
  let swRows = '';
  let minH: number | null = null;
  for (let hh = 0.18; hh <= 0.321; hh += 0.02) {
    const hc = Math.round(hh * 100) / 100;
    const RR = calcRigid({ ...I, hc });
    const okk = RR.p1 && RR.p2 && RR.p3;
    if (okk && minH === null) minH = hc;
    swRows += `<tr><td class=n>${P(hc * 100, 1)}</td><td class=n>${P(RR.c1, 3)}</td><td class=n>${P(RR.c2, 3)}</td><td class=c style="color:${okk ? '#1c7a45' : '#c0392b'}">${okk ? 'ĐẠT' : 'KHÔNG ĐẠT'}</td></tr>`;
  }
  const swSec = `<h2>Phụ lục B. Dò chiều dày tấm tối thiểu</h2>
   <p>Giữ nguyên các thông số khác, thay đổi chiều dày tấm h<sub>c</sub>:</p>
   <table class=t><tr><td><b>h<sub>c</sub> (cm)</b></td><td class=n><b>(8-1)</b></td><td class=n><b>(8-2)</b></td><td class=c><b>Kết luận</b></td></tr>${swRows}</table>
   <p><b>Chiều dày tấm tối thiểu đạt yêu cầu: ${minH ? P(minH * 100, 1) + ' cm' : '&gt; 32 cm'}</b> (cần tăng thêm 6 mm dự phòng mài mòn – Điều 4.2.2).</p>`;

  return `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
  <head><meta charset='utf-8'><title>Thuyết minh</title>
  <style>
   body{font-family:'Times New Roman',serif;font-size:13pt;line-height:1.4;color:#111}
   h1{font-size:15pt;text-align:center;text-transform:uppercase} h2{font-size:13pt;color:#163f5e;border-bottom:1px solid #163f5e;padding-bottom:2px}
   .sub{text-align:center;font-style:italic;font-size:11pt;margin-top:-6px}
   table.t{border-collapse:collapse;width:100%;margin:6px 0} table.t td{border:1px solid #999;padding:4px 8px;font-size:12pt;vertical-align:top}
   td.n{text-align:right;font-family:'Consolas',monospace} td.c{text-align:center}
   .step{margin:4px 0 8px 6px} .fx{font-family:'Cambria Math','Times New Roman';font-size:12.5pt} .res{font-weight:700}
   .eq{color:#666;font-style:italic;font-size:10.5pt}
   .verdict{font-size:13.5pt;font-weight:700;text-align:center;padding:8px;margin-top:8px;border:2px solid ${ok ? '#1c7a45' : '#c0392b'};color:${ok ? '#1c7a45' : '#c0392b'}}
  </style></head><body>
  <h1>Thuyết minh tính toán kết cấu mặt đường bê tông xi măng</h1>
  <p class=sub>Theo TCCS 39:2022/TCĐBVN – Công trình: ${I.cap}</p>
  <h2>I. Số liệu tính toán đầu vào</h2>${inpTable}
  <h2>II. Cơ sở & phương pháp tính</h2>
  <p>Kết cấu được kiểm toán theo ${m1 ? '<b>mô hình tấm một lớp trên nền đàn hồi nhiều lớp</b> (Điều 8.3)' : '<b>mô hình tấm hai lớp tách rời trên nền đàn hồi nhiều lớp</b> (Điều 8.4)'}, tại vị trí giữa cạnh dọc tấm (Điều 8.2.5), theo các trạng thái giới hạn (Điều 8.2.2):</p>
  <p class=fx>(6): γ<sub>r</sub>(σ<sub>pr</sub>+σ<sub>tr</sub>) ≤ f<sub>r</sub> &nbsp;&nbsp; (7): γ<sub>r</sub>(σ<sub>pmax</sub>+σ<sub>tmax</sub>) ≤ f<sub>r</sub> &nbsp;&nbsp; (8): γ<sub>r</sub>·σ<sub>bpr</sub> ≤ f<sub>br</sub></p>
  <h2>III. Trình tự tính toán</h2>
  <div class=step><b>1. Mô đun nền tương đương E<sub>t</sub></b> <span class=eq>(12)–(15)</span><br>
   <span class=fx>E<sub>x</sub> = Σ(h<sub>i</sub>²E<sub>i</sub>)/Σ(h<sub>i</sub>²) = <span class=res>${P(R.Ex, 1)}</span> MPa; &nbsp; h<sub>x</sub> = ${P(R.hx, 3)} m; &nbsp; α = 0,86+0,26·ln(h<sub>x</sub>) = ${P(R.alpha, 4)}</span><br>
   <span class=fx>E<sub>t</sub> = (E<sub>x</sub>/E<sub>0</sub>)<sup>α</sup>·E<sub>0</sub> = (${P(R.Ex, 0)}/${fmtI(I.E0)})<sup>${P(R.alpha, 3)}</sup>·${fmtI(I.E0)} = <span class=res>${P(R.Et, 2)}</span> MPa</span></div>
  <div class=step><b>2. Độ cứng & bán kính độ cứng</b> <span class=eq>(11),(25)</span><br>
   <span class=fx>D<sub>c</sub> = E<sub>c</sub>h<sub>c</sub>³/[12(1-μ<sub>c</sub>²)] = <span class=res>${P(R.Dc, 3)}</span> MN·m${I.Eb > 0 ? `; &nbsp; D<sub>b</sub> = E<sub>b</sub>h<sub>b</sub>³/[12(1-μ<sub>b</sub>²)] = <span class=res>${P(R.Db, 3)}</span> MN·m` : ''}</span><br>
   <span class=fx>${m1 ? `r = 1,21(D<sub>c</sub>/E<sub>t</sub>)<sup>1/3</sup> = <span class=res>${P(R.r, 4)}</span> m` : `r<sub>g</sub> = 1,21[(D<sub>c</sub>+D<sub>b</sub>)/E<sub>t</sub>]<sup>1/3</sup> = <span class=res>${P(R.rg, 4)}</span> m`}</span></div>
  <div class=step><b>3. Ứng suất do tải trọng xe</b> <span class=eq>${m1 ? '(10),(11),(20)' : '(10),(25),(20)'}</span><br>
   <span class=fx>k<sub>f</sub> = N<sub>e</sub><sup>0,057</sup> = ${P(R.kf, 4)}; &nbsp; σ<sub>ps</sub> = ${P(m1 ? R.sps1 : R.sps2, 3)} MPa; &nbsp; σ<sub>pm</sub> = ${P(m1 ? R.spm1 : R.spm2, 3)} MPa</span><br>
   <span class=fx>σ<sub>pr</sub> = k<sub>r</sub>k<sub>f</sub>k<sub>c</sub>σ<sub>ps</sub> = <span class=res>${P(R.spr, 3)}</span> MPa; &nbsp; σ<sub>pmax</sub> = k<sub>r</sub>k<sub>c</sub>σ<sub>pm</sub> = <span class=res>${P(R.spmax, 3)}</span> MPa</span></div>
  <div class=step><b>4. Ứng suất do gradien nhiệt</b> <span class=eq>${m1 ? '(21)–(24)' : '(21),(22),(24),(28)'}</span><br>
   <span class=fx>t = L/(3${m1 ? 'r' : 'r<sub>g</sub>'}) = ${P(R.t, 4)}; ${m1 ? '' : `k<sub>n</sub>=${P(R.kn, 1)} MPa/m; r<sub>β</sub>=${P(R.rb, 4)}; ζ=${P(R.zeta, 4)}; `}C<sub>L</sub> = ${P(R.CL, 4)}; B<sub>L</sub> = ${P(R.BL, 4)}</span><br>
   <span class=fx>σ<sub>tmax</sub> = α<sub>c</sub>h<sub>c</sub>E<sub>c</sub>T<sub>g</sub>/2·B<sub>L</sub> = <span class=res>${P(R.stmax, 3)}</span> MPa; &nbsp; k<sub>t</sub> = ${P(R.kt, 4)}; &nbsp; σ<sub>tr</sub> = k<sub>t</sub>σ<sub>tmax</sub> = <span class=res>${P(R.str, 3)}</span> MPa</span></div>
  ${R.Db > 0 ? `<div class=step><b>5. Ứng suất đáy móng bó</b> <span class=eq>(26),(27)</span><br><span class=fx>σ<sub>bps</sub> = ${P(R.sbps, 3)} MPa; &nbsp; σ<sub>bpr</sub> = k<sub>f</sub>k<sub>c</sub>σ<sub>bps</sub> (k<sub>f</sub>=N<sub>e</sub><sup>0,065</sup>) = <span class=res>${P(R.sbpr, 3)}</span> MPa</span></div>` : ''}
  <h2>IV. Kiểm toán trạng thái giới hạn</h2>
  <table class=t><tr><td><b>Điều kiện</b></td><td class=n><b>Vế trái (MPa)</b></td><td class=c></td><td class=n><b>Vế phải (MPa)</b></td><td class=c><b>Kết luận</b></td></tr>
   ${vd('(6)/(8-1): γ<sub>r</sub>(σ<sub>pr</sub>+σ<sub>tr</sub>) ≤ f<sub>r</sub>', R.c1, '≤', I.fr, R.p1, false)}
   ${vd('(7)/(8-2): γ<sub>r</sub>(σ<sub>pmax</sub>+σ<sub>tmax</sub>) ≤ f<sub>r</sub>', R.c2, '≤', I.fr, R.p2, false)}
   ${vd('(8)/(8-3): γ<sub>r</sub>·σ<sub>bpr</sub> ≤ f<sub>br</sub>', R.c3, '≤', I.fbr, R.p3, !R.app3)}
  </table>
  <h2>V. Kết luận</h2>
  <div class=verdict>${ok ? 'KẾT CẤU MẶT ĐƯỜNG BTXM ĐẠT YÊU CẦU theo TCCS 39:2022' : 'KẾT CẤU KHÔNG ĐẠT – Cần điều chỉnh chiều dày tấm hoặc cấu tạo móng'}</div>
  ${neSec}
  ${swSec}
  <p style="font-size:10.5pt;font-style:italic;margin-top:14px;color:#555">Ghi chú: Chiều dày tầng mặt cần tăng thêm 6 mm dự phòng mài mòn (Điều 4.2.2). Thuyết minh do công cụ tính lập tự động theo TCCS 39:2022/TCĐBVN.</p>
  </body></html>`;
}

export function buildFlexWordDoc(
  I: FlexResolvedInput,
  tc1: FlexTC1Result,
  tc2: FlexTC2Row[],
  tc3: FlexTC3Row[],
): string {
  const P = (x: number, d = 3) => fmt(x, d);
  const okAll = tc1.pass && tc2.every((r) => r.pass) && tc3.every((r) => r.pass);
  const Ktr = BANG8[I.dotincay].kutr;
  const capLabel = CAP_DUONG_38_OPTIONS.find((o) => o.value === I.capDuong)?.label || I.capDuong;
  const matLabel = LOAI_MAT_38_OPTIONS.find((o) => o.value === I.loaiMat)?.label || I.loaiMat;

  const gtbl = (rows: Array<[string, string]>) =>
    `<table class=t>${rows.map((r) => `<tr><td>${r[0]}</td><td class=n>${r[1]}</td></tr>`).join('')}</table>`;
  const inpTable1 = gtbl([
    ['Cấp đường', capLabel],
    ['Loại tầng mặt', matLabel],
    ['Độ tin cậy thiết kế (Bảng 7)', I.dotincay],
    ['Tải trọng trục tính toán tiêu chuẩn', `${I.traf.Ptt} kN`],
    ['Đường kính vệt bánh xe tính toán, D', `${I.D} cm`],
    ['Áp lực tính toán tiêu chuẩn, p', `${P(I.p, 2)} MPa`],
    ['Mô đun đàn hồi nền đường – tính võng, E₀', `${fmtI(I.E0v)} MPa`],
    ['Mô đun đàn hồi nền đường – tính trượt, E₀', `${fmtI(I.E0t)} MPa`],
    ['Lực dính / góc ma sát nền đất, C – φ', `${P(I.C0, 3)} MPa – ${I.phi0}°`],
    [
      'Mô đun đàn hồi yêu cầu, Eyc = max(Bảng 9, Bảng 10)',
      `${P(tc1.Eyc, 0)} MPa (Bảng 9: ${P(tc1.EycTab, 0)}; Bảng 10: ${P(tc1.EycMin, 0)})`,
    ],
    ['Hệ số cường độ về độ võng (Bảng 8), Kcd^dv', P(tc1.Kdv, 3)],
    ['Hệ số cường độ về kéo uốn (Bảng 8), Kcd^ku', P(BANG8[I.dotincay].kutr, 3)],
    ['Hệ số cường độ về cắt trượt (Bảng 8), Kcd^tr', P(Ktr, 3)],
    ['Lưu lượng trục tính toán, Ntt', `${fmtI(I.traf.Ntt)} trục/ngđ/làn`],
    [`Số trục xe tiêu chuẩn tích luỹ, Ne (t = ${P(I.traf.t, 0)} năm)`, `${fmtExp(I.traf.Ne, 3)} trục`],
  ]);

  const layersBU = [...I.layers].reverse();
  const layerRows2 = layersBU
    .map(
      (l) => `<tr><td>${l.name}</td><td class=c>${F_TYPES[l.type].label}</td>
     <td class=n>${P(l.h, 1)}</td><td class=n>${fmtI(l.Ev)}</td><td class=n>${fmtI(l.Et)}</td><td class=n>${fmtI(l.Ek)}</td>
     <td class=n>${l.Rku ? P(l.Rku, 2) : '–'}</td><td class=n>${l.type === 'hatroi' ? P(l.C, 3) : '–'}</td><td class=n>${l.type === 'hatroi' ? l.phi : '–'}</td></tr>`,
    )
    .join('');
  const inpTable2 = `<table class=t><tr><td><b>Lớp kết cấu (từ dưới lên)</b></td><td class=c><b>Loại vật liệu</b></td><td class=n><b>h (cm)</b></td><td class=n><b>Ev</b></td><td class=n><b>Et</b></td><td class=n><b>Ek</b></td><td class=n><b>Rku</b></td><td class=n><b>C</b></td><td class=n><b>φ</b></td></tr>${layerRows2}
     <tr><td>Nền đất</td><td class=c>–</td><td class=n>–</td><td class=n>${fmtI(I.E0v)}</td><td class=n>${fmtI(I.E0t)}</td><td class=n>–</td><td class=n>–</td><td class=n>${P(I.C0, 3)}</td><td class=n>${I.phi0}</td></tr></table>`;

  const stepRows = tc1.red.steps
    .map(
      (s) => `<tr><td>${s.name}</td><td class=n>${fmtI(s.E)}</td><td class=n>${s.t === null ? '–' : P(s.t, 3)}</td>
     <td class=n>${P(s.h, 1)}</td><td class=n>${s.k === null ? '–' : P(s.k, 3)}</td><td class=n>${P(s.Htb, 1)}</td><td class=n>${P(s.Etb, 1)}</td></tr>`,
    )
    .join('');
  const stepTable = `<table class=t><tr><td><b>Lớp kết cấu</b></td><td class=n><b>Ei (MPa)</b></td><td class=n><b>t=E₂/E₁</b></td><td class=n><b>hi (cm)</b></td><td class=n><b>k=h₂/h₁</b></td><td class=n><b>Htb (cm)</b></td><td class=n><b>E'tb (MPa)</b></td></tr>${stepRows}</table>`;

  const capNote = tc1.red.capped
    ? `<p><i>LƯU Ý (chú thích Bảng 11): trị số Etb<sup>dc</sup> tính được LỚN HƠN mô đun đàn hồi lớn nhất của vật liệu trong các lớp đem quy đổi (${fmtI(tc1.red.maxE)} MPa), do vậy chỉ được lấy Etb<sup>dc</sup> bằng trị số lớn nhất đó ⇒ Etb<sup>dc</sup> = ${P(tc1.red.Etbc, 1)} MPa (đã áp dụng giới hạn).</i></p>`
    : '';
  const betaBlock = `<p>Hệ số điều chỉnh β xác định theo Bảng 11 TCCS 38 (nội suy tuyến tính theo H/D):</p>
   <p class=fx>Với H/D = ${P(tc1.red.H, 1)}/${I.D} = ${P(tc1.red.HD, 4)} ⇒ tra Bảng 11 được β = ${P(tc1.red.beta, 4)}.</p>
   <p class=fx>Vậy: Etb<sup>dc</sup> = β × E'tb = ${P(tc1.red.beta, 4)} × ${P(tc1.red.Etb, 2)} = <span class=res>${P(tc1.red.beta * tc1.red.Etb, 2)}</span> MPa.</p>${capNote}`;

  const tc1Block = `<p>Công thức kiểm tra — biểu thức (4), Điều 9.2.1:</p>
   <p class=fx>E<sub>ch</sub> ≥ K<sub>cd</sub><sup>dv</sup>·E<sub>yc</sub></p>
   <p class=fx>Ta có: H/D = ${P(tc1.red.HD, 4)} ; E₀/Etb<sup>dc</sup> = ${fmtI(I.E0v)}/${P(tc1.red.Etbc, 2)} = ${P(I.E0v / tc1.red.Etbc, 4)}.</p>
   <p>${
    tc1.isEchManual
      ? `Lấy giá trị tra toán đồ Hình 2 do người dùng nhập (giá trị tính gần đúng theo biểu thức (E.1): ${P(tc1.EchAuto, 2)} MPa):`
      : 'Áp dụng biểu thức giải tích gần đúng (E.1), Phụ lục E, thay cho việc đọc thủ công toán đồ Hình 2:'
  }</p>
   <p class=fx>⇒ E<sub>ch</sub> = <span class=res>${P(tc1.Ech, 2)}</span> MPa.</p>
   <p class=fx>K<sub>cd</sub><sup>dv</sup> × E<sub>yc</sub> = ${P(tc1.Kdv, 3)} × ${P(tc1.Eyc, 0)} = ${P(tc1.req, 2)} MPa.</p>
   <p class=fx><b>Kết quả nghiệm toán:</b>&nbsp; E<sub>ch</sub> = ${P(tc1.Ech, 2)} ${tc1.pass ? '≥' : '&lt;'} ${P(tc1.req, 2)} MPa &nbsp;⇒&nbsp; <b style="color:${tc1.pass ? '#1c7a45' : '#c0392b'}">KẾT LUẬN: ${tc1.pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}</b></p>`;

  const tc2Block = !tc2.length
    ? '<p><i>Tầng mặt cấp thấp B1/B2 hoặc không có lớp liền khối nào – không yêu cầu kiểm tra theo Điều 9.1.4.3.</i></p>'
    : `<p>Công thức kiểm tra — biểu thức (9), Điều 9.4.1:</p><p class=fx>σ<sub>ku</sub> ≤ R<sub>tt</sub><sup>ku</sup>/K<sub>cd</sub><sup>ku</sup></p>
     <p>Với ứng suất kéo uốn lớn nhất phát sinh ở đáy lớp — biểu thức (10) — và cường độ chịu kéo uốn tính toán — biểu thức (11):</p>` +
      tc2
        .map((r) => {
          const l = I.layers[r.idx];
          const Rtt = r.k1 * r.k2 * l.Rku;
          return `<p>• Đáy lớp <b>${r.name}</b> (${r.group === 'mat' ? 'tầng mặt' : 'tầng móng'}) — tra theo biểu thức ${r.group === 'mat' ? '(E.2), (E.3)' : '(E.4)'}, Phụ lục E:</p>
       <p class=fx>Với h₁ = ${P(r.h1, 1)} cm (tổng bề dày các lớp phía trên, kể cả bản thân); E₁ = ${P(r.E1, 1)} MPa (bình quân gia quyền theo bề dày, mô đun kéo uốn); E<sub>ch.m</sub> = ${P(r.Echm, 2)} MPa (mô đun tương đương của các lớp/nền phía dưới, xác định theo biểu thức (E.1) như bước b/).</p>
       <p class=fx>⇒ σ̄<sub>ku</sub> = ${P(r.skuBar, 4)} ⇒ σ<sub>ku</sub> = σ̄<sub>ku</sub>·p·k<sub>b</sub> = ${P(r.skuBar, 4)} × ${P(I.p, 2)} × ${P(r.kb, 2)} = <span class=res>${P(r.sku, 4)}</span> MPa.</p>
       <p class=fx>Với N<sub>e</sub> = ${fmtExp(r.Ne, 3)} trục ⇒ k₁ = ${P(r.k1, 3)}; k₂ = ${P(r.k2, 2)}; R<sub>ku</sub> = ${P(l.Rku, 2)} MPa ⇒ R<sub>tt</sub><sup>ku</sup> = k₁·k₂·R<sub>ku</sub> = ${P(r.k1, 3)} × ${P(r.k2, 2)} × ${P(l.Rku, 2)} = ${P(Rtt, 3)} MPa.</p>
       <p class=fx>Với K<sub>cd</sub><sup>ku</sup> = ${P(BANG8[I.dotincay].kutr, 2)}: R<sub>tt</sub><sup>ku</sup>/K<sub>cd</sub><sup>ku</sup> = ${P(r.allow, 3)} MPa.</p>
       <p class=fx>σ<sub>ku</sub> = ${P(r.sku, 4)} ${r.pass ? '&lt;' : '&gt;'} ${P(r.allow, 3)} MPa &nbsp;⇒&nbsp; <b style="color:${r.pass ? '#1c7a45' : '#c0392b'}">${r.pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}</b></p>`;
        })
        .join('');

  const tc3Block = !tc3.length
    ? '<p><i>Tầng mặt cấp thấp B1/B2 – không yêu cầu kiểm tra theo Điều 9.1.4.3.</i></p>'
    : `<p>Công thức kiểm tra — biểu thức (7), Điều 9.3.1:</p><p class=fx>T<sub>ax</sub> + T<sub>av</sub> ≤ C<sub>tt</sub>/K<sub>cd</sub><sup>tr</sup> , với C<sub>tt</sub> = C·k₁·k₂·k₃ — biểu thức (8)</p>` +
      tc3
        .map(
          (r) => `<p>• Tại <b>${r.label}</b>:</p>
      <p class=fx>H₁/D = ${P(r.H1, 1)}/${I.D} = ${P(r.HD, 3)} ; E₁/E₂ = ${P(r.E1, 1)}/${P(r.E2, 1)} = ${P(r.ratio, 2)} ; φ = ${r.phi}°.</p>
      <p class=fx>Tra toán đồ Hình 4/5 với các tỷ số trên được T<sub>ax</sub>/p = ${P(r.Taxp, 4)} ⇒ T<sub>ax</sub> = (T<sub>ax</sub>/p)·p = ${P(r.Taxp, 4)} × ${P(I.p, 2)} = <span class=res>${P(r.Tax, 4)}</span> MPa.</p>
      <p class=fx>T<sub>av</sub> (tự động, số hoá toán đồ Hình 6 theo φ và H₁) = <span class=res>${P(r.Tav, 4)}</span> MPa.</p>
      <p class=fx>C<sub>tt</sub> = C·k₁·k₂·k₃ = ${P(r.Ctt / (r.k1s * r.k2s * r.k3s), 3)} × ${P(r.k1s, 2)} × ${P(r.k2s, 2)} × ${P(r.k3s, 2)} = ${P(r.Ctt, 4)} MPa ; K<sub>cd</sub><sup>tr</sup> = ${P(Ktr, 2)} ⇒ C<sub>tt</sub>/K<sub>cd</sub><sup>tr</sup> = ${P(r.allow, 4)} MPa.</p>
      <p class=fx>T<sub>ax</sub>+T<sub>av</sub> = ${P(r.Tax, 4)} + (${P(r.Tav, 4)}) = ${P(r.lhs, 4)} ${r.pass ? '≤' : '&gt;'} ${P(r.allow, 4)} MPa &nbsp;⇒&nbsp; <b style="color:${r.pass ? '#1c7a45' : '#c0392b'}">${r.pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}</b></p>`,
        )
        .join('');

  const sumRows = [
    `<tr><td>TC1 – Độ võng đàn hồi (4)</td><td class=n>${P(tc1.Ech, 2)}</td><td class=c>${tc1.pass ? '≥' : '&lt;'}</td><td class=n>${P(tc1.req, 2)}</td><td class=n>MPa</td><td class=c style="font-weight:700;color:${tc1.pass ? '#1c7a45' : '#c0392b'}">${tc1.pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}</td></tr>`,
  ]
    .concat(
      tc2.map(
        (r) =>
          `<tr><td>TC2 – Kéo uốn đáy ${r.name}</td><td class=n>${P(r.sku, 4)}</td><td class=c>${r.pass ? '≤' : '&gt;'}</td><td class=n>${P(r.allow, 3)}</td><td class=n>MPa</td><td class=c style="font-weight:700;color:${r.pass ? '#1c7a45' : '#c0392b'}">${r.pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}</td></tr>`,
      ),
    )
    .concat(
      tc3.map(
        (r) =>
          `<tr><td>TC3 – Cắt trượt tại ${r.label}</td><td class=n>${P(r.lhs, 4)}</td><td class=c>${r.pass ? '≤' : '&gt;'}</td><td class=n>${P(r.allow, 4)}</td><td class=n>MPa</td><td class=c style="font-weight:700;color:${r.pass ? '#1c7a45' : '#c0392b'}">${r.pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}</td></tr>`,
      ),
    )
    .join('');
  const sumTable = `<table class=t><tr><td><b>Tiêu chuẩn giới hạn</b></td><td class=n><b>Giá trị</b></td><td class=c></td><td class=n><b>Cho phép</b></td><td></td><td class=c><b>Kết luận</b></td></tr>${sumRows}</table>`;

  return `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
  <head><meta charset='utf-8'><title>Thuyết minh áo đường mềm</title>
  <style>
   body{font-family:'Times New Roman',serif;font-size:13pt;line-height:1.42;color:#111}
   h1{font-size:15pt;text-align:center;text-transform:uppercase} h2{font-size:13pt;color:#163f5e;border-bottom:1px solid #163f5e;padding-bottom:2px;margin-top:20px}
   h3{font-size:12.5pt;color:#163f5e;margin-bottom:2px}
   .sub{text-align:center;font-style:italic;font-size:11pt;margin-top:-6px}
   table.t{border-collapse:collapse;width:100%;margin:6px 0} table.t td{border:1px solid #999;padding:4px 8px;font-size:11.5pt;vertical-align:top}
   td.n{text-align:right;font-family:'Consolas',monospace} td.c{text-align:center}
   .fx{font-family:'Cambria Math','Times New Roman';font-size:12.5pt;margin:5px 0} .res{font-weight:700}
   .eq{color:#666;font-style:italic;font-size:10.5pt}
   .verdict{font-size:13.5pt;font-weight:700;text-align:center;padding:8px;margin-top:8px;border:2px solid ${okAll ? '#1c7a45' : '#c0392b'};color:${okAll ? '#1c7a45' : '#c0392b'}}
  </style></head><body>
  <h1>Bảng tính kết cấu áo đường mềm</h1>
  <p class=sub>(Tiêu chuẩn áp dụng: TCCS 38:2022/TCĐBVN)</p>
  <h2>I. Số liệu đầu vào</h2>
  <h3>1/ Thông số chung</h3>${inpTable1}
  <h3>2/ Cấu tạo kết cấu</h3>${inpTable2}
  <h2>II. Trình tự tính toán</h2>
  <p>Việc kiểm toán được thực hiện theo đúng trình tự Điều 9 TCCS 38:2022/TCĐBVN, gồm quy đổi hệ nhiều lớp về hệ hai lớp theo phương pháp Odemark (biểu thức 5–6) rồi kiểm tra lần lượt theo 3 trạng thái giới hạn cường độ: (1) độ võng đàn hồi (Điều 9.2), (2) chịu kéo uốn ở đáy các lớp vật liệu liền khối (Điều 9.4), (3) chịu cắt trượt trong nền đất và các lớp kém dính (Điều 9.3).</p>
  <h3>a/ Đổi tầng 2 lớp một từ dưới lên (mô đun tính độ võng)</h3>
  <p>Việc đổi tầng được thực hiện theo biểu thức (5), Điều 9.2.4:</p>
  <p class=fx>E'<sub>tb</sub> = E₁[(1+k·∛t)/(1+k)]³</p>
  <p>với k = h₂/h₁ và t = E₂/E₁ (E₁, h₁ là mô đun và bề dày của lớp dưới đã quy đổi).</p>
  ${stepTable}
  <h3>b/ Hệ số điều chỉnh β và mô đun đàn hồi trung bình đã điều chỉnh</h3>
  ${betaBlock}
  <h3>c/ Kiểm tra cường độ chung theo tiêu chuẩn độ võng đàn hồi (TC1)</h3>
  ${tc1Block}
  <h3>d/ Kiểm tra cường độ theo tiêu chuẩn chịu kéo uốn (TC2)</h3>
  ${tc2Block}
  <h3>e/ Kiểm tra cường độ theo tiêu chuẩn chịu cắt trượt (TC3)</h3>
  ${tc3Block}
  <h2>III. Kết luận chung</h2>
  ${sumTable}
  <div class=verdict>${okAll ? 'KẾT CẤU ÁO ĐƯỜNG MỀM ĐẠT YÊU CẦU theo TCCS 38:2022' : 'KẾT CẤU CHƯA ĐẠT – CẦN ĐIỀU CHỈNH CHIỀU DÀY/MÔ ĐUN CÁC LỚP'}</div>
  <p style="font-size:10.5pt;font-style:italic;margin-top:14px;color:#555">Ghi chú: E<sub>ch</sub>, E<sub>ch.m</sub> tính theo công thức giải tích gần đúng Phụ lục E (TCCS 38), sai số so với toán đồ Hình 2 khoảng 5–10% (có thể lớn hơn khi H/D nhỏ) – nên đối chiếu toán đồ khi cần độ chính xác cao. Trị số T<sub>ax</sub>/p (TC3) do tiêu chuẩn không cho công thức giải tích nên được nhập từ kết quả tra toán đồ Hình 4/5. T<sub>av</sub> (TC3) được tự động tính từ hàm số hoá toán đồ Hình 6 (các đường thẳng qua gốc toạ độ theo góc ma sát trong φ), đã hiệu chỉnh khớp với Ví dụ I và Ví dụ II ở Phụ lục D của TCCS 38 – nên đối chiếu toán đồ gốc Hình 6 với công trình quan trọng. Thuyết minh do công cụ tính lập tự động theo TCCS 38:2022/TCĐBVN.</p>
  </body></html>`;
}

export function buildSN37WordDoc(N: Sn37NewResult, O: Sn37OverlayResult, L: Sn37LowResult): string {
  const P = (x: number, d = 3) => fmt(x, d);
  const passNew = N.lastD >= 0;
  const passOl = O.SNol >= 0 && !Number.isNaN(O.Dol);

  const olDetail = (() => {
    const d = O.detail;
    if (d.method === 'fwd') {
      return `<p>Phương pháp a) đo võng động FWD, Điều 7.3.1 — công thức (24), (26), (22)/(21):</p>
      <p class=fx>M<sub>R</sub> = 2,4P/(d<sub>r</sub>·r) = ${P(d.MRfwd, 1)} MPa ; M<sub>R thiết kế</sub> = C·M<sub>R</sub> = ${P(d.C, 2)}×${P(d.MRfwd, 1)} = ${P(d.MRtk, 1)} MPa.</p>
      <p class=fx>Giải E<sub>p</sub> từ phương trình (22) bằng phương pháp lặp (Goal Seek) sao cho độ võng tính bằng độ võng đo d₀=${P(d.d0, 5)} cm ⇒ E<sub>p</sub> = ${P(d.Ep, 1)} MPa.</p>
      <p class=fx>SN<sub>eff</sub> = 0,0093·D·E<sub>p</sub><sup>1/3</sup> = 0,0093×${P(d.D, 0)}×${P(d.Ep, 1)}<sup>1/3</sup> = <span class=res>${P(d.SNeff, 3)}</span>.</p>
      <p style="font-size:10.5pt;font-style:italic;color:#555">Giải trực tiếp bằng lặp số học thay vì tra toán đồ Hình D.2 bằng tay — kết quả có thể lệch vài % so với đọc toán đồ thủ công; đây là cách Điều 7.3.1.2 khuyến nghị dùng Goal Seek trong Excel.</p>`;
    }
    if (d.method === 'survey') {
      return `<p>Phương pháp b) khảo sát hiện trạng từng lớp, Điều 7.3.2 — công thức (27), theo mức chất lượng vật liệu (Bảng 14):</p>
      <table class=t><tr><td><b>Lớp</b></td><td class=n><b>a<sub>i</sub></b></td><td class=n><b>D<sub>i</sub> (cm)</b></td><td class=n><b>a<sub>i</sub>D<sub>i</sub></b></td></tr>
      ${d.layers.map((l) => `<tr><td>${l.name}</td><td class=n>${P(l.a, 3)}</td><td class=n>${P(l.D, 1)}</td><td class=n>${P(l.a * l.D, 3)}</td></tr>`).join('')}
      <tr><td colspan=3>Σa<sub>i</sub>D<sub>i</sub></td><td class=n>${P(d.sum, 3)}</td></tr></table>
      <p class=fx>SN<sub>eff</sub> = Σa<sub>i</sub>D<sub>i</sub>/2,54 = <span class=res>${P(d.SNeff, 3)}</span>.</p>`;
    }
    return `<p>Phương pháp c) tuổi thọ còn lại, Điều 7.3.3 — công thức (28), (29):</p>
    <p class=fx>RL = 100(1−N<sub>p</sub>/N<sub>1,5</sub>) = 100×(1−${fmtI(d.Np)}/${fmtI(d.N15)}) = ${P(d.RL, 1)} % ⇒ tra đường cong CF–RL (Hình 15) được CF = ${P(d.CF, 3)}.</p>
    <p class=fx>SN<sub>eff</sub> = CF·SN₀ = ${P(d.CF, 3)}×${P(d.SN0, 3)} = <span class=res>${P(d.SNeff, 3)}</span>.</p>
    <p style="font-size:10.5pt;font-style:italic;color:#555">Đường cong Hình 15 được số hoá gần đúng do tiêu chuẩn không kèm ví dụ mẫu để hiệu chỉnh chính xác — chỉ dùng để ước lượng sơ bộ.</p>`;
  })();

  const lowDetail = (() => {
    let html = `<table class=t>
      <tr><td>Loại tầng mặt</td><td class=n>${L.loai === 'nhua' ? 'Trộn nhựa / láng nhựa' : 'Cấp phối đá'}</td></tr>
      <tr><td>ESAL's thiết kế</td><td class=n>${fmtI(L.esal)}</td></tr>
      <tr><td>Cấp lưu lượng xe (Điều 8.4.1/8.4.2)</td><td class=n>${L.level}</td></tr>
      <tr><td>M<sub>R</sub> nền đường</td><td class=n>${P(L.MR, 1)} MPa</td></tr>
      <tr><td>Chất lượng nền (Điều 8.4.3)</td><td class=n>${L.quality}</td></tr>
    </table>`;
    if (L.loai === 'nhua' && L.row) {
      const fo = (o: [number, number, number] | 'KD' | 'CT') =>
        o === 'KD' ? 'KD – không nên dùng' : o === 'CT' ? 'CT – cần cải thiện nền trước' : `M=${o[0]} / MT=${o[1]} / MĐ=${o[2]} cm`;
      html += `<p class=fx>SN tra Bảng ${L.tableNo} (R=${L.Rrel}%): <span class=res>${L.snr}</span>.</p>
      <table class=t><tr><td><b>Phương án (Bảng ${L.tableNo2})</b></td><td><b>Chiều dày</b></td></tr>
      <tr><td>Láng nhựa 2 lớp</td><td>${L.row.ln === 'KD' ? 'KD – không nên dùng' : `LN=${L.row.ln[0]} / MT=${L.row.ln[1]} / MĐ=${L.row.ln[2]} cm`}</td></tr>
      <tr><td>Đá dăm thấm nhập nhựa</td><td>${fo(L.row.dd)}</td></tr>
      <tr><td>Bê tông nhựa</td><td>${fo(L.row.bt)}</td></tr>
      </table>`;
    } else {
      html += `<p class=fx>Chiều dày lớp cấp phối đá (Bảng 19): <span class=res>${L.th === '**' ? '** cần thiết kế khác/cải thiện nền' : L.th + ' cm'}</span>.</p>`;
    }
    return html;
  })();

  return `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
  <head><meta charset='utf-8'><title>Thuyết minh TCCS 37</title>
  <style>
   body{font-family:'Times New Roman',serif;font-size:13pt;line-height:1.42;color:#111}
   h1{font-size:15pt;text-align:center;text-transform:uppercase} h2{font-size:13pt;color:#163f5e;border-bottom:1px solid #163f5e;padding-bottom:2px;margin-top:20px}
   h3{font-size:12.5pt;color:#163f5e;margin-bottom:2px}
   .sub{text-align:center;font-style:italic;font-size:11pt;margin-top:-6px}
   table.t{border-collapse:collapse;width:100%;margin:6px 0} table.t td{border:1px solid #999;padding:4px 8px;font-size:11.5pt;vertical-align:top}
   td.n{text-align:right;font-family:'Consolas',monospace} td.c{text-align:center}
   .fx{font-family:'Cambria Math','Times New Roman';font-size:12.5pt;margin:5px 0} .res{font-weight:700}
   .verdict{font-size:13.5pt;font-weight:700;text-align:center;padding:8px;margin-top:8px;border:2px solid #163f5e;color:#163f5e}
  </style></head><body>
  <h1>Thuyết minh tính toán kết cấu áo đường mềm</h1>
  <p class=sub>(Tiêu chuẩn áp dụng: TCCS 37:2022/TCĐBVN — phương pháp Chỉ số kết cấu SN, nền tảng AASHTO 1993)</p>

  <h2>PHẦN A — THIẾT KẾ MỚI</h2>
  <h3>1/ Số liệu giao thông, độ tin cậy và nền đất</h3>
  <table class=t>
    <tr><td>W₈₀ – tổng số trục 80kN tích luỹ thiết kế (1 làn)</td><td class=n>${fmtI(N.t.w80)}</td></tr>
    <tr><td>Độ tin cậy R</td><td class=n>${P(N.t.R, 0)} %</td></tr>
    <tr><td>Z<sub>R</sub> (tra Bảng 10 / hàm phân phối chuẩn tắc nghịch đảo)</td><td class=n>${P(N.ZR, 3)}</td></tr>
    <tr><td>S₀ – độ lệch tiêu chuẩn toàn bộ</td><td class=n>${P(N.t.S0, 2)}</td></tr>
    <tr><td>p₀ / p<sub>t</sub> (Bảng 11)</td><td class=n>${P(N.t.p0, 1)} / ${P(N.t.pt, 1)}</td></tr>
    <tr><td>ΔPSI = p₀ − p<sub>t</sub></td><td class=n>${P(N.dPSI, 2)}</td></tr>
    <tr><td>M<sub>R</sub> hữu hiệu nền đất</td><td class=n>${P(N.MR, 1)} MPa</td></tr>
  </table>

  <h3>2/ Giải chỉ số kết cấu yêu cầu SN</h3>
  <p>Phương trình thiết kế AASHTO 1993 — biểu thức (8)/(9), Điều 6.2:</p>
  <p class=fx>log₁₀W₈₀ = Z<sub>R</sub>·S₀ + 9,36·log₁₀(SN+1) − 0,2 + log₁₀(ΔPSI/2,7)/[0,40+1094/(SN+1)<sup>5,19</sup>] + 2,32·log₁₀M<sub>R</sub> − 3,06</p>
  <p>Phương trình được giải bằng phương pháp lặp (tương đương công cụ Goal Seek mà Phụ lục G.1 của tiêu chuẩn khuyến nghị dùng trong Excel):</p>
  <p class=fx>⇒ <b>SN = ${P(N.SN, 3)}</b> (kiểm tra: vế trái tại SN nghiệm = ${P(snEquationLHS(N.SN, N.ZR, N.t.S0, N.dPSI, N.MR), 4)} ≈ log₁₀W₈₀ = ${P(log10(N.t.w80), 4)}).</p>

  <h3>3/ Chiều dày các lớp kết cấu</h3>
  <p>Áp dụng biểu thức (11), Điều 6.4.8: 2,54·SN = a₁D₁ + a₂D₂ + … + a<sub>n</sub>D<sub>n</sub>, với hệ số lớp a<sub>i</sub> xác định theo các phương trình hồi quy Phụ lục G (thay cho tra toán đồ Hình 8–12).</p>
  <table class=t><tr><td><b>Lớp</b></td><td class=c><b>Loại vật liệu</b></td><td class=n><b>Giá trị nhập</b></td><td class=n><b>a<sub>i</sub></b></td><td class=n><b>D<sub>i</sub> (cm)</b></td><td class=n><b>a<sub>i</sub>D<sub>i</sub></b></td></tr>
  ${N.rows.map((r, i) => `<tr${r.isLast ? " style='font-weight:700'" : ''}><td>${i + 1}. ${r.name}</td><td class=c>${G_KINDS[r.kind].label}</td><td class=n>${P(r.val, r.kind === 'custom' ? 3 : 1)} ${G_KINDS[r.kind].unit}</td><td class=n>${P(r.a, 3)}</td><td class=n>${P(r.D, 1)}${r.isLast ? ' (giải)' : ''}</td><td class=n>${P(r.a * r.D, 3)}</td></tr>`).join('')}
  <tr><td colspan=5>Σ(a<sub>i</sub>D<sub>i</sub>) tính lại / 2,54×SN yêu cầu</td><td class=n>${P(N.checkSum, 3)} / ${P(2.54 * N.SN, 3)}</td></tr>
  </table>

  <h3>4/ Kiểm tra chiều dày tối thiểu (Bảng 5, Điều 6.3.6)</h3>
  <p>Với W₈₀=${fmtI(N.t.w80)} (dòng ≤ ${N.b5.max === Infinity ? '>20.000.000' : fmtI(N.b5.max)}): BTN tầng mặt tối thiểu ${N.b5.btn} cm; móng trên vật liệu hạt ${N.b5.hat} cm; móng trên vật liệu hạt trộn nhựa ${N.b5.hatnhua} cm. Tổng bề dày BTN đã thiết kế: <b>${P(N.totalBTN, 1)} cm</b>.</p>
  <div class=verdict>${passNew ? 'PHẦN A ĐẠT — SN yêu cầu đã được đáp ứng bởi kết cấu đề xuất' : 'PHẦN A CHƯA ĐẠT — chiều dày lớp cuối giải ra âm, cần điều chỉnh kết cấu'}</div>

  <h2>PHẦN B — TĂNG CƯỜNG (OVERLAY)</h2>
  <h3>1/ Chỉ số kết cấu yêu cầu cho giao thông tương lai SN<sub>f</sub></h3>
  <table class=t>
    <tr><td>N<sub>f</sub> – ESAL's tương lai</td><td class=n>${fmtI(O.Nf)}</td></tr>
    <tr><td>R / S₀ / ΔPSI</td><td class=n>${P(O.R, 0)}% / ${P(O.S0, 2)} / ${P(O.dPSI, 2)}</td></tr>
    <tr><td>M<sub>R thiết kế</sub> nền hiện hữu</td><td class=n>${P(O.MR, 1)} MPa</td></tr>
    <tr><td><b>SN<sub>f</sub></b> — ptr (8)/(9)</td><td class=n><b>${P(O.SNf, 3)}</b></td></tr>
  </table>
  <h3>2/ Chỉ số kết cấu hữu hiệu hiện hữu SN<sub>eff</sub></h3>
  ${olDetail}
  <h3>3/ Chiều dày lớp phủ tăng cường</h3>
  <table class=t>
    <tr><td>SN<sub>ol</sub> = SN<sub>f</sub> − SN<sub>eff</sub>  (19)</td><td class=n>${P(O.SNol, 3)}</td></tr>
    <tr><td>E<sub>AC</sub> lớp phủ → a<sub>ol</sub>  (16)</td><td class=n>${P(O.Eac, 0)} MPa → ${P(O.aol, 3)}</td></tr>
    <tr><td><b>D<sub>ol</sub> = 2,54·SN<sub>ol</sub>/a<sub>ol</sub>  (18)</b></td><td class=n><b>${P(O.Dol, 1)} cm</b></td></tr>
  </table>
  <div class=verdict>${passOl ? 'CẦN LỚP PHỦ TĂNG CƯỜNG DÀY ' + P(O.Dol, 1) + ' cm' : 'SNeff HIỆN HỮU ĐÃ ĐỦ — KHÔNG CẦN TĂNG CƯỜNG BỀ DÀY'}</div>

  <h2>PHẦN C — LƯU LƯỢNG THẤP (Điều 8)</h2>
  ${lowDetail}

  <p style="font-size:10.5pt;font-style:italic;margin-top:14px;color:#555">Ghi chú: hệ số lớp a<sub>i</sub> và M<sub>R</sub>-CBR/GI tính theo các phương trình hồi quy công bố tại Phụ lục G (sai số &lt;2% so với toán đồ Hình 7–12). SN và SN<sub>f</sub> giải bằng phương pháp lặp số học tương đương Goal Seek (Phụ lục G.1). Đường cong CF–RL (Hình 15, mục Tăng cường/phương pháp c) được số hoá gần đúng do không có ví dụ mẫu để hiệu chỉnh chính xác — nên đối chiếu toán đồ gốc khi cần độ chính xác cao. W₈₀/N<sub>f</sub> do người dùng tự xác định từ phổ trục xe theo Phụ lục B và nhập trực tiếp vào ứng dụng. Thuyết minh do công cụ tính lập tự động theo TCCS 37:2022/TCĐBVN.</p>
  </body></html>`;
}

export function downloadWordDoc(html: string, filename: string): void {
  const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
