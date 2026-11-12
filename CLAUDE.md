# CLAUDE.md — Tường chắn BTCT (TuongChanL-Web)

Web app TypeScript + React 18 + Vite 6: **bản vẽ 2D (5 cụm CAD) + mô hình 3D WebGL + bảng tính kiểm toán tường chắn BTCT theo TCVN 11823:2017**. Đây là bản dựng lại "clean-room" của app Electron `TuongChanL` 1.0.0, yêu cầu **khớp số liệu tuyệt đối** với bản gốc. Toàn bộ chạy trong trình duyệt, không có backend.

- Repo git = thư mục này (`origin`: `DatTwenty3/TuongChanL`, nhánh `main`).
- Thư mục cha `E:\3. data\rea\` (ngoài repo) chứa `AGENTS.md` (quy tắc điều hành chi tiết), `CHANGELOG.md` (nhật ký từng bước), `analysis/` (module gốc đã trích để làm "oracle" cho test) — **không** sửa `analysis/`, `TuongChanL/`, `TuongChanL_BoCai_1.0.0/`, `rea/`. Các thư mục `BangTinhCauCong-Web/`, `analysis-cau-cong/` là dự án khác, đừng đụng.
- Giao diện, thông báo, comment nghiệp vụ viết bằng **tiếng Việt**; giữ nguyên ngôn ngữ khi sửa.

## Lệnh thường dùng (chạy trong thư mục này)

| Việc | Lệnh | Ghi chú |
|---|---|---|
| Dev server | `npm run dev` | Vite HMR. Nếu trang mất style sau khi sửa `app.css` hàng loạt → tắt và chạy lại Vite |
| Typecheck | `npm run typecheck` | `tsc --noEmit`, phải exit 0 |
| Build | `npm run build` | `tsc --noEmit && vite build` → `dist/` (đã `.gitignore`) |
| Test | `npx vitest run` | 16 file, **183 test**, ~100 s (jsdom). Một test duy nhất: `npx vitest run tests/engine/parity.test.ts` (21 test) |
| E2E | `node tests/qa/e2e_browser.mjs` | **Phải `npm run build` trước** (phục vụ `dist/` qua `vite preview --port 4179`). Cần Chrome tại `C:\Program Files\Google\Chrome\Application\chrome.exe`, 11 check `E2E-0…6b`, kỳ vọng 0 lỗi console/HTTP |
| Chạy 1 chạm (Windows) | `start-webapp.bat` | Tự cài Node/`node_modules`, build nếu thiếu, mở trình duyệt; có `--dev --rebuild --install --lan --port N --no-open --check` |

Cấu hình công cụ: ESM (`"type":"module"`), TS `strict` và `tsconfig` **gồm cả `tests/`** (typecheck phủ test). Vitest: môi trường `jsdom`, `globals: true`, chỉ chạy `tests/**/*.test.{ts,tsx}`. Vite: `worker.format = 'es'` (sinh `dist/assets/fem2d.worker-*.js`). Không có ESLint/Prettier — theo đúng phong cách file đang sửa (2 space, nháy đơn, có `;`). Barrel `engine/index.ts` import có đuôi `.ts`, các thư mục khác import không đuôi.
Không cài `@types/node`: test dùng API Node qua khai báo tối thiểu trong `tests/engine/node-builtins.d.ts` và `tests/qa/qa-builtins.d.ts` — dùng hàm Node mới trong test thì phải khai báo thêm vào đó, nếu không `tsc` báo lỗi.
Đường dẫn chứa dấu cách và dấu chấm (`E:\3. data\rea\…`): luôn đặt trong dấu nháy khi viết script/lệnh.

Ô số (`input[type=number]`) luôn hiện bộ tăng/giảm **tự vẽ** (hai chevron bằng SVG nền của `::-webkit-inner-spin-button` với `appearance: none`, vẫn bấm được như bản gốc — đã kiểm bằng Playwright, chuột thật). Không đặt `appearance: textfield`, không ẩn `::-webkit-inner-spin-button`. Đơn vị `.inp i` nằm NGOÀI ô, bên phải; hàng nhập `.row` rộng cột nhập 150 px (160 px trên màn cảm ứng); ô số inline nhỏ (bảng cốt thép) cần `width` ≥ ~50 px.

Quy tắc: **không báo "đạt" khi chưa chạy lại SAU lần sửa cuối** và chưa thấy exit code / số test. Test nặng phải có timeout riêng (`it(..., 30000)`); mặc định Vitest chỉ 5 s (test CFE từng fail vì thiếu timeout).

## Kiến trúc

```
src/
  main.tsx, App.tsx        bootstrap + khung giao diện (header, sidebar, nav/tab, viewport, status bar)
  state/appStore.ts        TOÀN BỘ state (React Context): project, viewMode, export, dirty, debounce solver
  types/project.ts         kiểu miền chuẩn (CalcConfig 96 khóa, CAD entity, 3D model, UI state)
  engine/   (16 file)      thuần TS, không DOM: hình học, cốt thép, khối lượng, CALC (TCVN), calcRibbed,
                           water (thấm), slope (Bishop), fe3d/cfe (vỏ 3D), fem2d (+ worker), presets
  cad/      (13 file)      5 sheet CAD (SHEET_DEFS), 17 LAYERS, dim, template view B/C/D, toSVG, toDXF (R12), viewport 2D
  model3d/  (9 file)       mesh, ống thép (M3Tubes), `V3` (camera, pick, PNG) + `scene3.ts` (lõi vẽ three.js)
  reports/  (10 file)      bảng tính HTML (TeX→HTML), hình/biểu đồ SVG, sheet theo template
  export/   (5 file)       csv, docx (OOXML/OMML thuần trình duyệt), pdf (iframe in + pdf-lib), projectIo (.tcl.json)
  components/ (11 file)    HeaderToolbar, SidebarMetrics, SidebarCadPanel, SidebarCalcPanel, Cad2DViewport,
                           Model3DViewport, CalcReportViewport, FieldControls, Icon, ToastBanner
  styles/app.css           toàn bộ CSS
tests/  appUi.test.tsx · engineAndReports.test.ts · types.test.ts · engine/parity.test.ts ·
        cad/cad_export.test.ts · qa/full_parity.test.ts · qa/e2e_browser.mjs
specs/  parity-spec.md (hợp đồng tương đương) · evidence-ledger.md · qa-verification-report.md
```

### Luồng dữ liệu (đọc kỹ trước khi sửa store)
- `project: EngineProject` là **nguồn sự thật duy nhất**, bất biến theo kiểu "clone rồi sửa": `updateProject(mutator)` → `cloneProject` (JSON deep clone) → mutator → `calcEnsure` + `ancEnsure`. Dùng `setPath('a.b', v)` cho ô nhập; `setTemplatePreset` giữ lại metadata (`extractKeepMeta`) khi đổi mẫu.
- Đơn vị: hình học/bản vẽ tính bằng **cm** (`H = 500` là 5 m); `calcRun` đổi sang m (`calcGeomP`), bảng tính dùng kN, m, kPa, MPa cho 1 m dài tường.
- Dẫn xuất bằng `useMemo`: `buildBars` (phân nhánh theo mẫu: `buildBarsB` / `buildBarsC` / `buildBarsD`, còn mẫu A và các trường hợp còn lại đi `buildBarsG` "generic") → `quantities` → `autoScale` → cache sheet (`getSheet(idx)`, dựng lười, reset khi project/bars/quantities/scale đổi) và `calcRun(project)`.
- Solver nặng chạy **bất đồng bộ**, báo xong bằng bộ đếm `feRev` / `gsRev` / `femRev` (component đọc rồi `void feRev` để re-render):
  - FE tấm 3D: debounce 900 ms (80 ms khi đang ở tab Tính toán).
  - Ổn định tổng thể (Bishop + thấm): chỉ khi ở tab Tính toán, 600 ms, tối đa 2 lần thử lại cho cùng một key.
  - FEM 2D: Web Worker (`fem2d.worker.ts`), 1200 ms, cùng cơ chế guard.
- Dấu thập phân (`calc.dec`) là **trạng thái toàn cục** của engine và reports: luôn gọi cả `setEngineCalcDec` và `setReportDec` (store đã làm; component render báo cáo cũng làm).
- Dirty tracking: so snapshot JSON với `cleanSnapRef`; `markClean` khi mở/lưu; `beforeunload` cảnh báo.
- `calcRun` trả **union** (kết quả hợp lệ | `{error}` | `{unsupported}`): luôn bảo vệ bằng `isCalcValid(R)` trước khi đọc `R.g`, `R.ok`… (xem cách dùng ở `SidebarMetrics`, `CalcReportViewport`).
- Mô hình 3D chỉ được nạp bởi `Model3DViewport` (`v3.setModel` đúng **1 lần** khi chuyển 2D→3D; test `appUi` đếm số lần gọi). Không thêm đường đồng bộ `V3` thứ hai trong store.
- Trạng thái mở/đóng các accordion nằm trong store (`cadAccordions`, `calcAccordions`) để giữ nguyên khi chuyển 2D ↔ Tính toán (E2E-2b kiểm tra); mục nước ngầm/động đất/FE/FEM tự mở khi bật công tắc tương ứng.
- Đổi mẫu (`setTemplatePreset`) phải qua `calcFamilyFix(built, wasD)`; dùng các predicate `isC/isD/ancOn/keyOn/keyBlocked/beamOn` của engine thay vì tự so sánh `tpl` rải rác trong UI.
- `mergeProject` (migrate file cũ/file của app gốc) nằm ở `engine/presets.ts`, được `export/projectIo.ts` re-export; `parseProjectFile` bắt buộc có `{ p: {…} }`.
- Component chỉ lấy dữ liệu qua `useAppStore()`; không giữ bản sao project.

## Bất biến miền cần nhớ (sai là lệch số liệu so với bản gốc)
1. UI ↔ template id **không tuần tự**: Mẫu 1 = `tpl:"B"` (mặc định `presetCanti(500)`, H 4–13 m), Mẫu 2 = `"A"` (có sườn), Mẫu 3 = `"C"` (khối kè, `KE_TAB` 27 dòng, `type` khóa `"rib"`), Mẫu 4 = `"D"` (neo đá, `D_TAB` 6 dòng, mặc định idx 1 = D65).
2. `calcDefaults()` có đúng **96 khóa**; `mergeProject()` migrate `calc.kb/kf → kbx/kby/kfx/kfy = k·1e-6` và neo đá cũ khi `tpl !== "D"`.
3. Ký hiệu runtime là `CALC.RC` (viết hoa). Khi tính `ok.all` **không** đưa chính `'all'` vào `every(Boolean)` (xem `calcCore.ts`, `calcRibbed.ts`, `calcOrchestrator.ts`).
4. CSV (`buildCsvContent`) duyệt `res.bars` **chưa gộp**; cụm CAD 4 & 5 dùng `barList(res)` đã gộp — cố ý khác nhau.
5. `aSl === "dw"` và `!aOT` → bỏ ma sát đáy, tự đạt `ok.an`; nền đá luôn thủy tĩnh `"hs"`; FEM2D/Bishop chỉ "tham khảo" trừ khi `bsOn` / (`feOn && feBasis==="fe"`).
6. `docx.ts#zDeflate` phải đọc `CompressionStream('deflate-raw').readable` **đồng thời** với ghi (`Promise.all`) — tránh treo ở payload > 64 KB.
7. PDF có 2 đường: `#bPrint` (iframe + `window.print()`), `#bPdf` (`pdf-lib`, trang đúng `pw × ph` mm cho bản vẽ, A4 nhiều trang cho bảng tính).
8. `baseName('')` → `'tuong_chan'` (NFD, `đ→d`, cắt 40 ký tự). Định dạng file dự án: `{ app: "tuong-chan-L", v: 1, p }` — **giữ nguyên khóa `app`** để tương thích hai chiều với app gốc.
9. DXF R12 `AC1009`, đơn vị mm (`×10`), unicode `\U+XXXX`, `*D*` block cho DIMENSION; `M3Tubes` chia chunk 60 000 đỉnh (`Uint16Array`).
11. **Khác biệt cố ý so với bản gốc (Mẫu 3)** nằm ở `engine/presetsApp.ts` (`appPresetKe`), KHÔNG ở `presetKe` (giữ nguyên để đối chiếu): (a) mặc định **không có chân khay** ở mọi chiều cao (thư viện gốc vẽ sẵn khay cho một số bản vẽ như K1, K2, K102…; người dùng tự bật); (b) cờ `Project.dimStem` làm `dimsSectionC` ghi chuỗi kích thước đứng 500 + 300 + **H** thay vì "mút + (tổng − mút)" (ví dụ H=4,20: 4200 thay cho 4500). Giao diện (`SidebarCadPanel`, `QuickHRow`) phải dùng `appPresetKe`; không có cờ `dimStem` thì CAD cho kết quả y như bản gốc. Test: `tests/cad/keDims.test.ts`.
10. **Đừng "sửa" công thức** trong `engine/`, `cad/`, `reports/`: test so khớp với module gốc chạy trong Node `vm` (`analysis/modules/01..23`). Cần đổi hành vi → cập nhật `specs/parity-spec.md` và test cùng lúc.

## Quy tắc clean-room (bắt buộc)
Chỉ dựng lại từ các module kỹ thuật an toàn đã trích. **Tuyệt đối không** thêm/ghi chép/tham chiếu bất kỳ cơ chế cấp phép, giới hạn dùng thử, định danh máy hay kích hoạt của app gốc, kể cả CSS/UI text/biến trạng thái (chi tiết: `../AGENTS.md` §1). Test `QA 6` trong `tests/qa/full_parity.test.ts` quét `index.html`, `start-webapp.bat`, `src/**` và chuỗi tác giả cũ; mọi thay đổi phải qua test này. (Biến `trial/trials/srmTrials` trong `fem2dCore.ts` là toán SRM, đã được test chuẩn hóa — đừng đổi tên để "lách" hay thêm từ tương tự ở nơi khác.)

## Giao diện: hợp đồng & quy ước
**Selector ổn định** (test unit + E2E dựa vào, đừng đổi id/class/thứ tự): `.app-shell[data-tpl][data-view][data-side]`, `#bOpen #fOpen #bSave[data-dirty] #bDxf #bPng #bDxfAll #bSvg #bPrint #bPdf #bDocx #bCsv #toast(.show/.ok/.err/.wait)`, `#sum .card`, `#warn`, `#panel`, `#preH #preK #preD`, `#calcR #calcHint #feStat #femStat #femRun`, `.cb[data-id] button.ap`, `#tabs > button` (đúng 7 nút theo thứ tự: 5 cụm, `#tab3d`, `#tabCalc`; thêm `span` thì được, thêm `button`/div bọc thì **không**), `#calcBadge`, `#stage svg`, `#sinfo`, `#bFit`, `#v3d #gl #v3msg #v3bar #v3leg #v3list #v3sum #v3ax #v3tip #v3foc #v3clipAxis #v3clipT #v3clipRow`, `#calcv .csub .csheet p.kl`, `.tpl`, `#rbtab`, `input[data-path]`.
Mới thêm: `#bSide` (nút icon thu gọn/mở NẰM TRONG `.side-head` của cột thông số; thu gọn = cột co thành thanh 52 px chỉ còn nút này; trên điện thoại ẩn đi), `#bSideOpen` (chỉ điện thoại, trong thanh tab, mở ngăn kéo), `#bZoomIn/#bZoomOut/#bZoomFit`, `#v3barToggle`, `.side-close`, `.scrim`.
Nâng cấp giao diện (store `appStore.ts` + `components/CommandPalette.tsx`): `#bCmd` (mở bảng lệnh; `.cmdk`, `#cmdQ`, `.cmdk-item`), `#bUndo/#bRedo`, `#bTheme`, `#bRestore/#bDraftX` (chỉ hiện khi có bản nháp), `.app-shell[data-theme="light"|"dark"]`, thanh mức sử dụng `.card.ck .ub > i` (phần tử rỗng, không đổi `textContent`).
- **Hoàn tác / làm lại**: một `useEffect([project])` trong store ghi lịch sử (tối đa 100 bước, các thay đổi cách nhau < 700 ms gộp làm một; mở file thì xóa lịch sử). Mọi đường đổi `project` đều tự được ghi — không cần gọi gì thêm; muốn một thay đổi KHÔNG vào lịch sử thì đặt `histRef.current.skip = true` trước `setProject`.
- **Phím tắt** (gắn một lần ở `CommandPalette`): Ctrl+K bảng lệnh, Ctrl+S lưu, Ctrl+O mở, Ctrl+B thu/mở bảng thông số, Ctrl+Z / Ctrl+Y (bỏ qua khi con trỏ đang trong ô nhập), `1`–`5` cụm bản vẽ, `6` 3D, `7` Tính toán, `F` vừa khung, `/` bảng lệnh. Bảng lệnh tìm không dấu (`foldVi`, `matchQuery`) và quét `#panel label.row/.chk` để nhảy tới ô nhập.
- **Bản nháp tự lưu**: `localStorage['tuong-chan-btct:draft']` = `{ t, name, data }` (`data` là chuỗi `serializeProject`), ghi sau 800 ms khi có thay đổi chưa lưu, xóa khi dự án sạch; phiên sau chỉ hiện nút khôi phục, KHÔNG tự nạp (trạng thái mặc định khi tải trang phải giữ nguyên cho E2E). Giao diện: `localStorage['tuong-chan-btct:theme']`, mặc định sáng.
- **Giao diện tối** chỉ là khối ghi đè token ở cuối `app.css` dưới `.app-shell[data-theme="dark"]` (không lọt vào iframe in); `.csheet`/`.feview` vẫn là giấy trắng. Thêm màu nền ghi cứng ở nơi khác thì phải thêm dòng ghi đè tương ứng trong khối này.
- Header: ≤1700 px nút tìm lệnh chỉ còn icon, ≤1600 px nén khoảng đệm nút, ≤1560 px ẩn `.brand small` (chữ vẫn trong DOM cho test).

**Chuỗi chữ test so sánh chính xác** — thay đổi hiển thị phải giữ `textContent`: thẻ KPI (`'Bê tông21,50 m³'`…), `#calcBadge` (`'✗ 3'`, `'✓'`), `summary` đầu tiên `'0. Chọn mẫu bản vẽ'`, `header .brand small` (`'Bản vẽ 2D · mô hình 3D · kiểm toán TCVN 11823 · LEDAT'`), `#sinfo`, `.cbs` (`'✓'`). Ký hiệu `✓ ✗ ⚠` được vẽ thành icon bằng `<Sym>/<Glyphs>` (`Icon.tsx`) — ký tự gốc vẫn nằm trong DOM (ẩn bằng CSS `.g`) nên test không đổi; render trạng thái mới hãy dùng `<Glyphs text=…/>`.
Số liệu mốc Mẫu 1 (H = 500 cm): Bê tông 21,50 m³ · Ván khuôn 64,64 m² · BT lót 1,50 m³ · Cốt thép 2370 kg · 110,2 kg/m³ · badge `✗ 3` · `#sinfo` = `Cụm chi tiết · tỷ lệ 1/20 · rộng 766 × cao 419 mm trên giấy`.

**Thương hiệu**: tên app **"Tường chắn BTCT"** (header, `<title>`, favicon, `BrandMark`, `docProps/app.xml` = `Tường chắn BTCT - LEDAT`, được 3 test kiểm tra). Tên dự án mặc định `'TƯỜNG CHẮN BTCT CHỮ L'` trong `engine/presets.ts` là dữ liệu bản vẽ/tên file xuất, giữ nguyên để khớp bản gốc.

**CSS (`src/styles/app.css`)**
- Token ở `:root`; **toàn trang một tông xanh dương + trắng** (không còn màu nhấn riêng theo chế độ; `--c2d/--c3d/--cca` đều là xanh dương). Header **sáng** (nền trắng → xanh rất nhạt, vạch xanh 3 px dưới đáy, logo xanh, nút nền trắng viền nhạt, nút chính `.pri` xanh đặc chữ trắng); thanh công cụ 3D sáng; dùng `--acc/--accd/--accs/--accb/--ring`; chỉ giữ màu ngữ nghĩa cho trạng thái `--ok` (xanh lá) / `--bad` (đỏ) / `--warn` (vàng). Đừng hard-code hex mới nếu đã có token. Khung bản vẽ 2D và canvas 3D vẫn tối theo quy ước CAD (`BG_DARK`).
- Nền khung bản vẽ 2D phải là `#212830` (= `BG_DARK` trong `cad/layers.ts`); canvas 3D clear color cố định cùng tông.
- Khối `.csheet …` (tờ báo cáo trắng/Times) giữ nguyên; **bản in/PDF nhúng toàn bộ CSS của trang** (`collectDocumentCss`) vào iframe → mọi rule thêm cho giao diện phải gắn selector riêng của app (`#calcv …`, `.app-shell …`) để không làm hỏng bản in. Test đọc `app.css` kiểm `#v3foc button { pointer-events: auto }`.
- Điểm ngắt: ≤1450 (nút "Thông số" chỉ icon), ≤1250 (nút chế độ chỉ icon), ≤1100, **≤900 = điện thoại** (sidebar thành ngăn kéo `position:fixed` mặc định đóng, tab cuộn ngang với nút 3D/Tính toán ghim phải, thanh 3D một hàng cuộn, tờ bảng tính `zoom` vừa bề ngang), ≤640 (header một hàng chỉ icon), ngang-thấp (≤480px cao). `@media (pointer: coarse)`: input 16 px, ô 40 px. Trên điện thoại sidebar mặc định **đóng** (`App.tsx` đọc `matchMedia('(max-width: 900px)')`) và chú giải 3D mặc định thu nhỏ; `getLegOffsetPx` của `V3` trả 0 khi ≤900 px. Thông báo `#toast`: kind `wait` không tự tắt, `ok` 6 s, `err` 12 s.
- Kiểm tra mobile bằng cách giả lập 375×812: bản vẽ 2D kéo 1 ngón / nhéo 2 ngón / chạm đúp = vừa khung (`attachCadViewport` trong `cad/svg.ts`); 3D: 1 ngón xoay, 2 ngón thu phóng + di chuyển (`V3`, đã có sẵn).

## Bố cục "3D làm trung tâm" + lõi vẽ three.js (LEDAT-BIM)
- **Tên trang: LEDAT-BIM** (`header .brand b`, `<title>` = `LEDAT-BIM · Tường chắn BTCT`, `docProps/app.xml` `<Application>LEDAT-BIM</Application>` – 3 test kiểm tra). Dòng `header .brand small` giữ nguyên chuỗi cũ. Mọi chỗ ở trên còn ghi tên app "Tường chắn BTCT" là đã cũ.
- **Mặc định khi mở trang**: chế độ **3D** (`viewMode '3d'`), giao diện **tối**, kiểu xem **chân thực**. Test `appUi` gọi `mountApp()` sẽ tự bấm cụm bản vẽ 1 để bắt đầu từ 2D.
- **Bố cục máy tính (> 900 px)** là khối CSS cuối `app.css` với selector `.app-shell[data-view] …`: vùng xem phủ toàn cửa sổ; `header`, `aside`, `nav`, thanh công cụ 3D (`#v3bar > .v3dock` + bảng bật lên `.v3more`, mặc định đóng – mở bằng `#v3barToggle`) là bảng kính nổi (`--glass*`), chú giải/nhãn 3D là kính tối (`--hud`). DOM và id cũ giữ nguyên (vẫn đúng 7 `#tabs > button`; thứ tự hiển thị đổi bằng CSS `order`: 3D, Tính toán, rồi 5 cụm). Điện thoại (≤ 900 px) giữ bố cục ngăn kéo cũ với màu mới.
- **3D**: `model3d/scene3.ts` (`Scene3`, three.js r170) dựng cảnh và vẽ; `V3` (`viewer3d.ts`) vẫn giữ camera, chọn thanh (`v3Pick`), `toScreen`, sự kiện, PNG – ma trận `v3m` và camera three.js dùng cùng tham số nên hình vẽ trùng với phép chọn / nhãn. Các chuỗi shader `V3_VS_*`/`V3_FS_*` chỉ còn để test đối chiếu bản gốc, KHÔNG dùng để vẽ nữa.
  - `V3.look`: `real` (bê tông đặc `surf = 0`, vòm trời, bãi cỏ, sương, bóng mềm VSM, đổ bóng tiếp xúc GTAO qua `EffectComposer`, không nét viền/lưới) · `xray` (`surf = 0,5`, nền tối, nét viền + lưới, đèn theo camera). `setLook()` đổi; thanh "Độ mờ bề mặt" vẫn chỉnh tiếp được. Bê tông đặc thì `pick()` trả null; cô lập một mác thép thì `surfEff()` tự thành 0,7.
  - Vật liệu thủ tục (bê tông có ván khuôn/lỗ ty, đất theo loại, cỏ) cấy vào `MeshStandardMaterial` bằng `onBeforeCompile` (`proceduralMaterial`); ống thép dùng lại bộ đệm `M3Tubes` (10 số/đỉnh) với `tubeInject`. Thứ tự vẽ khi trong mờ dựa trên `renderOrder` (thép 0 → lưới 1 → viền 2 → bê tông mặt sau 3 / trước 4 → ghi độ sâu 5 → đất 6 → viền đất 7 → thanh đang rê 10) – đừng đổi tuỳ tiện.
  - GTAO tự tắt khi cắt lát, trong mờ, trực giao hoặc đang cô lập; máy không dựng được hậu kỳ thì `aoOk = false` và vẽ thẳng.
  - `V3.sceneFactory` cho phép test thay lõi vẽ bằng bản giả (xem `tests/cad/cad_export.test.ts`). `Scene3` tự xin ngữ cảnh `webgl2`; không có thì ném lỗi → `V3.errMsg` (jsdom: `getContext` trả null).
  - `getInsets()` (trong `Model3DViewport`) đo phần canvas bị bảng nổi che để căn mô hình và nhãn đất vào vùng trống; khung căn theo `fitBox` (kết cấu + đất đắp + đất nền), còn `model.bbox` giữ nguyên để đối chiếu.
- Gói JS sau khi thêm three.js: ~1,88 MB (gzip ~648 kB).
- Chụp ảnh kiểm tra giao diện khi ngăn Browser bị ẩn: dùng Chrome headless qua `playwright-core` (cờ như E2E) trỏ vào dev server.

## 3D: vật liệu ảnh thật, HDRI, bo cạnh, thời tiết
- **Tài nguyên** ở `public/tex/` (4,7 MB, CC0 từ Poly Haven – xem `README.txt` trong đó): 5 bộ vật liệu 1K `conc/mud/sand/grass/bark` × (`_d` màu, `_n` pháp tuyến, `_arm` AO+độ nhám) và `sky_1k.hdr`. `Scene3.loadAssets()` nạp không đồng bộ; **chưa nạp xong / ngoại tuyến thì cảnh vẫn chạy bằng vật liệu thủ tục và vòm trời vẽ bằng mã** (đường cũ giữ nguyên làm dự phòng). Nạp xong → `rebuild()` + `onAssets` (V3 vẽ lại).
- **Vật liệu ảnh**: `texturedMaterial()` = `MeshStandardMaterial` chuẩn (map / normalMap / roughnessMap / aoMap) + cấy thêm biến thiên màu tần số thấp, chống lặp ô ảnh (`detile`) và bo cạnh. UV do `texGeometry()` gán sẵn theo phép chiếu hộp (1 UV = `TEX_SIZE[...]` cm); màu lớp đất giữ bằng `tintTo(target, name)` (màu đích / màu trung bình ảnh `TEX_MEAN`). **Mỗi lưới chỉ một vật liệu** – mặt cỏ trên khối đất là lưới riêng (`SoilItem.top`).
- **Bo cạnh bằng pháp tuyến**: `texGeometry(..., { bevel: true })` tách tam giác và ghi cho mỗi cạnh "gãy" khoảng cách tới cạnh (`aEd`) + pháp tuyến trung bình hai mặt kề (`aB0..2`); shader nghiêng pháp tuyến trong bán kính `uBevR` (bê tông 2,5 cm, đất 5 cm). Chỉ là hiệu ứng chiếu sáng, hình học không đổi.
- **HDRI**: `applyHdr()` dùng ảnh làm nền + ánh sáng môi trường (PMREM), dò điểm sáng nhất để lấy góc cao mặt trời, rồi xoay bầu trời (`scene.backgroundRotation/environmentRotation`) cho phương vị mặt trời trùng `SUN_DIR` của cảnh; màu sương lấy từ dải trời sát chân trời.
- **Thời tiết** (`V3.weather`, `#v3weather` trong Tùy chọn; chỉ ở kiểu Chân thực): bảng `WEATHER` trong `scene3.ts` (nắng / nhiều mây / mưa / hoàng hôn / sương mù) đổi cường độ + màu + góc cao mặt trời, ánh sáng môi trường, độ phơi sáng, khoảng sương, độ ướt bề mặt (`wetMats`: sẫm màu + giảm độ nhám) và mưa rơi (`LineSegments` 1800 vệt, cập nhật theo thời gian). Nắng dùng nền HDRI; các kiểu khác dùng vòm trời tô màu (`paintDome`). Khi mưa `scene.animating = true` → V3 vẽ liên tục.
- Test: `tests/model3d/scene3geo.test.ts` (UV, bo cạnh, tách mặt trên, nhuộm màu, trạng thái thời tiết với lõi vẽ giả). Tính năng render dò tia (path tracing) đã thử rồi gỡ bỏ theo yêu cầu người dùng – đừng thêm lại khi chưa được yêu cầu.

## Mô đun móng cọc BTCT (mở rộng, đang làm theo giai đoạn)
Kế hoạch đầy đủ: `~/.claude/plans/foamy-sauteeing-tide.md` (GĐ0 nền tảng → GĐ1 sức chịu tải dọc trục + nhóm cọc → GĐ2 bản vẽ/3D/khối lượng → GĐ3 cọc chịu ngang → GĐ4 kết cấu cọc → GĐ5 lún). **Đã xong: GĐ0 (dữ liệu + UI nhập), GĐ1 (sức chịu tải dọc trục + phản lực nhóm cọc theo TCVN 10304:2025) và GĐ2 (mô phỏng: bản vẽ, 3D, khối lượng).** Chưa làm: GĐ3 (cọc chịu ngang), GĐ4 (kết cấu cọc), GĐ5 (lún).
- Loại cọc `PileConfig.type`: `sq` vuông đúc sẵn, `rc` tròn đặc đúc sẵn (cùng bảng cọc đóng, có lồng thép tròn), `phc` ly tâm (rỗng, không thép rời), `bored` khoan nhồi.
- Dữ liệu: `Project.pile?: PileConfig` (`types/project.ts`); `engine/pile.ts` (`pileDefaults`, `pileEnsure`, `pileOn`, `pileNewLayer/Row/Table`); UI `components/PilePanel.tsx` đặt ở HAI nơi dùng chung dữ liệu: mục **"2c. Móng cọc BTCT"** của tab bản vẽ (mở sẵn, ngay sau mục 2) và accordion **12** của tab Tính toán; ô nhập `CellNum`/`OptNumField` (cho phép 0 và ô trống = `null`).
- **Bất biến: `pile` vắng mặt = tắt hoàn toàn và kết quả giữ bit-identical với bản gốc.** Không đưa `pile` vào `calcDefaults` (đúng 96 khóa), `baseProject`, `preset*`; chỉ `pileEnsure` (no-op khi vắng) gọi từ `cloneProject`, `updateProject`, cuối `mergeProject`; `'pile'` nằm trong `META_KEYS`. Không sửa `calcChecks/calcBadgeCount/calcSheetHTML/buildBars` — kiểm tra/báo cáo/bản vẽ cọc đi qua hàm riêng gắn điều kiện `pileOn(p)`. Không thêm layer CAD, không thêm sheet, vẫn đúng 7 nút `#tabs > button`.
- **Bảng tra TCVN 10304:2025 được nhúng sẵn** (Bảng 2, 3, 7, 8 trong `engine/tcvn10304Data.ts` — FILE SINH TỰ ĐỘNG, không sửa tay; hệ số Bảng 4, 6, γn, γk, γc trong `engine/tcvn10304.ts`) và tự tra theo từng lớp đất (`kind`, `grain`, `clayType`, `IL`, hệ số hiệu chỉnh `kf`/`kb`). Không còn bảng/hệ số nhập tay (`pile.fi/qb/coef/spt` đã bỏ). Bản docx tiêu chuẩn nằm ở `TCVN/` (đã `.gitignore`, bản quyền) — không commit. Cách đọc ô dùng chung của Bảng 2/3 (ô hai số = cát/sét) ghi trong đầu file dữ liệu; số liệu mặc định địa tầng chỉ là ví dụ.
- **GĐ2 (mô phỏng) – điểm nối:**
  - Hình học: `engine/pileGeom.ts` (`pileGrid(p, B)` lưới cọc cm, `pileArea`, `pileHoopLevels`, `pileMainOffsets`, `pileQuantities`, `appendPileBars`). `pileGrid` trả `null` khi tắt; cọc căn giữa theo bề rộng và theo Lu, hàng lẻ bố trí so le thì ít hơn 1 cọc.
  - Thép cọc: `buildBars` (wrapper trong `engine/rebar.ts`) gọi `appendPileBars` SAU khi các mẫu tường đã đánh mác; thêm thanh `pm` (mác `P1`, thép dọc) và `ph` (mác `P2`, đai) với cờ `pile: true`. Cọc ly tâm (`phc`) không có thép rời. Mọi nơi duyệt `res.bars` theo từng 1 m tường phải lọc `!b.pile` (đã làm ở `calcRbSchedule`).
  - Khối lượng: `quantities()` thêm `q.pile` (`n`, `volEach`, `vol`, `totLen`, `steelKg`) chỉ khi bật; `q.vol` vẫn là bê tông tường, `ratio` tính trên (tường + cọc); thẻ "Số cọc"/"Bê tông cọc" ở `SidebarMetrics`.
  - 2D: `cad/viewsPile.ts` (`viewPileSection`, `viewPilePlan` thêm vào sheet 0; `viewPileCage` thêm vào sheet 2 khi `pileCageOn(p)`); cọc dài > 7 m vẽ có đường cắt lìa, chiều dài thật ghi ở kích thước; chỉ dùng layer có sẵn.
  - 3D: `model3d/piles3d.ts` (`m3PileMesh`, `m3PileGroups`), `M3Mesh.vprism`, `Model3DData.pile?`/`gpu.pile?` (`viewer3d.ts` free/upload/draw, bật tắt cùng `vis.conc`), `bbox.y0` hạ theo chiều dài cọc và `sig` đổi khi bật; số vòng đai vẽ giới hạn ~3000 (thống kê vẫn đủ).
  - Lồng thép (`pile.cage`) hiện là **dữ liệu nhập** để vẽ/thống kê; kiểm tra khả năng chịu lực ở GĐ4. Test: `tests/engine/pileGeom.test.ts`.
- **GĐ1 (sức chịu tải) – điểm nối:**
  - `engine/tcvn10304.ts` (tra bảng, nội suy tuyến tính theo độ sâu và IL, hệ số), `engine/pileCore.ts` (`pileCapacityCompression`: tra bảng / SPT Phụ lục D / thí nghiệm; `pileTension`; `pileRowLoads`; `pileRun(P, combos, B_cm)` → `PileResult`), `engine/pileChecks.ts` (`pileFromCalc`, `pileChecks`, `allChecks`, `badgeStatusAll`). Độ sâu bảng tra tính từ MẶT ĐẤT TỰ NHIÊN = `design.z0` + độ sâu từ đáy đài; lớp chia ≤ 2 m; địa tầng phải phủ hết chiều dài cọc, thiếu thì `ok=false` + `missing[]` (không cho số).
  - Tải lấy từ `calcRun(P).C[]` (tổ hợp TCVN 11823 đã nhân hệ số; `s` = độ lệch tâm hợp lực, dương về gót) nhân bước hiệu dụng `Lu/nz`; sức kháng theo 10304 (lai có chủ ý). `γn·Nd ≤ Rk/γk`.
  - UI/hiển thị: `SidebarMetrics` dùng `allChecks(project, R)` (tắt cọc = đúng `calcChecks`); `App.tsx` dùng `badgeStatusAll`; khi bật cọc + `ignoreShallow`, `br`/`sl` thành `info` (`EngineCheckItem.tip`). Báo cáo: `reports/calcPileSheet.ts`, tab con `'pile'` ("Móng cọc", chỉ hiện khi bật) và mục nối cuối `calcSheetHTML` chỉ khi `pileOn`.
  - Test: `tests/engine/pileCore.test.ts` (golden tính tay: cọc đóng sét, SPT, khoan nhồi sét, thí nghiệm, lệch tâm, nhổ, bất biến tắt = y nguyên).
- **3D nền đất (hiển thị):** `model3d/ground3d.ts` (`m3Ground`, `groundColor`) → `Model3DData.ground?` (khối đất theo từng lớp `pile.layers` tới 3 m dưới mũi cọc + lớp đất phủ trước mũi đến `design.z0`; không có cọc thì một khối nền đất rời/dính/đá theo `calc.soil`). Chỉ để xem: KHÔNG đổi `conc/lean/soil/bbox/sig` (test so oracle). Shader riêng `V3_FS_SOIL` (hạt + vân lớp + mặt trên phủ cỏ, dùng `V3_VS_MESH`) — KHÔNG sửa `V3_VS_MESH/V3_FS_MESH` (test so chuỗi với bản gốc). công tắc "Đất đắp" (`soil`) và "Đất nền" (`strata`) đều mặc định bật; thanh "Độ mờ bề mặt" 0–100 % (`V3.surf`, mặc định 50 %; 100 % = trong suốt): độ đặc đất = 1 − surf, bê tông α = 1 − surf. Vẽ: bê tông (shader `V3_FS_CONC` – xám xi măng, lỗ rỗng, ván khuôn, lỗ ty) → ghi độ sâu mặt trước bê tông (colorMask off) → đất (`V3_FS_SOIL`, `uKind` cát/sét/bùn/đá/đắp, ghi độ sâu, chỉ mặt trước, polygonOffset) → nét viền đất; thứ tự này tránh lỗi nhìn xuyên thấu — đừng quay lại vẽ đất không ghi độ sâu. Mock WebGL trong `cad_export.test.ts` phải có mọi hàm `gl.*` mới dùng; chú giải `#v3soil` (mỗi lớp có ô tick ẩn/hiện `V3.hiddenGround`, loại đất `kindText`, chỉ tiêu `props`) nằm ngoài `#v3list` (E2E đếm `#v3list .lg`). **Nhãn chĩa ra từ từng lớp đất:** `#v3lab` (phủ trên canvas, `pointer-events:none`) do `components/soilLabels.ts` cập nhật trực tiếp DOM sau mỗi lần vẽ (`V3` option `onDraw`, `V3.toScreen(x,y,z)` chiếu 3D→px, bỏ điểm bị mặt cắt cắt); vị trí tránh chồng nhau tính bằng hàm thuần `model3d/labels3d.ts` (`layoutSoilLabels`); công tắc `V3Visibility.labels` ("Nhãn đất"); tên lớp do người dùng nhập được gán bằng `textContent` (không `innerHTML`). Test: `tests/model3d/labels3d.test.ts`. Test: `tests/model3d/ground3d.test.ts`.
- Đơn vị của `pile`: m, kN, kPa (khác hình học tường bằng cm). Test: `tests/engine/pile.test.ts` + khối "Móng cọc" trong `tests/appUi.test.tsx`; không có oracle nên dùng golden tính tay.

## Mô đun móng cừ tràm (mở rộng)
Dựng theo hai bảng tính của người dùng trong `bang tinh/` (chưa commit): `01.MÓNG CỪ TRÀM.xls(x)` (sức chịu tải khối móng cừ, theo ThS Lê Anh Hoàng) và `tinh_nen_mong_cong tron60.xls` (từng cây cừ theo 20TCN 21-86, số cây/m², móng khối quy ước, đất dưới mũi cừ theo 20TCN 45-78).
- Dữ liệu: `Project.cu?: CuTramConfig` (m, kN, kPa; riêng `d` là cm). **Vắng mặt = tắt hoàn toàn, kết quả tường y nguyên** – cùng quy tắc với `pile`: không đưa vào `calcDefaults`/`preset*`; `cuEnsure` (no-op khi vắng) gọi ở `cloneProject`, `updateProject`, cuối `mergeProject`; `'cu'` nằm trong `META_KEYS`.
- Tính toán: `engine/cuTram.ts` – `cuABD`, `cuRtc`, `cuTerzaghi` (bảng N'c/N'q/N'γ 0–50° nhúng sẵn, nội suy tuyến tính), `cuBlock` (Qm, Qf, Qtk), `cuSideF`/`cuSegments`/`cuSingle` (Qc một cây), `cuBqu`, `cuRBlock`, `cuRun(q, combos, B, Lu)`, `cuGrid`, `cuCheckItems`. Nối với tường ở `engine/pileChecks.ts`: `cuFromCalc`, và `allChecks`/`badgeStatusAll` thêm 3 mục `cu-block`, `cu-count`, `cu-base` (bật `ignoreShallow` thì `br` thành tham khảo).
  - Áp lực đáy móng p = N/(B − 2|e|): p_tc từ tổ hợp `SD`, p_tt là lớn nhất của các tổ hợp còn lại.
  - **Khác bảng tính có chủ ý**: bảng (1) bỏ số hạng B·h·γ' (ô AA5 trống) và lấy D = 3,14 (ô F21 trống) → Rtc 24,85; ứng dụng dùng công thức đầy đủ. Bảng (2) tra A, B, D bằng bảng nội suy, ứng dụng dùng công thức (lệch < 3 %); số cây làm tròn LÊN (bảng tính làm tròn gần nhất). Quy tắc tra f theo độ sâu giữ đúng như bảng (2): đoạn đầu tra tại đáy đoạn, các đoạn sau tại giữa đoạn.
  - Chưa làm: tính lún móng khối quy ước; bản vẽ 2D cừ tràm.
- Giao diện: `components/CuTramPanel.tsx` ở mục **"2d. Móng cừ tràm"** (tab bản vẽ) và mục **13** (tab Tính toán); báo cáo `reports/calcCuSheet.ts`, tab con `'cu'` ("Cừ tràm", chỉ hiện khi bật) và nối cuối `calcSheetHTML` khi bật; thẻ "Cừ tràm" / "Tổng dài cừ" ở `SidebarMetrics` (`quantities().cu`).
- 3D: `model3d/cu3d.ts` (`m3CuMesh`: cây thuôn dần, hơi lệch/cong tất định, mũi nhọn; `cuTopY` = đáy bê tông lót) → `Model3DData.cu?`; `scene3.ts` vẽ bằng vật liệu gỗ thủ tục (`GLSL_WOOD`), công tắc `V3Visibility.cu` ("Cừ tràm", chỉ hiện khi có cừ). `ground3d.ts`: khi bật cừ (và không có cọc BTCT) dựng khối "Đất yếu gia cố cừ tràm" sâu hơn mũi cừ 1 m + lớp đất phủ `hm`. `bbox.y0` và `sig` đổi khi bật. Kiểu xem "Chân thực" đất đặc nên không thấy cừ – xem ở "Xem cốt thép", ẩn "Đất nền" hoặc cắt lát.
- Test: `tests/engine/cuTram.test.ts` (đối chiếu từng ô của hai bảng tính + bất biến tắt + mô hình 3D) và một kịch bản giao diện trong `tests/uiUpgrade.test.tsx`.

## Mô đun tính lún cố kết của nền (mở rộng)
Dựng theo bảng tính của người dùng `bang tinh/01. KIỂM TOÁN LÚN NỀN ĐẮP_Hay dung.xlsm` (chưa commit; chỉ đọc công thức / giá trị, không chạy macro – hai hàm VBA `Igt`, `NoisuyDay` được dựng lại và kiểm bằng số).
- Dữ liệu: `Project.lun?: LunConfig` (m, kN/m³, kPa; `Cv` tính bằng 10⁻⁴ cm²/s). **Vắng mặt = tắt hoàn toàn** – cùng quy tắc với `pile`/`cu` (`lunEnsure` ở `cloneProject`, `updateProject`, cuối `mergeProject`; `'lun'` trong `META_KEYS`).
- Tính toán: `engine/lun.ts` – `lunCalc` (phân tầng lấy tổng: mỗi lớp chia phân tố `dz` + phân tố dư; ứng suất tại giữa phân tố; đẩy nổi γ − γw khi dưới mực nước và γ > γw; TH1/TH2/TH3 theo Cc, Cr, Pc; chỉ cộng phân tố có σz/σvz ≥ `stop`), `lunCvAvg` (Cvtb = za²/(Σh/√Cv)²), `lunTime` (Tv = Cv·t/H², 1 năm = 360 ngày, St = Sc·U), `lunU` (bảng U–Tv của sheet "UV", nội suy tuyến tính), hệ số ứng suất `lunEmbankI` (Osterberg = `Igt`), `lunStripK`, `lunHalfK`; `lunRun` cho tường; `lunCheckItems` (mục `lun-s`). γw = 10 kN/m³ (bảng tính dùng 1 T/m³).
- **Mô hình tải cho tường (khác bảng gốc – bảng gốc là nền đường đắp hình thang; người dùng đã duyệt ngày 2026-11-12)**, tính tại trục giữa đáy: p = N/B của tổ hợp `SD`; p_gl = p − σbt(đáy móng) trên tải băng rộng B; tùy chọn `backfill`: đất đắp sau gót là tải nửa mặt phẳng q = γđ·Hp − σbt, mép cách trục B/2. Có cừ tràm: tải đặt tại mũi cừ trên B_qu với cường độ p_gl·B/B_qu, các phân tố trong thân khối cừ không tính lún (`skip`), `hm` lấy từ `cu.hm`. Tải nửa mặt phẳng không tắt theo độ sâu (→ q/2) nên vùng tính lún thường chạm đáy địa tầng – có cảnh báo.
- Nối: `engine/pileChecks.ts` (`lunFromCalc`, `allChecks`/`badgeStatusAll`); giao diện `components/LunPanel.tsx` ở mục **14** của tab Tính toán; báo cáo `reports/calcLunSheet.ts`, tab con `'lun'` ("Lún") và nối cuối `calcSheetHTML` khi bật.
- Chưa làm: tự lặp chiều cao đắp theo độ lún (bảng gốc nhập tay "độ lún giả thiết"), lún tức thời / từ biến riêng, hiển thị 3D.
- Test: `tests/engine/lun.test.ts` (đối chiếu cả 38 phân tố σz, σvz, Si; Sc, Za, S, Cvtb, bảng lún theo thời gian) + kịch bản giao diện trong `tests/uiUpgrade.test.tsx`.

## Quy trình làm việc
1. Sửa → `npm run typecheck` → `npx vitest run` → (nếu đụng `src/` hoặc `index.html`) `npm run build` → `node tests/qa/e2e_browser.mjs`.
2. **Sau mỗi bước hoàn tất, thêm mục vào `../CHANGELOG.md`** (mới nhất đặt trên cùng): vai trò, file đã sửa, lệnh đã chạy + số liệu pass/fail thật, việc còn mở. Sửa quy ước/cấu trúc thì cập nhật cả `../AGENTS.md` và `specs/*`. Sau khi sửa lỗi nêu trong `specs/qa-verification-report.md`: chạy lại đủ build + Vitest + E2E và cập nhật báo cáo đó; khi mọi check PASS thì chuyển trạng thái mục 4 của `specs/evidence-ledger.md` từ `SPECIFIED/OPEN` sang `VERIFIED` kèm bằng chứng test.
3. Không để file tạm/ảnh chụp/script nháp trong repo (dùng thư mục scratchpad). `dist/` và `node_modules/` không commit.
4. Commit theo kiểu `feat(ui): …` / `fix: …`; chỉ push khi người dùng yêu cầu. Cảnh báo "LF will be replaced by CRLF" trên Windows là bình thường.
5. Phân vai (khi dùng sub-agent): solver → `src/engine/*`+`tests/engine`; CAD/3D → `src/cad`,`src/model3d`,`export/csv.ts`,`tests/cad`; frontend → App/store/components/styles/reports/export(docx,pdf,projectIo)/`appUi`+`engineAndReports` tests; QA → `tests/qa/*`, `specs/qa-verification-report.md` (QA báo lỗi, không tự sửa code production).
