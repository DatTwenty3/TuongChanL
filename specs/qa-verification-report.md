# QA & Parity Verification Report — TuongChanL Web App

- **Target App**: `E:\3. data\rea\TuongChanL-Web\` (`dist/` production bundle verified)
- **Reference Baseline**: Extracted original `TuongChanL` functional modules (`E:\3. data\rea\analysis\modules\01..26`), `E:\3. data\rea\TuongChanL-Web\specs\parity-spec.md`, and `E:\3. data\rea\TuongChanL_BoCai_1.0.0\Huong-dan-cai-dat-va-kich-hoat.pdf`
- **Role**: Independent QA & Parity Verification Engineer (`qa-verifier`)
- **Initial Verification Date**: `2026-11-10`
- **Post-Fix (`BUG-1`, `BUG-2`) Re-Verification Date**: `2026-11-11`
- **Wave 2 Final Verification Date**: `2026-11-11`

---

## 1. Executive Verdict

**OVERALL STATUS: PASS (Wave 2 Final Adversarial Verification — 100% Pass Across Build, Differential Parity, Live Browser E2E, Binary Exports & Clean-Room Audit)**

Following Wave 1 & 1b engineering remediation across `TuongChanL-Web/src/*` and Wave 2 expansion of adversarial differential and headless browser suites (`tests/qa/full_parity.test.ts` and `tests/qa/e2e_browser.mjs`), full independent verification completed with **zero failures** and **zero runtime defects**:

- **Production Build (`npm run build` / `tsc --noEmit && vite build`)**: **PASS** (`EXIT:0`, `266` modules transformed in `3.73s`, zero TypeScript or bundler errors).
- **Full Vitest Differential & Unit Suite (`npx vitest run`)**: **105 / 105 tests PASSED across 6 / 6 test files** (`EXIT:0`, `87.85s`), including adversarial Node `vm` differential + edge/error + CAD/3D + Report HTML + multi-template `.docx` + licensing audit suite `tests/qa/full_parity.test.ts` (`31 / 31` passed).
- **Live Headless Chromium E2E (`node tests/qa/e2e_browser.mjs`)**: **11 / 11 assertions PASSED** (`EXIT:0`, `defects: []`), covering initial KPIs, 5 CAD sheets + zoom/pan/fit, `#sinfo` paper overflow (`⚠ vượt khổ A3`), CAD/Calc sidebar accordion persistence, `FeViewPanel` (`q='V', k='SD'`) persistence, live `dec=','` propagation with zero `NaN`, 3D `#v3foc button` pointer click + `Escape` focus reset, FEM2D Web Worker, roundtrip `.tcl.json`, PDF, DXF, SVG, CSV, PNG, and multi-template `.docx` (`Mẫu 1`, `Mẫu 2 · Có sườn`, `Mẫu 4 · Neo đá D80`), with **0** console errors, **0** HTTP `>= 400`, **0** `pageerror` exceptions, and **0** failed network requests.
- **Clean-Room Zero-Licensing Audit (`index.html`, `src/`, `dist/`, and `start-webapp.bat`)**: **PASS** — `70` scanned files yielded zero TuongChanL licensing, trial, hardware/machine ID, `.lic`, activation UI/IPC/CSS, or `tclApp` tokens.
- **Workspace Hygiene**: **PASS** — zero stray temporary files, screenshots, or scratch artifacts inside `E:\3. data\rea\TuongChanL-Web\`.

---

## 2. Wave 2 Execution Summary & Bundle Artifacts

| Check / Suite | Command | Passed | Failed | Exit / Verdict |
|---|---|---:|---:|---|
| TypeScript & Production Bundle | `npm run build` (`tsc --noEmit && vite build`) | 266 modules | 0 | `EXIT:0` — **PASS** |
| Contract Types (`tests/types.test.ts`) | `npx vitest run` | 2 | 0 | **PASS** |
| React UI Integration (`tests/appUi.test.tsx`) | `npx vitest run` | 4 | 0 | **PASS** |
| Engine Differential Parity (`tests/engine/parity.test.ts`) | `npx vitest run` | 21 | 0 | **PASS** |
| CAD, SVG, DXF, CSV, 3D & Tube Parity (`tests/cad/cad_export.test.ts`) | `npx vitest run` | 36 | 0 | **PASS** |
| Engine, Reports, Charts, DOCX & PDF (`tests/engineAndReports.test.ts`) | `npx vitest run` | 11 | 0 | **PASS** |
| QA Differential Parity (`tests/qa/full_parity.test.ts`, `QA 1..QA 6`) | `npx vitest run` | 31 | 0 | **PASS** |
| **Total Vitest Suite (`6 / 6` files)** | `npx vitest run` | **105** | **0** | `EXIT:0` — **PASS** |
| Live Headless Chromium E2E (`tests/qa/e2e_browser.mjs`) | `node tests/qa/e2e_browser.mjs` | **11** | **0** | `EXIT:0` — **PASS** |

### Rebuilt Production Bundle Artifacts (`E:\3. data\rea\TuongChanL-Web\dist\`)
- `dist/index.html` (`0.81 kB` / `gzip: 0.52 kB`) — contains inline SVG `<link rel="icon" type="image/svg+xml" ... />` eliminating `/favicon.ico` `404`.
- `dist/assets/fem2d.worker-DFNv6fA-.js` (`32.22 kB`)
- `dist/assets/index-Bxi0-4MH.css` (`16.61 kB` / `gzip: 4.38 kB`) — includes `#v3foc button { pointer-events: auto; }` and `#v3tip` rules.
- `dist/assets/index-Ck_59Y56.js` (`1,264.51 kB` / `gzip: 483.64 kB`) — rebuilt after `LEDAT` branding update (`HeaderToolbar.tsx`, `docx.ts`), re-verified via `npm run build` (`EXIT:0`), `npx vitest run` (`105/105`), and `node tests/qa/e2e_browser.mjs` (`11/11`).

### QA Verification Suite Artifacts (`E:\3. data\rea\TuongChanL-Web\tests\qa\`)
- `tests/qa/full_parity.test.ts` (`31` tests) — Differential parity suite executing extracted original JS modules (`01`–`23` + report/DOCX slices) inside Node `vm` directly against TypeScript modules (`src/engine`, `src/cad`, `src/model3d`, `src/reports`, `src/export`) plus clean-room scan over `index.html`, `src/`, and `start-webapp.bat`.
- `tests/qa/qa-builtins.d.ts` — TypeScript ambient declarations for Node builtins inside QA tests.
- `tests/qa/e2e_browser.mjs` (`11` E2E checks) — Real headless Chromium (`1440×900`, SwiftShader WebGL) verification against `vite preview --port 4179 --host 127.0.0.1 --strictPort` with real download interception, ZIP/CRC32/Blink `DOMParser` XML/DXF/PNG/PDF validation, interactive WebGL/UI state checks, and automatic process-tree cleanup.

---

## 3. Initial Default Mẫu 1 (`H = 500 cm`) Reference Parity Check

Verified against `Huong-dan-cai-dat-va-kich-hoat.pdf` (pages 1 & 6) and `TuongChanL` original `vm` execution (`QA 1` Vitest + `E2E-1` live Chromium DOM):

| Metric / Indicator | PDF Screenshot (`p.1`, `p.6`) | Original `TuongChanL` (`vm`) | Web App (`dist/`) Live DOM | Status |
|---|---|---|---|---|
| Template (`data-tpl`) | Mẫu 1 (`B`) | `B` | `data-tpl="B"` | **PASS** |
| Bê tông | `21,50 m³` | `conc.tot = 21.50...` (`21,50`) | `21,50 m³` | **PASS** |
| Ván khuôn | `64,64 m²` | `form.tot = 64.64495957...` (`64,64`) | `64,64 m²` | **PASS** |
| Bê tông lót | `1,50 m³` | `blind = 1.50` (`1,50`) | `1,50 m³` | **PASS** |
| Cốt thép | `2370 kg` | `totKg = 2369.58...` (`2370`) | `2370 kg` | **PASS** |
| Hàm lượng | `110,2 kg/m³` | `ratio = 110.213...` (`110,2`) | `110,2 kg/m³` | **PASS** |
| Cảnh báo cốt thép | `✓ Không có cảnh báo...` | `warn.length === 0` | `✓ Không có cảnh báo về khoảng cách, lớp bảo vệ, chiều dài thanh` | **PASS** |
| `#calcBadge` | `✗ 3` | `calcBadgeCount = 3` | `✗ 3` | **PASS** |
| Sheet 1 `#sinfo` | `Cụm chi tiết · tỷ lệ 1/20 · rộng 766 × cao 419 mm trên giấy` | `S=20, wMm=766, hMm=419` | `Cụm chi tiết · tỷ lệ 1/20 · rộng 766 × cao 419 mm trên giấy` | **PASS** |

---

## 4. Graduated Parity & Feature Matrix (`Easy -> Medium -> Hard -> Special`)

### 4.1 Easy Cases
- **Default `Mẫu 1` (`B_H500`)**: Exact parity across `geom`, `rebar`, `quantities`, `calcRun`, all 5 `SHEET_DEFS`, `toSVG` (`dark`/`light`), `toDXF` single & stacked (`AC1009`, `$INSUNITS 4`, 17 layers, `*D*`, `DIMENSION`, `bulge=1`, `\U+XXXX`), `buildCsvContent`, `model3D`, `M3Tubes`, `calcSheetHTML`, `calcRbView`, `calcGsView`, and `.docx`/`.pdf` exports.
- **Default 3D & UI Controls (`E2E-1`, `E2E-2`, `E2E-4`)**: All 5 SVG sheets render non-empty BBoxes; wheel zoom, drag pan, `#bFit`, and `dblclick` reset behave identically; 3D `#gl` initializes WebGL (`9` bar groups, `344` bars, `2370 kg`), `#v3tip` stays hidden while idle, and `Ảnh 3D (PNG)` exports valid `1046×607` PNG bytes (`246,517 B`).

### 4.2 Medium Cases
- **All 4 Templates & Presets (`QA 2`, `QA 3`, `QA 4`)**:
  - `B` (`H = 400, 500, 800, 1300 cm`, `canti` + `rib`, `key.on`, `anc.on`);
  - `A` (`presetRib`, with/without `beam` & `anc`);
  - `C` (all 27 `KE_TAB` presets + `key.on` + edited `H=550, heel=310, anc.on=true`);
  - `D` (all 6 `D_TAB` presets `D80`, `D65`, `D60`, `D60b`, `D45`, `D30` + `rib` toggle).
- **UI State & Solvers (`E2E-2b`, `E2E-3`, `E2E-4`, `E2E-5`)**:
  - CAD & Calc sidebar accordions persist cleanly across `2d <-> calc <-> 2d` switches (`1. Kiểu tường`, `6. Vật liệu`, `1. Đất đắp`, `8. FEM 2D`).
  - `FeViewPanel` (`q='V'`, `k='SD'`) persists across both `fe -> Bảng tính -> fe` and `fe -> 2d -> calc`.
  - `#v3list .lg .mk` focus isolation clears via real pointer click on `#v3foc button` (`Hiện tất cả (Esc)`) AND via `Escape` key.
  - `calcSuggest` + `calcApplyFixes` (`Áp dụng`) + `calcHeelHint` + live `calc.dec = ','` propagation verified in both `calcSheetHTML` / `.csheet` and `Bố trí thép`.

### 4.3 Hard Cases
- **Coupled Multi-Hazard Geotech & Numerical Solvers (`QA 2`, `QA 5b`, `parity.test.ts`, `engineAndReports.test.ts`)**:
  - Groundwater `hs` & 2D anisotropic `fd` finite-volume seepage (`WATER.seepSolve`, `WATER.build`, `WATER.piping`).
  - Mononobe-Okabe seismic (`half`, `full`, `tay` + vertical `kv`).
  - Rock anchors (`fr` friction clamp + `dw` dowel shear + `aOT` overturning).
  - Global stability (`SLOPE.run`, `bsOn=true`), 3D quad shell `CFE` (`fe` & `hand` across `B`, `A`, `C`, `D`), and 2D Mohr-Coulomb `FEM2D` (`femMesh='c'` & `'n'`, Web Worker + SRM `srmTrials`).
  - **Wave 2 Differential Report HTML & Multi-Template DOCX (`QA 5b`)**: Verified exact parity (`calcSheetHTML`, `calcRbView`, `calcGsView` in both `.` and `,` modes) and full `calcDocxBlob` ZIP entry-by-entry comparison against Node `vm` oracle (`15..22`) across `Mau1_B500`, `Mau2_A_rib`, `Mau4_D80`, and `Hard_MultiHazard` (`wOn` `fd` + `eqKm='full'` + `bsOn` + `feOn` `fe` + `femOn` + `femSrm=true`). Confirmed **0** occurrences of `NaN` in shear resistance rows (`sRC` Wave 1 fix verified).

### 4.4 Special / Edge / Extreme Cases
- **`S2` Degenerate & Invalid Walls (`QA 2`)**: `S2_B_tsb_lt_tst`, `S2_A_tsb_lt_tst`, `S2_B_H0`, `S2_B_Hneg`, `S2_D_H0_vtop_gt_H` all execute cleanly with zero unhandled throws and 100% parity with original `TuongChanL` for `calcRun` error/unsupported flags, `calcBadgeStatus`, `calcSheetHTML`, and `quantities`.
- **Cohesive Zero-Friction (`phi = 0`) FEM2D Backfill (`QA 2`, `parity.test.ts`)**: Verified Wave 1 `??` fix in `fem2dCore.ts` (`I.phi === 0` preserved rather than defaulting to `30°`) matches original `14_fem2d_worker.js` exactly.
- **`B_H1300_extreme` Extreme CAD/DXF & `#sinfo` Overflow (`QA 3`, `QA 4`, `E2E-2b`)**: Verified `H=1300`, `paper='A3'`, `scale=10` (`fits=false`), `fillMode='1.5'`, `fillH=180`, `dimLeg='full'`, `blindOn=false`, `formEnds=false` parity across all 5 sheets, SVG, DXF, CSV, `model3D`, and `M3Tubes`, plus live `#sinfo` banner `"Cụm chi tiết · tỷ lệ 1/10 · rộng 893 × cao 4154 mm trên giấy · ⚠ vượt khổ A3 (chọn tỷ lệ nhỏ hơn)"` on Sheet 1 (and suppressed on Sheet 4 `noScale`).
- **3D `M3Tubes` Multi-Chunk Buffer Splitting (`QA 4`)**: Verified exact chunk vertex/normal/index parity when lowering `maxV = 200` on `B_H1300_extreme` alongside full default-chunk (`60,000`) parity across all bar groups of `B_H500`, `B_H600_anc`, `B_H1300_extreme`, `A_rib`, `A_rib_anc`, `C_KE0`, `C_KE5_edited_anc`, `D_D80_rib`, and `D_D60_flat`.
- **`.tcl.json` Migrations & Multi-Template `.docx` / `.pdf` Binaries (`QA 5`, `QA 5b`, `E2E-6`, `E2E-6b`)**:
  - Verified legacy `(kb, kf)` -> `(kbx, kby, kfx, kfy)` and legacy rock-anchor migrations.
  - Verified `_rels/.rels` exact `rId2` URI `Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties"` across Vitest and live browser downloads.
  - Multi-template real `.docx` downloads (`Mẫu 1`: `1,844,402 B`, `19` entries, `10` images; `Mẫu 2 · Có sườn`: `2,807,377 B`, `21` entries, `12` images; `Mẫu 4 · Neo đá D80`: `5,725,745 B`, `32` entries, `23` images) all passed CRC32 ZIP integrity, Blink `DOMParser` XML well-formedness on every `.xml`/`.rels` file, OMML `<m:oMath>`, `<w:tbl>`, and zero `NaN` in `word/document.xml`.

---

## 5. Clean-Room Zero-Licensing Audit (`index.html`, `src/`, `dist/`, `start-webapp.bat`)

Scanned **70** files (`TuongChanL-Web/index.html`, `TuongChanL-Web/start-webapp.bat`, all files under `TuongChanL-Web/src/**`, and all built assets under `TuongChanL-Web/dist/**`) using pattern:
`/(?i)\b(license|trial|trials|srmTrials|machineId|machine_id|hwid|activate|licchip|licov|tclApp)\b|TCL1-|dùng thử|bản quyền|mã máy|kích hoạt(?!\s+tường)/`

- **Total line matches**: `25` lines (`32` token hits), **all verified benign**:
  - `12` lines (`20` tokens) in `src/engine/fem2dCore.ts`, `src/types/project.ts`, `dist/assets/fem2d.worker-DFNv6fA-.js`, and `dist/assets/index-CHaVAUvv.js` line `40`: exclusively Mohr-Coulomb Strength Reduction Method math identifiers (`trial` / `trials` / `srmTrials`).
  - `12` lines (`12` tokens) in `dist/assets/index-CHaVAUvv.js` lines `2..32`: third-party React MIT `@license React` / `MIT license` / `LICENSE file` header comments.
  - `0` matches in `start-webapp.bat`, `index.html`, `dist/index.html`, or CSS.
- **Forbidden TuongChanL licensing/activation tokens**: **0** (`machineId`, `machine_id`, `hwid`, `activate`, `licchip`, `licov`, `tclApp`, `TCL1-`, `dùng thử`, `bản quyền`, `mã máy`, `kích hoạt`, or rendered UI licensing text).

---

## 6. Live Headless Chromium E2E Summary (`tests/qa/e2e_browser.mjs`)

Executed against rebuilt production `dist/` served via `vite preview --port 4179 --host 127.0.0.1 --strictPort` (`CHROME_PATH`, `1440×900`, SwiftShader WebGL):

| Test ID | Scope & Assertions | Result | Key Observed Evidence |
|---|---|---|---|
| `E2E-1` | Default Mẫu 1 (`H=500 cm`) KPIs, badge, `#sinfo`, clean state, zero licensing UI | **PASS** | `21,50 m³`, `64,64 m²`, `1,50 m³`, `2370 kg`, `110,2 kg/m³`, `#calcBadge="✗ 3"`, `tỷ lệ 1/20 · rộng 766 × cao 419 mm trên giấy` |
| `E2E-2` | 5 CAD Sheet tabs SVG BBox > 0 + wheel zoom, drag pan, `#bFit`, `dblclick` reset | **PASS** | BBoxes: `S1:1532×838`, `S2:366×825`, `S3:1187×1145`, `S4:596×311`, `S5:312×399` |
| `E2E-2b` | `#sinfo` paper overflow (`H=1300`, `A3`, `scale=10`) & CAD/Calc accordion state persistence (`2d <-> calc`) | **PASS** | `⚠ vượt khổ A3 (chọn tỷ lệ nhỏ hơn)` on Sheet 1, omitted on Sheet 4 (`noScale`); accordion states preserved cleanly |
| `E2E-3` | Template switching (`B` -> `A` -> `C` -> `D` (`D60b`)) | **PASS** | Reactive geometry, rib counts, and SVG redraws clean |
| `E2E-3b` | `D60b` live conclusion parity (`ok.all`) | **PASS** | `report="KẾT LUẬN CHUNG: TƯỜNG CHẮN ĐẠT YÊU CẦU THEO TẤT CẢ CÁC HẠNG MỤC KIỂM TOÁN."` |
| `E2E-4` | 3D WebGL `#gl`, `#v3tip` hidden idle, clip axis/slider/flip, legend toggles, `#v3foc button` genuine pointer click + `Escape`, PNG export | **PASS** | `9` groups, `344` bars, `2370 kg thép`; `focusBtn+Esc=ok`; `TUONG_CHAN_BTCT_CHU_L_3D.png` (`246,517 B`, `1046×607` PNG) |
| `E2E-5` | Calc sub-tabs, Bishop Slope, `FE3D` + `FeViewPanel` (`q='V', k='SD'`) persistence, `FEM2D` Worker (`c`), `dec=','` zero-`NaN` on sheet + rebar tab, HeelHint, `Áp dụng` | **PASS** | Slope `Fs: trượt 1,32 · lật 2,01 · Bishop 1,58 → ỔN ĐỊNH`; FE `22 phần tử tấm, 276 bậc tự do, 6 ms`; FEM2D `983 phần tử, 0.1 s`; `Áp dụng` `"✗ 1" -> "✓"` |
| `E2E-5b` | Live Calc conclusion parity after Mẫu 1 `Áp dụng` passes all checks | **PASS** | `badge="✓"`, `#warn="✓ Đạt tất cả..."`, `report="KẾT LUẬN CHUNG: TƯỜNG CHẮN ĐẠT YÊU CẦU THEO TẤT CẢ CÁC HẠNG MỤC KIỂM TOÁN."` |
| `E2E-6` | Dirty tracking, `.tcl.json` Save/Open roundtrip, `dxf1`, `dxfall`, `svg`, `csv`, `cadPdf`, `calcPdf`, `docx` | **PASS** | `tcl.json=3,233 B`; `dxf1=25,374 B`; `dxfall=230,830 B` (`73` `*D` blocks); `svg=20,459 B`; `csv=1,335 B`; `cadPdf=63,769 B` (`1p`); `calcPdf=1,933,068 B` (`12p`); `docx=1,844,402 B` (`19` files, `rId2`+XML valid, `0 NaN`, `10` imgs) |
| `E2E-6b` | Multi-template real `.docx` downloads (`Mẫu 2 · Có sườn` & `Mẫu 4 · Neo đá D80`) | **PASS** | `Mau2_A=2,807,377 B` (`21` files, `12` imgs, `0 NaN`); `Mau4_D80=5,725,745 B` (`32` files, `23` imgs, `0 NaN`) |
| `E2E-0` | Runtime console errors, uncaught `pageerror`, HTTP `>= 400`, failed network requests | **PASS** | `0 console errors`, `0 pageerrors`, `0 failed network requests`, `0 HTTP >=400 errors` |

---

## 7. Prior Defect & Wave 1/1b Fix Verification History

- **`BUG-1` (RESOLVED & VERIFIED — Wave 1)**: `calcCore.ts#L1954-1956` excluded `'all'` when computing `ok.all`; confirmed passing in `QA 2`, `parity.test.ts`, `E2E-3b`, and `E2E-5b`.
- **`BUG-2` (RESOLVED & VERIFIED — Wave 1)**: `index.html#L7-11` inline SVG favicon bundled into `dist/index.html`; confirmed `0 HTTP >=400` in `E2E-0`.
- **Wave 1 & 1b Audits Verified in Wave 2**:
  - `fem2dCore.ts` (`??` preserving `phi === 0` backfill): verified in `QA 2` & `parity.test.ts`.
  - `reportHelpers.ts` (`sRC` unary `+` `NaN` removal): verified with zero `NaN` across `QA 5b`, `E2E-5`, `E2E-6`, and `E2E-6b`.
  - `docx.ts` (`_rels/.rels` `rId2` core-properties URI): verified identically against `vm` in `QA 5b` and parsed via Blink `DOMParser` in `E2E-6` & `E2E-6b`.
  - `pdf.ts` (canvas Print/PDF pagination & `.fx`/`.tf`/`.tss`): verified via `QA 5` & `12p` `calcPdf` (`1,933,068 B`) in `E2E-6`.
  - `app.css`, `Model3DViewport.tsx`, `SidebarCadPanel.tsx`, `SidebarCalcPanel.tsx`, `CalcReportViewport.tsx`, `appStore.ts`, `viewer3d.ts`: verified `#v3foc button` genuine pointer click, accordion persistence, `FeViewPanel` persistence, live `dec=','` propagation, and clean WebGL lifecycle with `0` console/page errors.
