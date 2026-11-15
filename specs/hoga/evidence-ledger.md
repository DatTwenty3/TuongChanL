# Evidence ledger — nguồn gốc dữ kiện của LEDAT Hố Ga

Mọi dữ kiện dùng để viết ứng dụng đến từ **tài liệu và dữ liệu mẫu công khai đi kèm VHGpro 4** (hướng dẫn sử dụng, tệp Excel mẫu)
và từ **phân tích tĩnh siêu dữ liệu** bằng `morluto/rea` (`rea-agents@6.8.0`). Không chạy VHGpro, không giải mã/gỡ làm rối DLL,
không đọc thư mục `License/`, `Libs/License.dll`, `Libs/VHG.Licensing.dll`, `Libs/VHG.integrity*`, `VHG solution.dll` (đường kích hoạt) — theo quy tắc clean-room của dự án.

## 1. Tài liệu và dữ liệu mẫu

| Nguồn (`E:\3. data\rea\VHGpro 4\…`) | SHA-256 | Dùng cho |
|---|---|---|
| `Helps/HDSD VHGpro 4.pdf` (38 trang) | `f6acc7d551ba1efc35ecfc350b512f064e4e91294fd7ba4fbdfefadd589577ae` | Chức năng, định dạng nhập liệu, ý nghĩa từng ô cấu hình |
| `Excels/1.HO GA v4 (Thăm - Liền khối) 11.2026.xlsx` | `23936e16b3bb4fd47527f35f8571c3f09c0124e3aee829e1560102c91901da73` | Dữ liệu mẫu, CF.Ga, công thức KL HG, giá trị tính sẵn (chuẩn kiểm thử) |
| `Excels/2.HO GA v4 (Thăm - Nắp rời) 11.2026.xlsx` | `e087d34d2d807f350dc4fd265e5937d73b0a4b8bc0e27678496b68f73bb4954f` | như trên |
| `Excels/3.HO GA v4 (Thăm+thu - Nắp rời) 11.2026.xlsx` | `368f28c69d47cb699343ebda9f0500c5bd2f9a36e7194549dffd1e84a60d7cf8` | như trên + cửa thu |
| `Excels/4.HO GA v4 (Thăm+thu - Liền khối) 11.2026.xlsx` | `272a22bad3ee42f7a687e09b282c41cf68b4142e855ff886f75ecb004ad3dd4e` | như trên |
| `Excels/5.HO GA v4 (Thăm - không cổ) 11.2026.xlsx` | `f56d35aa264c943f03edd07aa500430726670f6bfe3cb12605bacd15f3e31237` | như trên (ga không cổ) |

`tests/fixtures/vhg-templates.json` là bản trích (dữ liệu nhập, cấu hình, danh mục, giá trị đã tính) của 5 tệp trên bằng `openpyxl` (`data_only=True`);
chỉ dùng làm dữ liệu kiểm thử, không phải mã nguồn.

## 2. Phân tích tĩnh bằng REA (`rea-agents@6.8.0`, `scripts/rea.mjs`)

Lệnh: `inspect-managed-artifact`, `inspect-managed-members` trên các assembly vẽ ga (không chạy mã đích).

| Assembly | SHA-256 | Evidence `inspect-managed-artifact` | Evidence `inspect-managed-members` |
|---|---|---|---|
| `VHGpro/Shared.dll` | `93276c6a79ce702a186edd91355259ce1fe2d42f45453ea72c547b25204689c6` | `ev_acfbfe6519cb6cedda4824722e613c552b6827784d926060c07ec7e44f941639` | `ev_eb889c65109125e8d4082d014f97a81b89cc6a78f66af4333ce4c64517f751e0` |
| `VHGpro/VHGpro 4.dll` | `acc0419e18cdaf4fec27b886ab9dd2e5c8c3a4c959456adaefb42ce17afbec18` | `ev_4f0908148236f73c5e8d4a125e50ecafb6a96886810e142030365df1f79129d0` | `ev_59b76979297086142fdd8c25af2d080025cfa4ac232d76d2b43f441c35d873ac` |
| `VHGpro/GaBTCTLienKhoi.dll` | `b65c9388987a4c5a407fee837c78f51aca24db454459277c54f5525f1792a9b1` | `ev_91997c640ab57c88ebab0f9e380fa67a2a49c4b0c48c4c54d3c65d139cfef2f4` | `ev_890b947c5eb742ab98e2dbcdfe4e416cf063912c5ed3573c294abc7bb7e40504` |

Kết luận rút ra (độ tin cậy cao, độ phủ `partial`):

* Là assembly **.NET Framework 4.8** (`dotnet-framework`), tham chiếu `Acdbmgd`, `Acmgd`, `accoremgd` (API .NET của AutoCAD) → VHGpro là plug-in AutoCAD nạp bằng `NETLOAD`.
* Thư viện Excel: `ClosedXML`, `ExcelDataReader` (đọc/ghi `.xlsx`), `PdfSharp` (xuất PDF cho công cụ in).
* Tên kiểu/phương thức/chuỗi **đã bị làm rối** (ví dụ `m8DF4103654B2533`, `FinalizeAccessibleValidatorFilter`), tài nguyên nhúng bị mã hoá → không có thuật toán nào đọc được từ nhị phân. Không cố gỡ làm rối.
* Vì vậy mô hình tính toán lấy từ tài liệu + công thức Excel người dùng được phép sửa (sheet KL HG), còn thuật toán sinh thanh thép/bản vẽ là của ứng dụng này.

## 3. Bản vẽ mẫu do VHGpro vẽ (chuẩn đối chiếu cốt thép)

`Demo/VHGpro demo files.zip` (`52c13702c79cdfa67247f29ab63325aefd6fe788e41b04b364a5fe54fd5be04c`) chứa 5 tệp `.dwg` — là **tệp dữ liệu**, không phải mã chương trình. Không chạy VHGpro; chỉ dùng AutoCAD của người dùng
(`accoreconsole.exe`, lệnh `DXFOUT`) để đổi sang DXF rồi đọc bằng `ezdxf` các block thống kê (`TK.*`) và tên hình (`TenMC`).

| Tệp | SHA-256 |
|---|---|
| `VHG1.Ga thăm liền khối.dwg` | `2e543514a5784a3bcb939db7f29c60bab26c498729d54914e52f8d6faf6913b5` |
| `VHG2.Ga thăm nắp rời.dwg` | `0db379775e768bed897814bb0084728987cea0aed074fd547f5dc603d847e559` |
| `VHG3.Ga thăm + thu nắp rời.dwg` | `b580a5ce646ae6e35826cdb4bcaeac2515a05aec9bbc7f9aa0c5b869bc5bad0a` |
| `VHG4.Ga thăm + thu liền khối.dwg` | `165c5a3313469853f54a4811b689cbcb21300384eb6702220a39b817fd98f18f` |
| `VHG5.Ga thăm không cổ.dwg` | `220a2dc4a39144a8f408d2c2df8d364493778c58ecf522be5bb9e976401c79c4` |

Kết quả đọc được: 6 khung A3 mỗi ga (kết cấu + lưới thép · đáy + T1 + T2 · T3 + T4 · bảng thống kê · chi tiết thanh · tấm nắp), tên hình (`MẶT BẰNG HỐ GA`, `MẶT CẮT CỐT THÉP A-A`, `TƯỜNG T1 - LỚP NGOÀI`, …),
bảng thống kê từng thanh (số hiệu, Ø, DAI, SL, KL) và bảng `THKL` theo kết cấu — dùng để chỉnh quy tắc thép (xem `parity-spec.md` §4) và bố cục tờ.

## 4. Trạng thái xác minh

Xem `CHANGELOG.md` ở thư mục gốc (bước 44 và 45) cho lệnh và kết quả chạy.
