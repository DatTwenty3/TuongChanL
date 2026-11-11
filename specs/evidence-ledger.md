# TuongChanL Web App — REA Evidence & Provenance Ledger

## 1. Boundary & Clean-Room Policy

- **Zero Licensing Policy**: No licensing, trial timer, machine-ID, `.lic`, obfuscation/signature validation, or activation logic was inspected, extracted, or reconstructed, and **none** may exist anywhere inside `E:\3. data\rea\TuongChanL-Web\`.
- **Verification Discipline**: Every specification, schema field, formula, and UI/CAD/3D parity claim maps directly to a concrete REA Evidence ID (`ev_*`, `agm_*`, `aex_*`, `occ_*`), SHA-256 hash, and extracted safe source file under `E:\3. data\rea\analysis\`.

---

## 2. Primary REA Evidence Chain (`phase1-inventory.md`)

| Pipeline Step | Operation | REA Evidence / Artifact ID | Verified SHA-256 | Notes |
|---|---|---|---|---|
| Desktop App Inspection | `inspect-desktop-application` (`E:\3. data\rea\TuongChanL`) | Parent: `ev_a2ba1ce099cd5381c4901ca267c8cfe498c70ecbdd86ca721badf82c050590f3`<br>Summary: `ev_255f5c9b5e462db7d68331988c618eb91f94622e8dfb0c522550b2dedc82df3`<br>Files view: `ev_c1de59f9c4ae1852d1e69f80b01d0c5098f37a4e6d11868f56c81dbdafb10e51` | Directory snapshot:<br>`417da20d8f75b4f668055f6e1d45c9af9a661cf60e595ef91cc72a5a1761e55b` | `E:\3. data\rea\analysis\desktop.evidence.json` (22 entries scanned; `resources/app.asar` identified) |
| JS Static Probe | `analyze-javascript-application` (`resources\app.asar`) | Partial: `ev_ff82067a67d2173e3fe83172b1bbb86139eb2f91c0fa4d2077f96cc268f1aa93` | `app.asar`: `8dbd4ece70240d6608edc243c958fe3ebb0de68410524cee2ef623d3a0546ab1`<br>Graph: `a4bcffd44e25ddbedeb4cb368010cb3f92bfe52505ffa169339855d011898929` | Stopped due to missing native REA worker manifest; superseded by ASAR extraction |
| ASAR Artifact Inventory | `inspect-artifact` (`resources\app.asar`) | Parent: `ev_831d9e73a634da4c96f9224f58e59f6e854d9c45c32f38d9bb4d4ae2492e259e`<br>Inventory: `ev_477a2d564b63dfd698794427b2e8a7cfe4a4fa26bf2be06a97c79b728faa8235`<br>Summary: `ev_35b730e454622c40654ebda6efc23facefefd00226deceb0b5cacd6106c8d9c2`<br>Occurrences: `ev_b0843c70926e69bacec9662d25d8467bee13bc48a65016ee19a7ed53889fd29d` | `app.asar`: `8dbd4ece70240d6608edc243c958fe3ebb0de68410524cee2ef623d3a0546ab1`<br>Manifest: `agm_35c84e1c2214d3d97bda9ba8d3187e96c6f6326a3167ff9f083165e0079c4512` | `E:\3. data\rea\analysis\asar.evidence.json` (7 occurrences; 5 non-licensing files inventoried) |
| Selective Extraction | `extract-artifact` (`resources\app.asar`, 5 non-licensing occurrences) | `ev_7b6408b7506075f05460193bf1abe9c9d152249706f9986b3b481b013a8d6ba6`<br>Extraction ID: `aex_83cc641c9fe104c52a5c43c787cac10a5548cbe335d6a25bd709b2e06522cf6a` | Aggregate `files_sha256`:<br>`252279688643c83bfd0c78137b8d41407e6fa78392d562a7207682eae2ada6af` | Extracted exclusively 5 non-licensing files to `E:\3. data\rea\analysis\extracted\` |

### Top-Level Safe Extracted ASAR Files

| Logical Path | Occurrence ID | Size (B) | SHA-256 | Role |
|---|---|---:|---|---|
| `package.json` | `occ_a98b00bf7459934fb18f7b93a880a305f79f498e5ace4ea3dbf5a52d099ae1f8` | 269 | `e7d7deb022b26ec0e0e01d00fb6c6672b0889564aeb10e3a89afe0acf1257aa6` | App manifest (`tuongchanl` v1.0.0) |
| `main.js` | `occ_46ffbabf47060aa9138f1860de4c9bf01f970d7ff7a9f894605eba930e8b01fd` | 7,312 | `88cdc147f7acd2b0d126eacbcdc13dddfb5983258d0cf271e7c0771059afe012` | Electron main IPC (`app:info`, `file:*`, `print:pdf`; not inspected) |
| `preload.js` | `occ_29bbeff36bc44edc7f22887f32f5a440926c75a7b61831d4968fe16a17152c3d` | 590 | `119adaef6a4bc966589253341efab07037e4c1b1c7d85ff961e8cc1a6409cab0` | `contextBridge` exposing `window.tclApp` |
| `index.html` | `occ_c8fae838530f21c99ce53e0cc0c656865f3689a1217e003c6b687ab989bbe5be` | 736,622 | `4922fc946e5323a78fda1c2cdeb5b71d3da0a8492fae81e24bad667c0b0a431d` | CSS + HTML shell + 681,058-char inline `<script>` split into 26 safe modules |
| `icon.png` | `occ_df74bba5886f10c018ccf83c69fd88c954940395bde79c6d41a757e9e8c226a1` | 225,007 | `c8f6e31b2f058493e47525366c3294b8bc3c4258561fbdba037cb544cfdb6909` | Application icon |

---

## 3. Safe Extracted Source Assets & Modules (`analysis/modules/MANIFEST.md`)

All slices derive from `E:\3. data\rea\analysis\extracted\index.html` (`4922fc946e5323a78fda1c2cdeb5b71d3da0a8492fae81e24bad667c0b0a431d`).

### 3.1 Non-JS Assets

| File | Source Lines | Formatted B | Lines | SHA-256 | Usage Boundary |
|---|---|---:|---:|---|---|
| `styles.css` | `8–206` | 18,671 | 199 | `5f039788279bf761f59093f4cb4e2dd788ae4a3795c71e017884d8e0c54483fd` | Only lines `1–179` ported; lines `180–200` (`.licchip`, `#licov`) excluded |
| `shell.html` | `209–241` | 1,875 | 33 | `506e4e90cde5a585ec93839ae2405fa0696947bc5aa40c581b28cd44d463f604` | Ported cleanly into React components (adding `#bPdf` next to `#bPrint`) |

### 3.2 Safe JavaScript Modules (`01`–`26`)

| # | Module File | Char Range | Lines | Raw Slice SHA-256 | Formatted SHA-256 |
|---|---|---|---:|---|---|
| 01 | `01_project_geom.js` | `0..32603` | 2,728 | `a11c71831996a55b63f502d1e185cb28302afc22f905248f55299c04bc68fe3e` | `58c13503c89aa412daa2b54f607c58bb504609737a43a7456cd1232d0f25877b` |
| 02 | `02_cad_2d.js` | `32603..117372` | 4,523 | `fd9728c82459f9297ee3a567f7da59179e13d4a997af2a1907c705547e834990` | `9c645fbe02a0e2a58b5d88addc1a928a3a8d240616361e031103ebeb31f7f863` |
| 03 | `03_template_b_canti.js` | `117372..134982` | 1,024 | `d051d8a6f5db96f7ee4005b52661a8ac3077c0b075c9b60502c22ee40f8eae79` | `56ec5429369e610cb8c136a9ef25b839ce16f22190e508d314e76a86e2718613` |
| 04 | `04_template_c_ke.js` | `134982..155418` | 1,245 | `60910184ec08cbf179d26a1051428a7f53686950578d165accd80a0a5c603ef8` | `2d80122472c8b83069545f80a2eac6252af214e5aea1772e049326d71a55dc76` |
| 05 | `05_template_d_anchor_rebar.js` | `155418..166171` | 813 | `6402d5e5bbb134d230b30c555e475a0bad65644a3786599d91478544e5202808` | `648c8fadbd5570b24b8b235992e0a04921a0975b5289c8f7f482f08095a8840e` |
| 06 | `06_template_d_cad.js` | `166171..182185` | 1,170 | `20e96ed935e661b6f446c7980ca64d54a57698f2b884e781aad34ff567949e73` | `fb5a5dd9397c32ff8b85c5264d45fe44c94400c81c591d0ecb701bf7be0f02b2` |
| 07 | `07_water_seepage.js` | `182185..194740` | 759 | `db7cbfdf6f9d67ccf152e6d34000789b20051a2200ab5243e35cf887194fc1d1` | `f1ce1b8ab069d2c3dcaf7fff66909db63ca053166f3ff970d720c32e2105078b` |
| 08 | `08_slope_stability.js` | `194740..199363` | 269 | `a663b5ae4c9116eab2976d89395b10dbe6116ac7dd348903bff13a050ac1362f` | `4fcfd5e0972d2dfcbffcfd313d964394ce082f73295058ed506a7a0f49a82b53` |
| 09 | `09_calc_core.js` | `199363..223737` | 1,438 | `195c16bde508032cb09333db565c9bf71f6227f35ade2e19fb89589e749d434d` | `5ba1043923ea4a0e54f18629241bdecb11c69070303b8e1c95b189235eb9b044` |
| 10 | `10_calc_orchestrator.js` | `223737..244517` | 1,176 | `7fc96b62e59e9a1907e77d3ee75efc3688cb000cb1e9bd25c7c36d89198da94d` | `0961ab1577de6a238f1e6e5c48cb7e7061c608049afef3c0e8708b55d931960e` |
| 11 | `11_calc_ribbed.js` | `244517..265643` | 1,212 | `d6a7b73660dd013f7fbe531c606ab444b844a1151f2e167729f2394a23735b42` | `175a523da575486d3029e30f2404fec608ffef644bf2e734bcbf5e8a696ad7b7` |
| 12 | `12_fe3d_shell.js` | `265643..283683` | 953 | `9b19c7ca12cc43f16ec794b7820591ae5daf17eef923cbcd2a705444a8b17a40` | `152e23a779756b198da9451d2cf8fff2bca0c027ced0c29cc008a86a7762af54` |
| 13 | `13_cfe_continuous.js` | `283683..306445` | 1,218 | `8fffa030a8f1308b3cf413e4297612bf121b249b3ca689b5e648519f4b23ccd0` | `f8e0b08501a79fc44add3ed5e4381b3bbd469731d4afcb6b17ae89499fb52e71` |
| 14 | `14_fem2d_worker.js` | `306445..341978` | 2,026 | `1ab66fd4b07a86c189c11bf5e5cd09fa2346e7008b6cf482a92fdc013e1f472a` | `761e2a0c0d1d6b03db666201a776709884cfbddb46a2ca67bf402669eeb8ce4e` |
| 15 | `15_tex_html.js` | `341978..347122` | 313 | `f5330e80bbcd68fc7143c53b4b11e810a9be81fd860fe0a6a5c12c1e597ed68c` | `5ac0d15aec0de5a494116c5b69c1427f8bdddf43bb9f9afaabcb381a371dab8b` |
| 16 | `16_calc_figures.js` | `347122..373906` | 1,147 | `31b7481e50f261234ad46811156dfc9f838b0ac17b5f022d8cb2fd535d697c7f` | `6c9ee0a8e6a07263bac3ec98d36a7ffeb43cf00c1e4f9ede88b4930bd8315cd6` |
| 17 | `17_calc_sheet_html.js` | `373906..416836` | 1,393 | `c356c717262de6713b92ce190fe85b41bfdd0b59bec49ec33f9eddb6670d280f` | `3ba69c30a1714b38980ec6223ae0a2f7030a23a673d7a89c55d28b0527e13f4e` |
| 18 | `18_calc_ext_sheet.js` | `416836..436842` | 790 | `1da1b47cf18ca904d9d21522dc2449879bb6a768227d2697645b2540658970cc` | `9bc826effe89a887959aaaed57910d1a5f33e240114574a7cb676256e8c9ab8e` |
| 19 | `19_calc_fe_sheet.js` | `436842..466083` | 1,056 | `91226b89291c51186b17874494fecba215c5aaea544ef3447f12b5bcb77d3804` | `f3372f7da496d0308bdaf0b058c4ca84e45cd17fb8f943ad166023c64acf13bc` |
| 20 | `20_calc_gs_fem_sheet.js` | `466083..508262` | 1,421 | `9dd7d5e25daec4c6d27b8d796673aa5fed8e3c2bd741dd9e0b1ea28fdea84479` | `4f57bd09346d6db4e1e91078b8207a6290e6803a4c39fa0d4134873a291682f2` |
| 21 | `21_calc_rib_sheet.js` | `508262..538559` | 1,046 | `8a017e40d564de879d852d923264c7226013f032784c1a20fba27408b0a3bc0c` | `4dba66d2049a7d629f81ce2b9118671337ec7fa2cbdb656f62a07d962474c9cc` |
| 22 | `22_docx_exporter.js` | `538559..562245` | 717 | `8812015662d85420ec076c14a73dc40d7604ed89e7a5f5077c326558ec33e367` | `3e605af67a95204feb9e231ec904925b54764e35f30c2659d0e1505fe1b62ac7` |
| 23 | `23_model_3d.js` | `562245..581973` | 1,218 | `a0c9ff175960ae0fb6ac9c374ee1658273c8a7f0beacf83c8373a9170756153a` | `792341f67a941b31161e845c60011b99d624c72b8edc38f4b3feca9f77a4f4f2` |
| 24 | `24_webgl_viewer.js` | `581973..607266` | 1,105 | `04d35234e94adbe7735634c1272528a9e22e1c2b8661f5778c7d678007e748b1` | `c50718f1f636b2e51de646206ea19f782e9eb44aedac9814ff90cfb548cf5cc6` |
| 25 | `25_calc_ui_print.js` | `607266..644480` | 1,585 | `cf311c4527e0809ac1e7d3a41035055e569d2d7e63b21f64e1ba6cdcab835a50` | `4fc8adc21b4f57df92862ac813d2ba19ace48c90f3625427d54b2e5e29f3c75b` |
| 26 | `26_app_ui_export.js` | `644480..681058` *(excl. omitted range)* | 1,383 | Safe AST slice:<br>`2db4e92e32a5bec29a0b8af333d50d76297327a595cee29cc359ed0dfcf14d7f` | `bab85ba4ea5bd2f566518caa942cb9656a704c7c943dc9362f49cc1c2fbf55a8` |

---

## 4. Target Web App Subsystem Mapping & Parity Tracker

Status legend:
- `SPECIFIED` — Behavior, inputs, outputs, and formulas traced in REA specs & `parity-spec.md`.
- `IMPLEMENTED` — Written in `E:\3. data\rea\TuongChanL-Web\src\`.
- `VERIFIED` — Typechecked, unit/differential parity tested against reference modules, and E2E validated against `dist/`.
- `OPEN` — Deliberate web adaptation difference or pending detail requiring follow-up check.

| Target Web Subsystem (`TuongChanL-Web/`) | Source Module(s) (`analysis/modules/`) | Spec Reference | Owner Role | Verification Evidence | Status |
|---|---|---|---|---|---|
| `src/types/project.ts`, `src/engine/types.ts` | `01`, `02`, `03`, `04`, `05`, `07`–`14`, `22`–`26` | `parity-spec.md` §2–§8 | `coordinator-lead` | `tsc --noEmit`; `tests/types.test.ts` (`2/2`) | `VERIFIED` |
| `src/engine/presets.ts`, `geom.ts`, `rebar.ts`, `quantities.ts`, `index.ts` | `01_project_geom.js`, `03_template_b_canti.js`, `04_template_c_ke.js`, `05_template_d_anchor_rebar.js`, `26_app_ui_export.js` (`mergeProject`) | `01-data-and-templates.md` §1–§7; `parity-spec.md` §3 | `solver-engineer` | `parity.test.ts` (`21/21`); `engineAndReports.test.ts` (`11/11`); `full_parity.test.ts` (`QA 1`, `QA 5`); `e2e_browser.mjs` (`E2E-1`, `E2E-3`) | `VERIFIED` |
| `src/engine/water.ts` (`WATER`) | `07_water_seepage.js` | `02-calculation-engines.md` §2 | `solver-engineer` | `parity.test.ts`; `full_parity.test.ts` (`QA 2` `hs`/`fd` seepage & piping) | `VERIFIED` |
| `src/engine/slope.ts` (`SLOPE`) | `08_slope_stability.js` | `02-calculation-engines.md` §3 | `solver-engineer` | `parity.test.ts`; `full_parity.test.ts` (`QA 2` Bishop); `e2e_browser.mjs` (`E2E-5`) | `VERIFIED` |
| `src/engine/calcCore.ts` (`CALC`, incl. `CALC.RC`) | `09_calc_core.js` | `02-calculation-engines.md` §4 | `solver-engineer` | `parity.test.ts` (`21/21`, `ok.all` regression); `full_parity.test.ts` (`QA 2`); `e2e_browser.mjs` (`E2E-3b`, `E2E-5b`) | `VERIFIED` |
| `src/engine/calcOrchestrator.ts`, `calcRibbed.ts` | `10_calc_orchestrator.js`, `11_calc_ribbed.js`, `25_calc_ui_print.js` (`calcChecks`, `calcFamilyFix`) | `02-calculation-engines.md` §1, §5, §8 | `solver-engineer` | `parity.test.ts`; `engineAndReports.test.ts`; `full_parity.test.ts` (`QA 2`); `e2e_browser.mjs` (`E2E-1`, `E2E-5`) | `VERIFIED` |
| `src/engine/fe3d.ts` (`FE3D`), `cfe.ts` (`CFE`) | `12_fe3d_shell.js`, `13_cfe_continuous.js` | `02-calculation-engines.md` §6 | `solver-engineer` | `parity.test.ts`; `full_parity.test.ts` (`QA 2` `'fe'`/`'hand'`); `e2e_browser.mjs` (`E2E-5`) | `VERIFIED` |
| `src/engine/fem2dCore.ts`, `fem2d.ts`, `fem2d.worker.ts` (`FEM2D`) | `14_fem2d_worker.js`, `10_calc_orchestrator.js` (`calcFemWorker`) | `02-calculation-engines.md` §7 | `solver-engineer` | `parity.test.ts` (`phi===0` `??` backfill preservation); `full_parity.test.ts` (`QA 2` P6 SRM); `e2e_browser.mjs` (`E2E-5` Worker) | `VERIFIED` |
| `src/cad/layers.ts`, `ents.ts`, `dimCallout.ts`, `dots.ts`, `viewsCommon.ts`, `viewsTemplateB.ts`, `viewsTemplateC.ts`, `viewsTemplateD.ts`, `viewsSchedule.ts`, `sheets.ts`, `index.ts` | `02_cad_2d.js`, `03_template_b_canti.js`, `04_template_c_ke.js`, `06_template_d_cad.js` | `03-cad-2d-and-exports.md` §1–§4 | `cad-3d-engineer` | `cad_export.test.ts` (`36/36`); `full_parity.test.ts` (`QA 3` 9 configs × 5 sheets incl. `B_H1300_extreme`); `e2e_browser.mjs` (`E2E-1`, `E2E-2`, `E2E-2b`) | `VERIFIED` |
| `src/cad/svg.ts`, `src/cad/dxf.ts`, `src/export/csv.ts` | `02_cad_2d.js` (`toSVG`, `toDXF`), `26_app_ui_export.js` (`exportSVG`, `exportDXF`, `exportCSV`) | `03-cad-2d-and-exports.md` §5 | `cad-3d-engineer` | `cad_export.test.ts` (`36/36`); `full_parity.test.ts` (`QA 3` `AC1009`/SVG/CSV); `e2e_browser.mjs` (`E2E-6`) | `VERIFIED` |
| `src/model3d/mesh.ts`, `bars3d.ts` (`model3D`), `viewer3d.ts`, `index.ts` | `23_model_3d.js`, `24_webgl_viewer.js` | `04-3d-reports-and-ui.md` §1–§2 | `cad-3d-engineer` | `cad_export.test.ts` (`36/36`); `full_parity.test.ts` (`QA 4` `M3Mesh`/`M3Tubes` + `maxV=200` chunk split); `e2e_browser.mjs` (`E2E-4` WebGL/PNG + `viewer3d.ts` `webglcontextlost`/`restored`) | `VERIFIED` |
| `src/reports/texToHtml.ts`, `cfig.ts`, `reportHelpers.ts`, `calcFigures.ts`, `calcExtFigures.ts`, `calcFeCharts.ts`, `calcGsFemCharts.ts`, `calcRibSheet.ts`, `calcSheetHtml.ts`, `index.ts` | `15_tex_html.js`, `16_calc_figures.js`, `17_calc_sheet_html.js`, `18_calc_ext_sheet.js`, `19_calc_fe_sheet.js`, `20_calc_gs_fem_sheet.js`, `21_calc_rib_sheet.js` | `04-3d-reports-and-ui.md` §3–§4 | `frontend-builder` | `engineAndReports.test.ts` (`11/11`); `appUi.test.tsx` (`4/4`); `full_parity.test.ts` (`QA 5b` diff HTML + `.`/`,` + `reportHelpers.ts` `sRC` `NaN` fix); `e2e_browser.mjs` (`E2E-3b`, `E2E-5`, `E2E-5b`, `E2E-6`, `E2E-6b`) | `VERIFIED` |
| `src/export/docx.ts` (`zipBuild`, `omParse`, `calcDocxBlob`), `pdf.ts` (`printDoc`, `calcPrintDoc`, `exportCadPdfBytes`, `exportCalcPdfBytes`), `projectIo.ts`, `index.ts` | `22_docx_exporter.js`, `25_calc_ui_print.js` (`calcPrintDoc`, `printCalc`), `26_app_ui_export.js` (`saveOut`, `printDoc`, `saveProject`, `openProject`) | `04-3d-reports-and-ui.md` §5; `parity-spec.md` §6–§7 | `frontend-builder` / `cad-3d-engineer` | `engineAndReports.test.ts` (`11/11`, `pdf.ts` `.fx` pagination); `full_parity.test.ts` (`QA 5`, `QA 5b` `.tcl.json`/ZIP/CRC32/OOXML/`rId2` URI fix/multi-template `.docx`/PDF); `e2e_browser.mjs` (`E2E-6`, `E2E-6b`) | `VERIFIED` |
| `index.html`, `src/main.tsx`, `App.tsx`, `vite-env.d.ts`, `state/appStore.ts`, `styles/app.css`, `components/{FieldControls.tsx, HeaderToolbar.tsx, SidebarMetrics.tsx, SidebarCadPanel.tsx, SidebarCalcPanel.tsx, Cad2DViewport.tsx, Model3DViewport.tsx, CalcReportViewport.tsx, ToastBanner.tsx, index.ts}` | `shell.html`, `styles.css` (`L1–L179`), `25_calc_ui_print.js`, `26_app_ui_export.js` | `04-3d-reports-and-ui.md` §6; `parity-spec.md` §8 | `frontend-builder` | `appUi.test.tsx` (`4/4`); `e2e_browser.mjs` (`E2E-0..E2E-6b` `11/11`, `0` console/HTTP `>=400` errors; `SidebarCadPanel.tsx` `DraftRebarNum` `isInt`; `appStore.ts` + `CalcReportViewport.tsx` live `dec` & accordion/`FeViewPanel` persistence; `Model3DViewport.tsx` + `app.css` `#v3foc button`, `#v3tip`, single `setModel`) | `VERIFIED` |
| `tests/{types.test.ts, engineAndReports.test.ts, appUi.test.tsx, engine/parity.test.ts, engine/node-builtins.d.ts, cad/cad_export.test.ts, qa/full_parity.test.ts, qa/qa-builtins.d.ts, qa/e2e_browser.mjs}` | Node `vm` differential oracle (`01`–`23` + reports/DOCX) + live browser + licensing scan | `parity-spec.md` §9; `qa-verification-report.md` §1–§7 | `qa-verifier` + engineers | `npm run build` (`EXIT:0`, `266` modules); `npx vitest run` (`6/6` files, `105/105`); `node tests/qa/e2e_browser.mjs` (`11/11`) | `VERIFIED` |

---

## 5. Observed Spec Discrepancies & Web-Adaptation Notes

| Topic | Prior Note / Assumption | Directly Verified REA Fact / Web Decision | Status |
|---|---|---|---|
| `calcDefaults()` key count | Summary docs stated `89` keys (`01-data-and-templates.md#L60`) | Direct count of `calcDefaults()` object properties (`10_calc_orchestrator.js#L29-L128`) is **96 keys** (10 backfill + 5 concrete/exposure + 23 foundation + 16 anchor + 12 water + 6 seismic + 8 slope/SF + 3 FE3D + 7 FEM2D + 6 metadata/dec). All 96 keys typed in `CalcConfig`. | `VERIFIED` |
| `CALC.RC` symbol casing | Mentioned as `CALC.rc` in shorthand | Actual runtime property exported by `CALC` (`09_calc_core.js#L1403`) is uppercase **`CALC.RC`**. | `VERIFIED` |
| Electron `APP` / Claude Artifact host hooks | `window.tclApp` (`.isApp`, `saveFile`, `printPdf`, `reveal`, `open`, `quit`) and `window.claude.use("downloads")` | Pure Web App replaces IPC saves with Browser Blob `<a download>`, preserves hidden-`<iframe>` native `window.print()` (`#bPrint`), and adds direct downloadable PDF generation via `pdf-lib` (`#bPdf`). Verified across `appUi.test.tsx`, `full_parity.test.ts` (`QA 5`, `QA 6` — zero `tclApp`), and `e2e_browser.mjs` (`E2E-6`, `E2E-6b` downloads for `.tcl.json`, `.dxf`, `.svg`, `.csv`, multi-template `.docx`, `1p`/`12p` `.pdf`, PNG). | `VERIFIED` |
| Unsaved changes guard | `markClean` in `26_app_ui_export.js#L1279-1281` was gated by `if (APP)` | Web App (`src/state/appStore.ts`) tracks `cleanRev` to call `markClean()` on initial load, `openProject()`, and `saveProject()`, marks `bSave[data-dirty]` on edits, and wires `window.addEventListener("beforeunload", ...)` whenever `isDirty()` is true. Verified via `appUi.test.tsx` (`cleanRev`/save reset) and `e2e_browser.mjs` (`E2E-1`, `E2E-6` `.tcl.json` Save -> Mutate -> Open restore). | `VERIFIED` |
| Licensing & activation modules | Excluded during REA phase (`OMITTED_OUT_OF_SCOPE_*`) | Strictly forbidden and absent from `TuongChanL-Web/` (verified cleanly in `QA 6` + Wave 2 scan of all `70` files across `index.html`, `start-webapp.bat`, `src/**`, and `dist/**` with `0` forbidden artifacts). | `VERIFIED` |

---

## 6. Final QA Sign-Off Summary

- **Authoritative QA Report**: [`TuongChanL-Web/specs/qa-verification-report.md`](file:///E:/3.%20data/rea/TuongChanL-Web/specs/qa-verification-report.md) — **OVERALL STATUS: `PASS`** (Wave 2 Final Adversarial Verification Date: `2026-11-11`).
- **Build & Bundle (`npm run build` / `tsc --noEmit && vite build`)**: **PASS** (`EXIT:0`, `266` modules compiled cleanly into `dist/`: `dist/index.html` `0.81 kB`, `dist/assets/fem2d.worker-DFNv6fA-.js` `32.22 kB`, `dist/assets/index-Bxi0-4MH.css` `16.61 kB`, `dist/assets/index-Ck_59Y56.js` `1,264.51 kB`).
- **Vitest Parity & Integration Suite (`npx vitest run`)**: **PASS — `105 / 105` tests across `6 / 6` files** (`types.test.ts`: `2`, `appUi.test.tsx`: `4`, `parity.test.ts`: `21`, `cad_export.test.ts`: `36`, `full_parity.test.ts`: `31`, `engineAndReports.test.ts`: `11`).
- **Headless Chromium E2E (`node tests/qa/e2e_browser.mjs`, `1440×900` SwiftShader WebGL)**: **PASS — `11 / 11` checks** (`E2E-0`, `E2E-1`, `E2E-2`, `E2E-2b`, `E2E-3`, `E2E-3b`, `E2E-4`, `E2E-5`, `E2E-5b`, `E2E-6`, `E2E-6b`; `defects: []`; `0` console errors, `0` HTTP `>= 400` responses, `0` `pageerror` exceptions, `0` failed network requests; verified binary downloads incl. multi-template `.docx`).
- **Defect Closure & Wave 1/1b Fix Sign-Off**:
  - **`BUG-1` & `BUG-2` (CLOSED & VERIFIED)**: `src/engine/calcCore.ts#L1954-1956` `ok.all` fix and `TuongChanL-Web/index.html#L7-11` inline SVG favicon verified passing across Vitest and live E2E (`E2E-0`, `E2E-3b`, `E2E-5b`).
  - **Wave 1/1b Resolved Findings (ALL `VERIFIED`)**:
    - `src/engine/fem2dCore.ts`: `phi === 0` nullish-coalescing (`??`) preservation (`parity.test.ts`, `QA 2`).
    - `src/reports/reportHelpers.ts`: `sRC` `NaN` fix (`QA 5b`, `E2E-5`, `E2E-6`, `E2E-6b`).
    - `src/export/docx.ts`: `_rels/.rels` `rId2` core-properties relationship URI fix + multi-template OOXML/XML integrity (`QA 5b`, `E2E-6`, `E2E-6b`).
    - `src/export/pdf.ts`: `.fx`/`.tf`/`.tss` equation rendering & canvas PDF pagination (`QA 5`, `E2E-6` `12p` `calcPdf`).
    - `src/components/SidebarCadPanel.tsx`: `DraftRebarNum` `isInt` integer clamping (`appUi.test.tsx`, `cad_export.test.ts`).
    - `src/state/appStore.ts` & `src/components/CalcReportViewport.tsx`: live decimal `dec` (`'.'`/`','`) propagation across report/rebar tabs, CAD/Calc sidebar accordion open-state persistence across mode switches, and `FeViewPanel` (`q`/`k`/`az`/`el`/`ribs`) state persistence across sub-tabs (`appUi.test.tsx`, `E2E-2b`, `E2E-5`).
    - `src/components/Model3DViewport.tsx` & `src/styles/app.css`: `#v3foc button { pointer-events: auto; }` enabling pointer click on `Hiện tất cả (Esc)`, `#v3tip` hidden when idle, and single `setModel` call on mount/update (`appUi.test.tsx`, `E2E-4`).
    - `src/model3d/viewer3d.ts`: `webglcontextlost` / `webglcontextrestored` lifecycle handlers (`cad_export.test.ts`, `E2E-4`).
- **Clean-Room & Workspace Sign-Off**: `0` TuongChanL licensing, trial, hardware/machine ID, `.lic`, activation UI/IPC/CSS, or `tclApp` tokens detected across `70` scanned files (`index.html`, `start-webapp.bat`, `src/**`, `dist/**`); `0` temporary or stray files in `E:\3. data\rea\TuongChanL-Web\`. Every subsystem in Section 4 and Section 5 is signed off as **`VERIFIED`**.
