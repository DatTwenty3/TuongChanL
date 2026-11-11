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
| Test | `npx vitest run` | 6 file, **105 test**, ~100 s (jsdom). Một test duy nhất: `npx vitest run tests/engine/parity.test.ts` (21 test) |
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
  model3d/  (4 file)       mesh, ống thép (M3Tubes), viewer WebGL thô `V3` (cắt lát, pick, PNG)
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

**Chuỗi chữ test so sánh chính xác** — thay đổi hiển thị phải giữ `textContent`: thẻ KPI (`'Bê tông21,50 m³'`…), `#calcBadge` (`'✗ 3'`, `'✓'`), `summary` đầu tiên `'0. Chọn mẫu bản vẽ'`, `header .brand small` (`'Bản vẽ 2D · mô hình 3D · kiểm toán TCVN 11823 · LEDAT'`), `#sinfo`, `.cbs` (`'✓'`). Ký hiệu `✓ ✗ ⚠` được vẽ thành icon bằng `<Sym>/<Glyphs>` (`Icon.tsx`) — ký tự gốc vẫn nằm trong DOM (ẩn bằng CSS `.g`) nên test không đổi; render trạng thái mới hãy dùng `<Glyphs text=…/>`.
Số liệu mốc Mẫu 1 (H = 500 cm): Bê tông 21,50 m³ · Ván khuôn 64,64 m² · BT lót 1,50 m³ · Cốt thép 2370 kg · 110,2 kg/m³ · badge `✗ 3` · `#sinfo` = `Cụm chi tiết · tỷ lệ 1/20 · rộng 766 × cao 419 mm trên giấy`.

**Thương hiệu**: tên app **"Tường chắn BTCT"** (header, `<title>`, favicon, `BrandMark`, `docProps/app.xml` = `Tường chắn BTCT - LEDAT`, được 3 test kiểm tra). Tên dự án mặc định `'TƯỜNG CHẮN BTCT CHỮ L'` trong `engine/presets.ts` là dữ liệu bản vẽ/tên file xuất, giữ nguyên để khớp bản gốc.

**CSS (`src/styles/app.css`)**
- Token ở `:root`; **toàn trang một tông xanh dương + trắng** (không còn màu nhấn riêng theo chế độ; `--c2d/--c3d/--cca` đều là xanh dương). Header **sáng** (nền trắng → xanh rất nhạt, vạch xanh 3 px dưới đáy, logo xanh, nút nền trắng viền nhạt, nút chính `.pri` xanh đặc chữ trắng); thanh công cụ 3D sáng; dùng `--acc/--accd/--accs/--accb/--ring`; chỉ giữ màu ngữ nghĩa cho trạng thái `--ok` (xanh lá) / `--bad` (đỏ) / `--warn` (vàng). Đừng hard-code hex mới nếu đã có token. Khung bản vẽ 2D và canvas 3D vẫn tối theo quy ước CAD (`BG_DARK`).
- Nền khung bản vẽ 2D phải là `#212830` (= `BG_DARK` trong `cad/layers.ts`); canvas 3D clear color cố định cùng tông.
- Khối `.csheet …` (tờ báo cáo trắng/Times) giữ nguyên; **bản in/PDF nhúng toàn bộ CSS của trang** (`collectDocumentCss`) vào iframe → mọi rule thêm cho giao diện phải gắn selector riêng của app (`#calcv …`, `.app-shell …`) để không làm hỏng bản in. Test đọc `app.css` kiểm `#v3foc button { pointer-events: auto }`.
- Điểm ngắt: ≤1450 (nút "Thông số" chỉ icon), ≤1250 (nút chế độ chỉ icon), ≤1100, **≤900 = điện thoại** (sidebar thành ngăn kéo `position:fixed` mặc định đóng, tab cuộn ngang với nút 3D/Tính toán ghim phải, thanh 3D một hàng cuộn, tờ bảng tính `zoom` vừa bề ngang), ≤640 (header một hàng chỉ icon), ngang-thấp (≤480px cao). `@media (pointer: coarse)`: input 16 px, ô 40 px. Trên điện thoại sidebar mặc định **đóng** (`App.tsx` đọc `matchMedia('(max-width: 900px)')`) và chú giải 3D mặc định thu nhỏ; `getLegOffsetPx` của `V3` trả 0 khi ≤900 px. Thông báo `#toast`: kind `wait` không tự tắt, `ok` 6 s, `err` 12 s.
- Kiểm tra mobile bằng cách giả lập 375×812: bản vẽ 2D kéo 1 ngón / nhéo 2 ngón / chạm đúp = vừa khung (`attachCadViewport` trong `cad/svg.ts`); 3D: 1 ngón xoay, 2 ngón thu phóng + di chuyển (`V3`, đã có sẵn).

## Mô đun móng cọc BTCT (mở rộng, đang làm theo giai đoạn)
Kế hoạch đầy đủ: `~/.claude/plans/foamy-sauteeing-tide.md` (GĐ0 nền tảng → GĐ1 sức chịu tải dọc trục + nhóm cọc → GĐ2 bản vẽ/3D/khối lượng → GĐ3 cọc chịu ngang → GĐ4 kết cấu cọc → GĐ5 lún). **Đã xong: GĐ0 (dữ liệu + UI nhập) và GĐ2 (mô phỏng: bản vẽ, 3D, khối lượng).** Chưa làm: GĐ1 (tính sức chịu tải), GĐ3, GĐ4, GĐ5.
- Dữ liệu: `Project.pile?: PileConfig` (`types/project.ts`); `engine/pile.ts` (`pileDefaults`, `pileEnsure`, `pileOn`, `pileNewLayer/Row/Table`); UI `components/PilePanel.tsx` đặt ở HAI nơi dùng chung dữ liệu: mục **"2c. Móng cọc BTCT"** của tab bản vẽ (mở sẵn, ngay sau mục 2) và accordion **12** của tab Tính toán; ô nhập `CellNum`/`OptNumField` (cho phép 0 và ô trống = `null`).
- **Bất biến: `pile` vắng mặt = tắt hoàn toàn và kết quả giữ bit-identical với bản gốc.** Không đưa `pile` vào `calcDefaults` (đúng 96 khóa), `baseProject`, `preset*`; chỉ `pileEnsure` (no-op khi vắng) gọi từ `cloneProject`, `updateProject`, cuối `mergeProject`; `'pile'` nằm trong `META_KEYS`. Không sửa `calcChecks/calcBadgeCount/calcSheetHTML/buildBars` — kiểm tra/báo cáo/bản vẽ cọc đi qua hàm riêng gắn điều kiện `pileOn(p)`. Không thêm layer CAD, không thêm sheet, vẫn đúng 7 nút `#tabs > button`.
- **Không nhúng số liệu tra bảng tiêu chuẩn** (fi, qb, γc*, γk, K…): người dùng nhập trong app; trống = `null` = "chưa nhập" và phần tính phải báo thiếu số liệu thay vì cho kết quả. Số mặc định hình học/địa tầng chỉ là ví dụ để bắt đầu nhập.
- **GĐ2 (mô phỏng) – điểm nối:**
  - Hình học: `engine/pileGeom.ts` (`pileGrid(p, B)` lưới cọc cm, `pileArea`, `pileHoopLevels`, `pileMainOffsets`, `pileQuantities`, `appendPileBars`). `pileGrid` trả `null` khi tắt; cọc căn giữa theo bề rộng và theo Lu, hàng lẻ bố trí so le thì ít hơn 1 cọc.
  - Thép cọc: `buildBars` (wrapper trong `engine/rebar.ts`) gọi `appendPileBars` SAU khi các mẫu tường đã đánh mác; thêm thanh `pm` (mác `P1`, thép dọc) và `ph` (mác `P2`, đai) với cờ `pile: true`. Cọc ly tâm (`phc`) không có thép rời. Mọi nơi duyệt `res.bars` theo từng 1 m tường phải lọc `!b.pile` (đã làm ở `calcRbSchedule`).
  - Khối lượng: `quantities()` thêm `q.pile` (`n`, `volEach`, `vol`, `totLen`, `steelKg`) chỉ khi bật; `q.vol` vẫn là bê tông tường, `ratio` tính trên (tường + cọc); thẻ "Số cọc"/"Bê tông cọc" ở `SidebarMetrics`.
  - 2D: `cad/viewsPile.ts` (`viewPileSection`, `viewPilePlan` thêm vào sheet 0; `viewPileCage` thêm vào sheet 2 khi `pileCageOn(p)`); cọc dài > 7 m vẽ có đường cắt lìa, chiều dài thật ghi ở kích thước; chỉ dùng layer có sẵn.
  - 3D: `model3d/piles3d.ts` (`m3PileMesh`, `m3PileGroups`), `M3Mesh.vprism`, `Model3DData.pile?`/`gpu.pile?` (`viewer3d.ts` free/upload/draw, bật tắt cùng `vis.conc`), `bbox.y0` hạ theo chiều dài cọc và `sig` đổi khi bật; số vòng đai vẽ giới hạn ~3000 (thống kê vẫn đủ).
  - Lồng thép (`pile.cage`) hiện là **dữ liệu nhập** để vẽ/thống kê; kiểm tra khả năng chịu lực ở GĐ4. Test: `tests/engine/pileGeom.test.ts`.
- Đơn vị của `pile`: m, kN, kPa (khác hình học tường bằng cm). Test: `tests/engine/pile.test.ts` + khối "Móng cọc" trong `tests/appUi.test.tsx`; không có oracle nên dùng golden tính tay.

## Quy trình làm việc
1. Sửa → `npm run typecheck` → `npx vitest run` → (nếu đụng `src/` hoặc `index.html`) `npm run build` → `node tests/qa/e2e_browser.mjs`.
2. **Sau mỗi bước hoàn tất, thêm mục vào `../CHANGELOG.md`** (mới nhất đặt trên cùng): vai trò, file đã sửa, lệnh đã chạy + số liệu pass/fail thật, việc còn mở. Sửa quy ước/cấu trúc thì cập nhật cả `../AGENTS.md` và `specs/*`. Sau khi sửa lỗi nêu trong `specs/qa-verification-report.md`: chạy lại đủ build + Vitest + E2E và cập nhật báo cáo đó; khi mọi check PASS thì chuyển trạng thái mục 4 của `specs/evidence-ledger.md` từ `SPECIFIED/OPEN` sang `VERIFIED` kèm bằng chứng test.
3. Không để file tạm/ảnh chụp/script nháp trong repo (dùng thư mục scratchpad). `dist/` và `node_modules/` không commit.
4. Commit theo kiểu `feat(ui): …` / `fix: …`; chỉ push khi người dùng yêu cầu. Cảnh báo "LF will be replaced by CRLF" trên Windows là bình thường.
5. Phân vai (khi dùng sub-agent): solver → `src/engine/*`+`tests/engine`; CAD/3D → `src/cad`,`src/model3d`,`export/csv.ts`,`tests/cad`; frontend → App/store/components/styles/reports/export(docx,pdf,projectIo)/`appUi`+`engineAndReports` tests; QA → `tests/qa/*`, `specs/qa-verification-report.md` (QA báo lỗi, không tự sửa code production).
