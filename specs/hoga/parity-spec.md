# LEDAT Hố Ga — đặc tả chức năng và mức tương đương với VHGpro 4

Mục tiêu: phần mềm web độc lập có **ý tưởng và chức năng tương tự VHGpro 4** (vẽ hàng loạt hố ga BTCT từ bảng dữ liệu,
chiết tính bê tông / ván khuôn / cốt thép, bản vẽ có kích thước và bảng thống kê). Mã nguồn được viết mới hoàn toàn;
không sao chép mã của VHGpro (các DLL của VHGpro bị làm rối mã nên không có gì để sao chép — xem `evidence-ledger.md`).

## 1. Phạm vi chức năng

| Chức năng VHGpro 4 (HDSD) | LEDAT Hố Ga | Trạng thái |
|---|---|---|
| 5 loại ga: thăm liền khối, thăm nắp rời, thăm+thu nắp rời, thăm+thu liền khối, thăm không cổ | `GaKind` + dữ liệu mẫu 20 ga/loại | Có |
| Nhập dữ liệu bằng bảng Excel (sheet chi tiết ga, CF.Ga, CF.Cong, CF.Data) | Nhập thẳng `.xlsx` cùng bố cục (`importXlsx.ts`) + bảng sửa trực tiếp trên web | Có |
| Cấu hình CF.Ga (lót, đáy, tường, trần, cổ, nắp, cửa thu, lớp bảo vệ, định dạng thép, thép buộc, thang, lỗ cống, lỗ thăm, cao trình, vật liệu) | `GaConfig` + form sinh từ lược đồ (`configSchema.ts`) | Có — **mọi ô (141) đều làm thay đổi kết quả**, có test `tests/configEffects.test.ts` đổi từng ô và so kết quả |
| Danh mục cống tròn / hộp / rãnh U, thép hình | `PipeCatalog`, `angles`, tab "Danh mục cống" | Có |
| Vẽ hàng loạt ga, tỷ lệ tự động, khung bản vẽ | Mỗi ga 5 tờ A3: Kết cấu · Cốt thép (mặt cắt + lưới đáy/trần) · Lưới thép 4 tường × 2 lớp · Tấm nắp (tỷ lệ riêng `lid.scale`, khi nắp BTCT) · Thống kê thép (kèm hình dạng thanh); thêm tờ Tổng hợp khối lượng; chú thích `T1-Ø10, L=…`; chọn "Nhóm 2 cột / 3 cột", tỷ lệ tự động hoặc chọn tay | Có |
| Xuất bản vẽ sang AutoCAD | **DXF R2000 (`AC1015`)**: LWPOLYLINE, **HATCH thật**, **DIMENSION thật** (khối ẩn `*D` + DIMSTYLE theo tỷ lệ), **BLOCK `NOT` + INSERT** cho nốt thép; DXF R12 cũ; SVG. Đã mở + AUDIT bằng AutoCAD 2024 (`accoreconsole`): 0 lỗi cho cả 5 loại ga và bản vẽ 20 ga (76 800 đối tượng) | Có |
| Xuất bảng chiết tính thép / tổng hợp khối lượng ra Excel | `.xlsx` (THKL, KL HG, Thep, Chiết tính thép, dữ liệu ga) + CSV | Có |
| Chiết tính khối lượng (sheet KL HG / THKL) | `quantities.ts`, `summary.ts` | Có — đối chiếu số liệu với Excel (§3) |
| Cốt thép: lưới chia đều/theo mật độ, 0M/1M/2M, giảm thép, thép buộc C/Z/U, gia cường lỗ, thang, chốt, móc nâng, thép hình | `rebar.ts` | Có (quy tắc tự phát triển, §4) |
| Chuyển mã font TCVN3/VNI, template DWG (layer/dimstyle/textstyle/block của người dùng), block nắp gang dựng sẵn | — | **Không** (đặc thù plug-in AutoCAD; DXF dùng chữ Unicode `\U+XXXX`, layer/dimstyle do ứng dụng tạo, nắp gang vẽ theo kích thước ghi trong tên block) |
| Kích hoạt, giấy phép, khoá phần cứng | — | **Không làm** (ngoài phạm vi, không phân tích) |
| VHGplate, ATP Plotter, VHGExcelCad | — | Chưa làm |

## 2. Mô hình dữ liệu

* Hệ trục ga: gốc ở tâm lòng ga, `x` theo cạnh dài `L`, `y` theo cạnh rộng `B`; T1 = 12h (`y+`), T2 = 3h (`x+`), T3 = 6h (`y−`), T4 = 9h (`x−`).
* Mặt cắt: `z = 0` tại mặt trong bản đáy (khớp "đáy ga" của cột cao độ trong Excel: `đỉnh = đáy + H + trần + cổ + cao nắp`).
* Chuỗi nhập liệu giữ đúng định dạng của VHGpro: `D10A150`, `D6A150L100`, `R300x400`, `600x800`, `D400`, `75x50`, `2D12`, `V50x50x3`, `0M/1M/2M`.
* Lỗ cống trên tường: kích thước lỗ = kích thước ngoài của cống + vữa trát hai bên; rãnh chữ U mở ở đỉnh tường (đỉnh rãnh = đỉnh tường).
* Chiều dương lệch tim cống = bên trái khi nhìn từ trong ga ra ngoài (như HDSD §2.3.14).

## 3. Chiết tính khối lượng và kiểm chứng

Công thức lấy từ chính các ô công thức Excel trong sheet **KL HG** của tệp mẫu (đó là công thức Excel thường, người dùng được sửa). Kiểm chứng bằng cách so với
**giá trị Excel đã tính sẵn** trong tệp mẫu (`tests/fixtures/vhg-templates.json`):

| Tập kiểm tra | Kết quả |
|---|---|
| Ga liền khối, 20 ga × (cao ga, cao trình, lót, đáy, tường gộp, trừ lỗ 4 hướng, ván khuôn, viền lỗ, trần, cổ, vữa chèn, đào, đắp) | khớp dung sai `1e-6` (80 phép thử) |
| Ga không cổ, 20 ga × (lót, đáy, tường, lỗ, vữa, tấm nắp dài/rộng/BT/VK, đào đắp) | khớp `1e-6` sau khi áp dụng sai khác Excel ở dưới |
| Nhập 5 tệp mẫu → đọc đúng 20 ga, danh mục cống, thép hình, cấu hình CF.Ga | đạt |

**Sai khác có chủ đích / lỗi Excel đã biết** (ứng dụng làm đúng về hình học, test ghi rõ):

1. `AC` (BT tường, loại liền khối): Excel trừ `(a+b)/2·vát²` thay vì cộng `(L+B)·vát²` cho vát góc trần. Ứng dụng dùng `(L+B)·vát²`; chênh `0,7·0,1² = 0,007 m³` (test so sánh đúng giá trị chênh).
2. Ga không cổ: Excel lấy chiều cao vát đỉnh tường bằng `RIGHT("75x120", FIND("x")−1)` = `20` mm thay vì `120` mm. Ứng dụng dùng `120`; test cho cấu hình `75x20` để chứng minh mọi số liệu khác khớp từng con số.
3. Cát lót: Excel dùng nhầm ô (`P7 = F3` thay vì `E3`) và tham chiếu `P10` (hàng trên) cho bề rộng; ứng dụng dùng đúng "mở rộng lớp lót 2".
4. Cổ tròn (`D700`): Excel coi là hình vuông `700×700`; ứng dụng dùng hình tròn thật.
5. Trần: Excel trừ lỗ cổ bằng `((a+b)/2)²`; ứng dụng trừ `a·b` (trùng khi cổ vuông).
6. G500-2 của tệp mẫu 5: các ô trừ lỗ rãnh `R400x600` lệch 0,5 % so với công thức (giá trị lưu cũ trong tệp) — bỏ qua riêng ô đó trong test.
7. Đắp đất: Excel chỉ đưa thể tích lăng trụ trừ lót; ứng dụng trừ thêm phần kết cấu nằm trong hố móng và báo thêm `fillFull` (giá trị theo Excel).

## 4. Cốt thép — quy tắc và mức đối chiếu với VHGpro

**Chuẩn đối chiếu thật:** `Demo/VHGpro demo files.zip` có 5 bản vẽ `.dwg` do VHGpro 4 vẽ. Mở bằng AutoCAD 2024 (`accoreconsole`, `DXFOUT`) rồi đọc các block thống kê `TK.*`
(`TK.L2M`, `TK.L0M`, `TK.M.U`, `TK.VAT`, `TK.GC.T`, `TK.THKL`, …) bằng `ezdxf`: mỗi dòng có số hiệu, Ø, chiều dài triển khai `DAI`, số thanh `SL`, khối lượng `KL`.
(Cột `Thep` trong Excel mẫu là số nhập tay cũ, không dùng.) Bản vẽ mẫu được người tạo vẽ nhiều lần với cấu hình khác nhau nên chỉ ga G400-1 của `VHG1.dwg`
(đúng cấu hình mặc định) đối chiếu được từng con số; các ga khác dùng để kiểm quy tắc độc lập với cấu hình.

Đã khớp với VHGpro (có test `tests/engine/vhgpro-drawing-oracle.test.ts`):

| Hạng mục | VHGpro | Quy tắc áp dụng |
|---|---|---|
| Số thanh lưới bản đáy, thép đứng tường | n = ⌈span/s⌉ + 2 (span 1710 → 14, 2460 → 19, 2250 → 17 thanh) | `spaced(..., extra = 2)` |
| Chiều dài thanh đáy | `Dài = kích thước bản − 2·bảo vệ`, móc `= dày − 2·bảo vệ` (110 mm) | như cũ |
| Khối lượng 2 lớp thép đáy G400-1 | 23,13 + 22,61 + 21,23 + 20,03 = 87,00 kg | 87,07 kg → khớp ≤ 0,1 kg (chênh do VHGpro làm tròn 2 số lẻ từng dòng) |
| Khối lượng đơn vị | Ø10 → 0,6165 kg/m = π/4·d²·7850 | `rebarKgPerM` (trước đây dùng 0,00617·d²) |
| Thép buộc chữ U | `2·(dày − 2·bảo vệ) + 2·L1 + L3` = 620 mm | sửa công thức (trước: 510) |
| Thép ngang tường | cả hai lớp dài `Lo − 2·bảo vệ` (2250); móc theo định dạng từng lớp (ngoài 2M = +2·100, trong 0M) | `wallPanels` |
| Thép đứng tường lớp ngoài | L 1550 + 2 móc 100 = 1750 | như cũ (đã khớp) |

**Chưa khớp / chưa xác định được từ bản vẽ mẫu:** chiều dài thanh vát góc (`TK.VAT`: DAI = L + 2·móc nhưng L = 452 / 438 không suy ra được từ vát 100 và dày 150),
số thanh buộc (phụ thuộc cấu hình riêng của từng lần vẽ), số thanh ngang tường quanh lỗ cống (VHGpro bỏ thanh cắt qua lỗ thay vì chia đoạn), thép gia cường lỗ (`TK.GC.T`),
thép cổ ga. Tổng thép ga G400-1 của VHGpro ≈ 489 kg (đáy 90,3 + tường 274,9 + trần 78,9 + cổ 25,8 + nắp 5,9 + thép hình 13,6); ứng dụng cho cùng bậc
nhưng **cần kiểm tra bằng bản vẽ thiết kế thật trước khi dùng**.

Các quy tắc còn lại (ứng dụng tự đặt):

* `Chia đều` n = ⌈span/s⌉ + 1 (+2 cho đáy và thép đứng tường); `Theo mật độ` n = ⌊span/s⌋ + 1, dư chia hai bên; móc theo `fmt.hook`.
* Tường: 4 tấm phẳng × 2 lớp; thanh cắt bởi lỗ cống (bỏ đoạn < 150 mm); gia cường lỗ `Bo` (vòng + lap `L nối × d`), `Xiên` (4·n), `Vuông`.
* Thép buộc: lưới `⌈w/s⌉·⌈h/s⌉`; "Lệch" so le nửa bước, hàng lẻ ít hơn một thanh.
* Thang thép (bậc đầu cách đỉnh `A`, bước `B`), chốt thép tường–trần (khoảng cách làm tròn 50 mm), móc nâng, thép góc viền cổ/tấm nắp/đỉnh tường (kg/m theo CF.Data), râu neo, cửa thu.

## 5. Bản vẽ

**Bố cục theo bản vẽ mẫu VHGpro** (Bước 52). Nguồn đối chiếu: 5 bản vẽ `.dwg` mẫu mở bằng AutoCAD (`DXFOUT`) rồi đọc bằng `ezdxf` — chỉ đọc dữ liệu hình (lớp, màu, mẫu tô,
kích thước, vị trí), không đọc / không chạy bất kỳ phần cấp phép nào và không sao chép khối thư viện (khối nắp gang, `Gach`, …). Bộ 5 tờ A3 cho mỗi ga, **cùng một tỷ lệ**
(tự chọn, hoặc chọn ở ô "Tỷ lệ"); khung đơn lề trái 20 mm / các lề khác 5 mm (lớp `VHG-140`), không có khung tên; mỗi hình có tên màu xanh lá 3 mm và dòng `Tỷ lệ 1:n` 2 mm:

| Tờ | Nội dung (3 cột × 2 hàng, tâm cột 79,8 / 216,15 / 352,5 mm; hàng cách nhau 139,3 mm) |
|---|---|
| 1 | Mặt bằng hố ga (nhìn từ trên, nét khuất xanh dương, ký hiệu mặt cắt tròn có mũi tên) · mặt cắt B-B · mặt cắt cốt thép A-A / mặt cắt A-A · mặt bằng lưới thép tường · cốt thép mặt cắt B-B |
| 2 | Bản đáy lớp trên · tường T1 ngoài · T2 ngoài / bản đáy lớp dưới · T1 trong · T2 trong |
| 3 | Tường T3 ngoài · T4 ngoài · trần lớp trên / T3 trong · T4 trong · trần lớp dưới |
| 4 | Mặt bằng thép cổ ga + mặt cắt A-A, B-B của cổ (cột trái) · bảng thống kê cốt thép hai cột bảng (nhiều trang nếu dài) · khối "Tổng (kg)" |
| 5 | Hình dạng thanh theo nhóm (đáy, T1…T4, trần, cổ ga + thang): "Mã-Ø, L=…" và hình thu nhỏ |

Lưu ý khớp với bản mẫu: **A-A là mặt cắt ngang (theo bề rộng B), B-B là mặt cắt dọc (theo chiều dài L)** — ngược với id trục nội bộ (`section(c, s, 'A')` = dọc); các tên hình đã hoán đổi cho đúng bản mẫu.
Mã thanh vẫn là mã duy nhất toàn ga (D1…, T1…, N1…, C1…) để bảng thống kê không trùng; bản mẫu đánh lại mã theo từng lớp.

Phong cách (đối chiếu từ bản mẫu): lớp DXF `VHG-BT` (bê tông, ACI 4), `VHG-Thep` (đỏ 1) / `VHG-Thep2` (vàng 2, thép buộc dấu X) / `VHG-Thep3` (tím nét đứt) / `VHG-Thep4` (xám nét đứt),
`VHG-Dim` (kích thước + đường dẫn, 140), `VHG-150` (cống), `VHG-Dashed` (đường khuất, xanh dương), `VHG-VL` (tô vật liệu, 251), `VHG-Center` (tim), `VHG-Text`, `VHG-140` (khung).
Mẫu tô chuẩn: bê tông = `ANSI32` × 4·tỷ lệ + `AR-CONC` × 0,4·tỷ lệ; bê tông lót / đệm = `AR-CONC`; vữa trát = `ANSI37` × 4·tỷ lệ (định nghĩa mẫu theo inch của AutoCAD trong `cad/patterns.ts`, sinh từ `ezdxf`;
DXF R2000 ghi HATCH thật kèm định nghĩa đã nhân hệ số, giống bản mẫu; SVG và DXF R12 khai triển thành đoạn thẳng / chấm).

* Mã nguồn: `cad/vhgSheets.ts` (bố cục + chọn tỷ lệ), `cad/viewsVhg.ts` (mặt bằng ga, lưới thép tường, ký hiệu mặt cắt, chú thích có đường dẫn), `cad/viewsPanels.ts` (lớp thép đáy / trần / tường, chuỗi kích thước `12x146.4=1757`),
  `cad/viewsNeck.ts`, `cad/vhgTables.ts` (bảng thống kê, hình dạng thanh), `cad/vhgFrame.ts`; các hình mặt cắt dùng chung `cad/views.ts`. Bộ tờ cũ (`buildViewSheet`, `buildWallSheet`, `buildScheduleSheets`) còn trong `cad/sheets.ts` cho test đối chiếu.
* Nốt thép: đường kính = `cover.notch` (đúng ý "tỷ lệ nốt thép" của HDSD). Tấm nắp BTCT vẫn có tờ riêng (`buildLidSheet`, tab "Tấm nắp").
* DXF R2000: handle duy nhất, chủ sở hữu hợp lệ, `DIMSTYLE HG<tỷ lệ>`, khối ẩn `*Dn`, khối `NOT`, từ điển `ACAD_PLOTSTYLENAME`; kiểm bằng `scripts/validate-dxf-autocad.ps1` (bộ 5 loại ga: AUDIT 0 lỗi).
* Test: `tests/hoga/engine/vhgSheets.test.ts` (đủ tờ / hình / tên, không NaN, tên lớp & mẫu tô trong DXF, `patternSegments`), `layout.test.ts` (20 ga × bộ tờ + tổng hợp không đè nhau).

## 6. Giới hạn đã biết

* Hình chưa giống bản mẫu 100 %: chưa có chuỗi kích thước độ cao hai bên mặt cắt theo từng lỗ cống, chưa có nắp gang thật (dùng ký hiệu tự vẽ, không chèn khối thư viện), chưa có hình khối nắp trên mặt cắt như bản mẫu,
  số hiệu thanh trong bản vẽ là mã duy nhất toàn ga (bản mẫu đánh lại theo lớp), bảng thống kê chưa có hình dạng kèm kích thước từng đoạn.
* Mặt cắt chỉ cắt qua tim ga; lỗ cống lệch tim không nằm trên mặt cắt thì không hiện.
* Cửa thu chỉ vẽ trong mặt bằng và mặt cắt đi qua nó; chi tiết cốt thép cửa thu chỉ có trong bảng chiết tính.
* Số liệu thép chưa khớp 100 % VHGpro (xem §4).
