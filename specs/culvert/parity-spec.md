# BangTinhCauCong Web App — Master Functional Parity Specification

> **Strict Clean-Room Boundary**: This specification defines ONLY the structural, geotechnical, hydraulic/hydrological calculation engines, GeoTIFF DEM watershed delineation, Tesseract OCR, AutoCAD R12 DXF import/export, 2D/3D engineering visualization, ExcelJS/jsPDF reporting, and React 18 UI/UX reconstructed strictly from verified safe modules under [`E:\3. data\rea\analysis-cau-cong\`](file:///E:/3.%20data/rea/analysis-cau-cong/phase1-inventory.md) (`styles.css`, `shell.html`, `01`..`20`). Zero licensing, trial timer, hardware/machine ID, `.lic`, activation UI, or Electron IPC mechanisms may exist anywhere in `E:\3. data\rea\BangTinhCauCong-Web\`.

---

## 1. Architecture & Target File Ownership Map

`E:\3. data\rea\BangTinhCauCong-Web\` is a modular **React 18 + TypeScript 5.7 + Vite 6** offline-first standalone web application matching 100% functional and numeric parity with `"Bang tinh ket cau cau cong"` (`package.json`: `"bang-tinh-cau-cong"` v1.0.0, TCVN 11823:2017).

```text
BangTinhCauCong-Web/
├── .gitignore
├── AGENTS.md / CHANGELOG.md              # coordinator-lead governance & resume state
├── index.html                            # <html lang="vi">, inline SVG favicon, local offline boot
├── package.json / tsconfig.json / vite.config.ts
├── public/
│   ├── dem/                              # Offline Thanh Hóa GeoTIFF Base64 payloads (cop1, cop2, thanhhoa)
│   ├── fonts/                            # Offline Vietnamese TTFs (Arimo_400Regular, Tinos_*)
│   └── vendor/                           # Offline static MathJax / Tesseract worker/WASM/traineddata assets (zero CDN)
├── specs/
│   ├── parity-spec.md                    # This authoritative clean-room parity contract
│   ├── evidence-ledger.md                # Full REA ID + SHA-256 provenance & verification status ledger
│   └── qa-verification-report.md         # qa-verifier parity + E2E + licensing sign-off report
├── src/
│   ├── vite-env.d.ts
│   ├── types/
│   │   ├── project.ts                    # Canonical TS interfaces (modes, 46 tabs, KEEP, solvers, LK, VT)
│   │   └── index.ts
│   ├── engine/                           # Owned by: solver-engineer
│   │   ├── index.ts                      # Barrel & shared registry exports
│   │   ├── context.ts                    # IDP/CTX/CTXPAR routing, SCT2_LNK, numeric/DOM helpers, bilinear tables
│   │   ├── math/
│   │   │   ├── rcmFrame.ts               # Banded Cholesky / LDL^T 2D Frame solver (CH.Frame) & Mindlin Q4 plate (MD.plate)
│   │   │   └── rc.ts                     # Shared rectangular RC (RC), circular P-M (section/curve/phiMnAt/MCFT), 3D fiber P-M-M (pt3/capDir/compute3)
│   │   ├── bridge/
│   │   │   ├── crossfall.ts              # XFmk, XFgir, ITOP, IPAN, SUPDIST
│   │   │   ├── girderHollow.ts           # DAM (LIB 15/18/21/24), RCG (RC_LIB 868)
│   │   │   ├── girderI.ts                # GI (LIB 33, tendons, losses, §10.9 anchorage bursting)
│   │   │   ├── deckJoints.ts             # SUP2R (bmCalc, bmOhCalc, gcCalc), kdStep, LTNR, KCGR, GLCR
│   │   │   ├── abutmentHeavy.ts          # MO / MOR (A-A/B-B/C-C, Coulomb, M-O kae, csm, capStep, punchStep)
│   │   │   ├── abutmentFlex.ts           # MD (MDFLEX Winkler cap, mdSTM, variable stem cuts)
│   │   │   ├── pierFlex.ts               # TR / TRR (3D+torsion K3, RCM buckling, seismic trEq/trConf, trPileSoil)
│   │   │   ├── pierSolid.ts              # DCT / DCR (72x71 fiber P-M-M, dcSTMx, dcSTMb, sfGrid integration)
│   │   │   └── approachSlab.ts           # QD / QDR
│   │   ├── foundations/
│   │   │   ├── shallowFdn.ts             # SF (T17/N17, bzRigid, dqT, Cw, press 60x60 Newton, soilQn, settle, sfAnc)
│   │   │   ├── pileGroup.ts              # RK, PILE (axialK TCVN 10304), MC (108-elem latK + 6-DOF rigid cap)
│   │   │   └── drilledShaft.ts           # SCT (5 soil/rock strata, B1Q/B1A IGM Fig B1, group checks)
│   │   ├── culvertsWalls/
│   │   │   ├── boxCulvert.ts             # CH / CHR (1-3 cell FEM, patches, 14.5.3/8.3.4 shear), CHN (KT 28x7, TCVN 9362 e-p)
│   │   │   ├── pipeCulvert.ts            # CT / CTR (144-elem ring, Heger Type 1-4, direct & indirect D-load)
│   │   │   ├── wallGravity.ts            # TC / TCR (0.05° trial wedge, TKĐH 86-06X TC_LIB86, TC_B7/B9, bamboo piles)
│   │   │   └── wallCantilever.ts         # TL / TLR (interface shear IFT, rock anchors TL_TAU)
│   │   ├── hydrology/
│   │   │   ├── stationsDb.ts             # HVST (7 TH stations), HVSTL (31 KTTV), HVMAP, HVZONE, HVZL, HVWL (Giàng), TM_DB
│   │   │   ├── bridgeHydro.ts            # HV, HVKM, HVM (Pearson III, K-M, TCVN 9845 HVTAB A1-A4, DHXD, Manning, scour, NCW/NCL, HVHC/HVDZ)
│   │   │   ├── culvertHydro.ts           # TVC_ST (132 stations), TVC_Q, tvcSize, tvcHV, tvcCalc, TVX
│   │   │   └── demWatershed.ts           # HVD (GeoTIFF cop1+cop2/srtm, proj4 VN-2000, Priority-Flood Float64, D8 Kahn, Horn, DP+Chaikin)
│   │   ├── importers/
│   │   │   ├── dxfParser.ts              # DXS, TCV3, INSERT recursion, dxsFind, dxsBridge, tvxFile DXF+DEM mapper
│   │   │   └── ocrPipeline.ts            # OCRK (offline Tesseract v5, Otsu, table/line strip, ocrPaste, ocrProfile)
│   │   └── verification/
│   │       ├── lookupTables.ts           # LK (20 standard lookup tables & 30 MAP bindings)
│   │       └── verificationSuite.ts      # VT (106 fixed checks in 63 add() sites across G1..G9 + 15 live check branches)
│   ├── graphics/                         # Owned by: graphics-export-engineer
│   │   ├── index.ts
│   │   ├── svgPrimitives.ts              # svgKit, dgKit, CFig placement & collision avoidance
│   │   ├── cadDxfExport.ts               # TC.tcDxf (R12 AC1009, TC_U2T TCVN3 / \U+XXXX), HVD.dxf, hdDxfFig, HVD.plcmd, hdZip CRC-32
│   │   ├── plots3d.ts                    # Plotly 3D P-M-M interaction surface renderer (#p3d, #T_p3d, #C_p3d, #P_p3d)
│   │   └── texMath.ts                    # Offline MathJax v3 TeX-to-SVG cache (TEXC, mathAll) + Unicode fallback + eqSize/eqPng
│   ├── reports/                          # Owned by: graphics-export-engineer
│   │   ├── index.ts
│   │   ├── bridgeReports.ts              # damDraw*, rcg*Svg, GI GID/giRender/GIW, SUP2R/LTN/KCG/GLC/QD/MO/MD/TR/DCT figures & HTML
│   │   ├── foundationReports.ts          # SFM/SFD, MC/PD, SCT, PM2D/PM3D figures & tables
│   │   ├── culvertWallReports.ts         # CH/CHN, CT, TC (TCF 11 SVGs), TL (TLF) figures & HTML
│   │   └── hydroDemReports.ts            # hvFigFq/HQ/MC/Sec, hvStMap, hvStWhyAuto, hdDraw/hvLV, tvcFig, tvcMap
│   ├── export/                           # Owned by: graphics-export-engineer
│   │   ├── index.ts
│   │   ├── excelExport.ts                # buildWB / buildXlsx (ExcelJS A4 grid, tq_ngan dividers, 3x eqPng, 2x svgPng, P-M chart sheet)
│   │   ├── pdfExport.ts                  # buildPdf (jsPDF 2.5.1 + local Arimo/Tinos TTFs, exact buildWB METAS replay + block coalescing)
│   │   └── projectIo.ts                  # .json Save/Open (_app: "ckn11823", _v: 9), expName, downloadBlob, TM_DB local persistence
│   ├── styles/                           # Owned by: frontend-builder
│   │   └── app.css                       # Extracted styles.css (1,331 L), print rules (@media print), .tra / #lkBg modal CSS
│   ├── state/                            # Owned by: frontend-builder
│   │   └── appStore.ts                   # APPMODE switcher, PROJDEF, KEEP sync, localStorage _v<=9 migrations, dirty flag & debounced runners
│   ├── components/                       # Owned by: frontend-builder
│   │   ├── index.ts
│   │   ├── Toolbar.tsx                   # .tool bar (#appMode, #expScope, #btnX, #btnP, #btnSv, #btnOp, #btnDf, #btnBk, #klMsg, #xmsg)
│   │   ├── ProjectHeader.tsx             # .proj inputs (#pj1..#pj6)
│   │   ├── TabStrip.tsx                  # All 46 tabs + body-class/OBJ_TABS/IT_TAB declarative visibility
│   │   ├── OverviewPane.tsx              # #tab7 (TOC #tqToc, #tq_obj, #tq_kn/tru/mot/sct, #tqIt checklist, DEP warnings, #tq_ngan)
│   │   ├── VerificationPane.tsx          # #tab60 (#vt_run, #vt_sum, #vt_tb)
│   │   ├── LookupModal.tsx               # #lkBg / #lkBox ("Tra" modal w/ live SVG curves Cd & Kef)
│   │   └── LegacyShellBridge.tsx         # Declarative mount of all 46 verified engineering .pane calculation sheets + caption/table observer
│   ├── App.tsx                           # Owned by: frontend-builder
│   └── main.tsx                          # Owned by: frontend-builder
└── tests/
    ├── types.test.ts                     # coordinator-lead
    ├── engine/                           # solver-engineer
    ├── cad/                              # graphics-export-engineer
    ├── engineAndReports.test.ts          # graphics-export-engineer / frontend-builder
    ├── appUi.test.tsx                    # frontend-builder
    └── qa/                               # qa-verifier (Node vm differential oracle vs modules/01..20, Chromium E2E, zero-licensing audit)
```

> **Ownership Boundary Rule**: Sub-agents strictly own their assigned directories/files above. Cross-layer contract changes (adding/renaming fields on shared domain interfaces) must be coordinated through `src/types/project.ts` (`coordinator-lead`) so parallel implementations never diverge.

---

## 2. Application Modes, Project Metadata & 46-Tab Registry

### 2.1 Seven Calculation Modes (`#appMode`) & `PROJDEF`
`APPMODE` supports **7** canonical modes (`setMode(m, init)` clamps any unrecognized mode except internal legacy `"bia"`/`"biat"` back to `"cau"`):

| Mode `m` | Option Label (`#appMode`) | Body Class | Default `pj6` (`TÊN BẢNG TÍNH`) | Default `pj4` (`HẠNG MỤC`) | Export Base Filename Pattern | Save JSON Prefix |
|---|---|---|---|---|---|---|
| `"cau"` *(default)* | Cầu: kết cấu nhịp, mố, cọc | *(none)* | `"BẢNG TÍNH TOÁN KẾT CẤU CẦU"` | `""` *(placeholder)* | `Kiem toan CKN D<D> YYYYMMDD.xlsx` / `Bang tinh mo coc YYYYMMDD.pdf` | `So lieu cau YYYYMMDD.json` |
| `"ch"` | Cống hộp BTCT (tính độc lập) | `mch` | `"BẢNG TÍNH TOÁN KẾT CẤU CỐNG HỘP BTCT"` | `"Cống hộp BTCT"` | `Bang tinh cong hop <n> ngan YYYYMMDD.{xlsx,pdf}` | `So lieu cong hop YYYYMMDD.json` |
| `"ct"` | Cống tròn BTCT (tính độc lập) | `mct` | `"BẢNG TÍNH TOÁN KẾT CẤU CỐNG TRÒN BTCT"` | `"Cống tròn BTCT"` | `Bang tinh cong tron D<round(D0*1000)> YYYYMMDD.{xlsx,pdf}` | `So lieu cong tron YYYYMMDD.json` |
| `"tc"` | Tường chắn trọng lực (tính độc lập) | `mtc` | `"BẢNG TÍNH TOÁN TƯỜNG CHẮN TRỌNG LỰC"` | `"Tường chắn trọng lực"` | `Bang tinh tuong chan H<H>m YYYYMMDD.{xlsx,pdf}` | `So lieu tuong chan YYYYMMDD.json` |
| `"tl"` | Tường chắn chữ L BTCT (tính độc lập) | `mtl` | `"BẢNG TÍNH TOÁN TƯỜNG CHẮN CHỮ L BTCT"` | `"Tường chắn chữ L BTCT"` | `Bang tinh tuong chan L H<H>m YYYYMMDD.{xlsx,pdf}` | `So lieu tuong chan L YYYYMMDD.json` |
| `"tv"` | Thủy văn cầu (tính độc lập) | `mtv` | `"BẢNG TÍNH THỦY VĂN, THỦY LỰC CẦU"` | `"Thủy văn cầu"` | `Bang tinh thuy van cau YYYYMMDD.{xlsx,pdf}` | `So lieu thuy van cau YYYYMMDD.json` |
| `"tvc"` | Thủy văn cống (tính độc lập) | `mtvc` | `"BẢNG TÍNH THỦY VĂN, THỦY LỰC CỐNG"` | `"Thủy văn cống"` | `Bang tinh thuy van cong YYYYMMDD.{xlsx,pdf}` | `So lieu thuy van cong YYYYMMDD.json` |

### 2.2 Complete 46-Tab Registry (`shell.html` Order) & Reserved IDs
All **46** `<button class="tab" data-t="N">` buttons and corresponding `#tabN` `.pane` panels sit simultaneously in the workspace:

- **Engineering Tabs (`45`)**:
  - Bridge Overview (`cau`): `7` (`0. Tổng quan`, always visible in `cau`)
  - Standalone Bridge / Culvert Hydrology (`tv` / `tvc`): `54` (`Thủy văn cầu`), `70` (`Thủy văn cống`)
  - Bridge Superstructure (`cau` + `OBJ_TABS.dam`): `8` (`1. Dầm giữa`), `9` (`2. Dầm biên`), `10` (`3. Bản mặt cầu`), `11` (`4. Gối cầu` / `4. Kê dầm trên mố, trụ` when `supK()`), `12` (`5. Bản liên tục nhiệt`, gated by `ltnOn()`), `13` (`6. Khe co giãn`), `14` (`7. Gờ lan can`)
  - Bridge Abutment & Approach Slab (`cau` + `OBJ_TABS.mo`): `4` (`8. Tải trọng, tổ hợp mố`), `5` (`9. Kiểm toán mặt cắt mố`), `1` (`10. Nội lực đầu cọc`, `!sfmOn()`), `52` (`10. Kiểm toán nền móng nông`, `sfmOn()`), `6` (`11. Kiểm toán bệ cọc` / `bệ mố` / `bệ móng`), `2` (`12. Sức chịu tải cọc theo đất nền`, `!sfmOn()`), `56` (`12b. Sức chịu tải cọc mố M2`, `!sfmOn() && sctSep()`), `3` (`13. Kiểm toán cọc theo vật liệu`, `!sfmOn()`), `43` (`21. Bản quá độ` / `14. Bản quá độ`)
  - Bridge Pier (`cau` + `OBJ_TABS.tru`):
    - Shared / Flexible (`trOn()`): `20` (`14. Tải trọng, tổ hợp trụ`), `21` (`15. Nội lực trụ`), `22` (`16. Kiểm toán xà mũ, giằng`), `26` (`17. Kiểm toán thân trụ theo vật liệu`), `23` (`18. Nội lực cọc trụ`), `24` (`19. Sức chịu tải cọc trụ theo đất nền`), `57` (`19b. Sức chịu tải cọc trụ T2`, `sctSep()`), `25` (`20. Kiểm toán cọc trụ theo vật liệu`)
    - Solid Pier (`dcOn()`): `20` (`#dc_*` branch), `46` (`15. Kiểm toán xà mũ trụ`), `47` (`16. Kiểm toán thân trụ`), `49` (`17. Nội lực đầu cọc trụ`, `!sfdOn()`), `53` (`17. Kiểm toán nền móng nông trụ`, `sfdOn()`), `48` (`18. Kiểm toán bệ trụ`), `50` (`19. Sức chịu tải cọc trụ theo đất nền`, `!sfdOn()`), `58` (`19b. Sức chịu tải cọc trụ T2`, `!sfdOn() && sctSep()`), `51` (`20. Kiểm toán cọc trụ theo vật liệu`, `!sfdOn()`)
  - Box Culvert (`ch`): `15` (`1. Số liệu, tải trọng, nội lực`), `16` (`2. Kiểm toán mặt cắt`), `44` (`3. Kiểm toán nền móng`), `17` (`Phụ lục 1. Hệ số nền`)
  - Gravity Retaining Wall (`tc`): `41` (`1. Số liệu, tải trọng`), `42` (`2. Kiểm toán`)
  - Cantilever L-Wall (`tl`): `61` (`1. Số liệu, tải trọng`), `62` (`2. Kiểm toán`)
  - Circular Pipe Culvert (`ct`): `18` (`1. Số liệu, tải trọng, nội lực`), `19` (`2. Cốt thép và kiểm toán`)
- **Cross-Mode Verification Tab (`1`)**: `60` (`tvt` class, `"Kiểm chứng"`, visible in `cau` mode).
- **Reserved Unused IDs**: `27..40, 45, 55, 59, 63..69` have zero markup in `shell.html` (`biaInit() {}` & CSS `.mbia`/`.mbiat` are preserved only as non-visible compatibility stubs).

### 2.3 `OBJ_TABS`, `IT_TAB`, Cross-Tab Context Routing (`IDP` / `CTXPAR`) & `KEEP` Schema
1. **`OBJ_TABS` Scope Filters**:
   - `dam: [8, 9, 10, 11, 12, 13, 14]`
   - `mo: [4, 5, 1, 6, 2, 56, 3, 52, 43]`
   - `tru: [20, 21, 22, 26, 23, 24, 57, 25, 46, 47, 49, 48, 50, 58, 51, 53]`
   - `#tq_obj` (`"all" | "dam" | "mo" | "tru"`, normalizing `"tv" -> "all"`): toggling `"mo"` or `"tru"` enables `objLinkOff()` & `objUnlock()` (releasing `.lnk` read-only locks except `#mo_d1`); toggling `"tru"` forces `#tq_kn = "n"`.
2. **`IT_TAB` & Overview Checklist (`#tq_off`)**:
   - Exact **32-tab -> 22-item** map across 4 groups:
     - `sup`: `8->"8", 9->"9", 10->"10", 11->"11", 12->"12", 13->"13", 14->"14"`
     - `mo`: `4->"mtt", 5->"mmc", 1->"mnl", 52->"mnl", 6->"mbe", 2->"msc", 56->"msc", 3->"mvl"`
     - `tru`: `20->"ttt", 21->"tnl", 22->"txm", 46->"txm", 26->"tth", 47->"tth", 23->"tnc", 49->"tnc", 53->"tnc", 48->"tbe", 24->"tsc", 57->"tsc", 50->"tsc", 58->"tsc", 25->"tvl", 51->"tvl"`
     - `qd`: `43->"qd"`
   - Disabled item CSV persisted in hidden input `#tq_off`. Upstream `DEP` warning in `#o_tq_off` alerts users whenever a downstream check remains enabled while its upstream source (`"8"`, `"9"`, `"mtt"`, `"mnl"`, `"ttt"`, `"tnl"`, `"tnc"`) is unchecked.
3. **`KEEP` Schema (`_app: "ckn11823"`, `_v: 9`) & `localStorage` Keys**:
   - `KEEP`: all DOM `input.in, select.in, textarea, input.pj` elements with a non-empty `id`.
   - Snapshot stored on every `input`/`change` in `localStorage["ckn11823v5"]` with `_v: 9`.
   - Backup & auxiliary keys: `ckn11823v5_truoc_KL`, `ckn_kl_v1`, `ckn_mode`, `ckn_tab`, `ckn_tab_<mode>`, `ckn_proj_<mode>`, `ckn11823t5`, `ckn_ch_reb2`, `ckn_rc_init`, `ckn_gi_init`, plus `TM_DB` custom stations in `localStorage`.
   - Exact `_v < 2..9` field migrations (`12_piles_geotech_mcoc_and_pm3d.js:3946-3970`): strips deprecated `mo_jtm`, `s2_geoT`, `s2_bh`, `s2_top`, `mo_dky`, `mo_g`, `mo_ix`, `mo_hrt`, `tq_sup`, `mo_Tmax`, `gc_n/hri/hc/hs`, `bm_dB/sB/dT/sT/dLB/sLB/dLT/sLT/ct/cb`; deletes `s2_geo` if `s2_WL == null`; deletes `s2_spt` if falsy.
   - JSON file schema: `{ _app: "ckn11823", _v: 9, _mode: APPMODE, _date: ISOString, ...values }`. Import validates `o._app === "ckn11823"` and defaults missing `tq_off` to `""`.
4. **Cross-Tab Context Routing (`IDP` / `CTX` / `CTXPAR`)**:
   - Seven active contexts: `""` (`#tab1/#tab2/#tab3` abutment), `"Q_"` (`#tab56` M2 abutment shaft), `"T_"` (`#tab23/#tab24/#tab25` flex pier), `"U_"` (`#tab57` T2 flex pier), `"C_"` (`#tab26` flex pier column), `"P_"` (`#tab49/#tab50/#tab51` solid pier), `"W_"` (`#tab58` T2 solid pier).
   - Fallback parent map: `CTXPAR = { U_: "T_", W_: "P_" }`; secondary borehole sync `SCT2_LNK` copies 23 structural/resistance fields from primary (`""`/`"T_"`/`"P_"`) to M2/T2 (`"Q_"`/`"U_"`/`"W_"`).
   - `withCtx(prefix, fn)` saves/restores `[IDP, MCR, SCTR, ST3, PDC, CT3]` inside `try ... finally`.
5. **Deterministic Cross-Tab Link Chain**:
   - `spTypeApply()` (`"PC" | "RC" | "I"`) -> `xfLink()` -> `damLink()` / `giLink()` -> `supLink()` (`supK()`, `supApply()`, `kdStep()`) -> `MO` / `TR` / `DCT` -> `moLink()` (`#mc_src === "mo"`, or `sfmStep()`) -> `mdFlex()` (`mdCapStep()`) + `trLink()` / `trFeedColumn("C_")` / `trFeedPile("T_"/"U_")` + `dcFeedPile("P_"/"W_")` / `sfdStep()`, plus `#tab54` `hvLink()` -> `#td_MNCN, #td_ELg, #td_hx`.

---

## 3. Authoritative Engineering Solver Contracts

All numerical constants, empirical/code tables, step sizes, iteration bounds, sign conventions, and non-monotonic published table quirks must match `modules/01..20` exactly:

1. **Divergent Rebar `AREA` Tables Preserved Intentionally**:
   - `02` `AREA` (`10..32`, e.g., `14: 154, 20: 314, 25: 491, 32: 804`)
   - `11` `CH.AREA` (`6..40`, e.g., `36: 1018, 40: 1257`)
   - `11` `CT.AREA` (`6..25`, e.g., `14: 153.9, 16: 201.1, 20: 314.2, 25: 490.9`)
   - `03` `RC.bar(d)`: exact `Math.PI * d * d / 4`
2. **Superstructure & Deck Components (`04`, `05`, `10`)**:
   - `DAM` (`DAM.LIB["15"|"18"|"21"|"24"]`, transfer ramp $60 d_b$, **0.05 m** HL-93 step, 5-iter ES loss, §4.2.3 & §9.5.4.2 creep/shrinkage, fiber `Mn`, MCFT shear, interface shear).
   - `RCG` (`RC_LIB["868"]`, `RC_GRV`, 70-step nonlinear `flex()`, **0.01 m** moving-load sweep).
   - `GI` (`GI.LIB["33"]`, duct friction/6 mm anchor-set slip, `Kes=(N-1)/(2N)`, pre/post-deck losses `Kid`/`Kdf`, TCVN 11823-5 §10.9 anchorage bursting `giAncHtml` Eq. 158–161 + cracked-end STM).
   - `SUP2R`: `bmCalc`/`bmOhCalc` (Table 3 strips `660+0.55S` / `1220+0.25S`, 0.025 m wheel sweep, `stripSolve`), `gcCalc` (Method B `2A<=B`, `1.75` cyclic shear strain, shim thickness), `kdStep` (friction clamp `μ(DC1+DW)`), `LTNR` (0.02 m step rotation, `2EI/Lc`), `KCGR` (skew decomposition, `Tins` gap), `GLCR` (`GL_TL` `TL-1..5`, `GL_VEH`, App. A yield-line `LcI, RwI, LcE, RwE`).
3. **Abutments & Piers (`03`, `08`, `13`, `14`)**:
   - Shared rectangular `RC` (`200`-step bisection flexure, MCFT shear, §7.3.4 crack) and circular `P-M` (`CDL` 160 steps, AASHTO 2004 `TH_V/TH_E/TT/TB` `bilin()`, 3D `pt3`/`capDir`/`compute3` across 72 meridians × 160 ratios).
   - `MO` (`A-A`/`B-B`/`C-C`, Coulomb/K0, Table 22 `heq`, Mononobe-Okabe `kae`, `csm`, `capStep`, 720-seg `punchStep`) & `MD` (`16×16` Q4 Mindlin wingwall plate 2×2+1×1 Gauss, `mdFlex` Winkler cap beam, `mdSTM`, `mdThan`).
   - `TR` (transverse 2D frame + longitudinal torsional coupled `K3`, RCM Cholesky + 500-iter inverse-power buckling `TR.buck` across `βd ∈ {0, 0.5, 1}`, slenderness `22/100`, plastic hinge `trEq`, confinement `trConf`, brittle rock check `0.0004b` in `trPileSoil`).
   - `DCT` (`capInt` 200 strips, `72 × 71` fiber biaxial `P-M-M` `colSec`/`pmTable`/`pmCap`, `dcSTMx`, `dcSTMb`, `sfGrid`).
4. **Foundations, Culverts & Walls (`01`, `06`, `07`, `09`, `11`, `12`)**:
   - `SF`/`SFM`/`SFD`: Table 17 `T17/N17`, Table 13 `bzRigid`, Table 20 `dqT`, Table 18 `Cw`, `60×60` Newton `press()`, unfactored `SD` inclination in Vesic `soilQn`, `sfAnc` rock anchors, elastic settlement.
   - `RK`/`PILE`/`MC`: TCVN 10304 App. A + §7.4.2 (`axialK`), Table 21 P-multipliers, 108-element 4-pt Gauss lateral condensation `latK`, 6-DOF rigid cap `MC.run` (`T, m`, Mcoc sign flip `[1,1,1,-1,-1,-1]`).
   - `SCT`: 5 strata (`Sét, Cát, Cuội, IGM, Đá`), `B1Q/B1A` 17×7 IGM Figure B1 (`PSI = 0.006895` fix), Hoek-Brown Eq. 99–100 + intact `RQD >= 90%`, group block failure, equivalent raft settlement (§8.2.2.4 Eq. 52), negative skin (`1.25`), `2V:1H` soft clay punching.
   - `TC` (0.05° trial wedge, Table 23 `heqOf`, soil/SPT/rock bearing, empirical bamboo piles `TC_QGH`, TCVN 5573 masonry `TC_B7`/`TC_B9`, `TC_LIB` + `TC_LIB86` `TKĐH 86-06X`, `TC_SREF`), `TL` (interface shear `IFT` §8.4, rock anchors `TL_TAU`, §10.8 shrinkage), `QD` (`QD_HG`, 0.005*Ltt sweep).
   - `CH`/`CHN` (`CH.Frame` RCM banded $LDL^T$, `patches()`, 7/12/16 stations, `14.5.3`/`8.3.4.1`/`8.3.4.2a` shear, `ckn_ch_reb2`; `CHN` `KT` 28×7 Table, TCVN 9362 `e-p` settlement), `CT` (144-element ring, Heger Type 1–4 `INST`, `PSI_DEF`, `PHI`, direct `10.4.2` & indirect `10.4.3` `BFE_T`/`BFLL`).
5. **Hydrology, GeoTIFF DEM, OCR & DXF Importer (`15`, `16`, `17`)**:
   - `HVST` (7 stations), `HVSTL` (31 stations), `HVMAP`, `HVZONE`, `HVZL`, `HVWL` (Giàng), `TM_DB`.
   - `HV`/`HVKM`/`HVM`: Acklam `nInv`, Lanczos `lgam` + 200-step `gPinv` (`GPI` cap `50,000`), `HVKM` 26×5 `K-M` interpolation, `HVM.fit`, TCVN 9845 `HVTAB.A1..A4` (preserving exact published non-monotonic values w/ UI warning), `HVM.qDHXD`, `qTL`, `HVM.qHT`, Manning/Chézy-Bazin `secMake`, 4 general scour + 17 pier scour + 5 abutment scour formulas, `NCW`/`NCL` Cowan, `HVHC`/`HVDZ`/`hvAllFit`.
   - `HVD`: `dem/cop1.txt` + `dem/cop2.txt` (`sc = 0.1`), `dem/thanhhoa.txt` (`sc = 1.0`), user WGS84 GeoTIFF (`GTModelTypeGeoKey === 2`), `proj4` VN-2000 3-deg exact `+towgs84`, `Float64Array` Priority-Flood pit-fill + `1e-4` eps gradient, D8 + Kahn accumulation, 3×3 Horn slope, Douglas–Peucker + 2-pass Chaikin, R12 DXF `dxf()`/`hdDxfFig()`, `plcmd()`, uncompressed CRC-32 `hdZip()`.
   - `OCRK`: offline Tesseract.js v5 (`"eng"`, numeric whitelist, PSM 6), Otsu threshold, table line stripping, 5-scale `ocrPaste` & longitudinal strip `ocrProfile` (`[-90°, +90°]`, `[36..84] px` consensus).
   - `DXS`/`TCV3`: `$ACADVER >= AC1021` UTF-8 else `latin1` + `TCV3` (`0xA1..0xFE`), nested `INSERT` (`depth < 6`), `dxsFind`, `dxsBridge` (`Pearson r > 0.995`, pier clustering, `MNHT/MNTK/MNL`).
   - `TVC_ST` (132 stations, exact non-monotonic rows), `TVC_Q.R/B`, slab culvert Manning 100-step bisection, `tvcSize`/`tvcCalc`, `tvcEditor`, `TVX` batch DXF+DEM + marching-squares 10-m contours.

---

## 4. Lookup Modal (`LK`), Verification Suite (`VT`), ExcelJS & jsPDF Contracts

1. **`LK` Modal (`19_lookup_caption_mode_guard.js`)**:
   - Implements **20** lookup tables/curves (`uw, IM, mL, V, del, mu, VB, S, Cd, lf, heq, soil, R, G, grade, g13, exp, Kp, Kef, phig`) bound across **30** `MAP` host selectors with live `"Tra"` buttons, `data-for` disambiguation (`mo_V25`/`mo_gEQ`), and interactive SVG curves (`Cd`, `Kef`).
   - Preserves dynamic caption centering (`.ctr`), compact table wrapping (`.fit` `<= 5` cols outside `#tab60`), equation scaling (`>= 85%` inline, `>= 60%` `.wide`), and `hvCapNum()` renumbering in `#tab54`.
2. **`VT` Verification Suite (`20_verification_tests_vt.js`, `#tab60`)**:
   - Fixed suite `VT.C`: **106 fixed checks** generated across **63 `add()` call sites** spanning **9 benchmark groups** (`G1` 36 checks, `G2` 3, `G3` 14, `G4` 24, `G5` 9, `G6` 3, `G7` 6, `G8` 7, `G9` 4).
   - Live suite `VT.live()`: **15 conditional active-project cross-verification sections** (covering HL-93, hollow LLDF, I-girder LLDF, creep/shrinkage/PS losses, bearing Method B, deck strip, expansion joint, abutment earth pressure, TCVN 9845 hydrology, Manning hydrology, retaining wall `ka`, box culvert soil/LL, circular culvert, approach slab, link slab, barrier yield-line; **11 core bridge/active groups** evaluate on loaded bridge mode data).
3. **`buildWB` / `buildXlsx` (`18_appmode_export_xlsx_pdf.js`)**:
   - A4 portrait (`8.27 × 11.69 in`), base 12 columns + dynamic wide-table column expansion (`width 6.5`), `tq_ngan` (`0/1/2`) Part/Item divider sheets (`#CCFFFF`), `3×` PNG equation rasterization (`eqSize`/`eqPng` `EXPX=7.2`, max `600 px`), `2×` SVG PNG (`svgPng`), Plotly `600×450×2` PNG, `glue` block pagination, and conditional `"Bieu do tuong tac"` sheet (`APPMODE === "cau"`).
4. **`buildPdf` (`18_appmode_export_xlsx_pdf.js`)**:
   - Consumes `{ wb, metas }` directly from `buildWB()` on `jsPDF 2.5.1` (`pt`, A4 `595.28 × 841.89 pt`).
   - Embeds local Vietnamese TrueType fonts (`/fonts/Arimo_400Regular.ttf`, `/fonts/Tinos_{400Regular,400Regular_Italic,700Bold,700Bold_Italic}.ttf`) with zero external CDN requests; replays exact cell fills, borders, merges, `shrinkToFit`, `0.93` text shrinking (`<= 12` passes), spillover, repeated `HEADROWS`, `"Trang PN/N"` footers, and coalesces consecutive same-signature sheets when `AV - Y >= 0.15 * AV`.

---

## 5. Standalone Browser Adaptations (Zero Electron / Zero CDN)

1. **Zero CDN Network Dependencies**:
   - Replace all `https://cdn.jsdelivr.net/...` loads in `HVD.libs()`, `OCRK.ocrLoad()`, `PDFDEP`, `<head>` scripts (`ExcelJS`, `Plotly`, `MathJax`) with bundled npm packages (`exceljs`, `geotiff`, `proj4`, `jspdf`, `jszip`, `plotly.js-dist-min`, `tesseract.js`, `mathjax`) and/or Vite static vendor files under `public/vendor/` so the app runs 100% offline.
   - `public/fonts/*.ttf` (`5` files) and `public/dem/{cop1,cop2,thanhhoa}.txt` (`3` files) served locally from `/fonts/` and `/dem/` (matching original relative paths `fonts/...` & `dem/...` cleanly via base `/` or Vite `import.meta.env.BASE_URL`).
2. **Browser Download & I/O Parity**:
   - Remove `window.__tv4` / Electron main-process bridges; export all `.xlsx`, `.pdf`, `.json`, `.dxf`, `.zip`, `.png` outputs directly via standard Browser `Blob` + `<a download>` (preserving exact filenames and cancellation/busy messages in `#xmsg`).
3. **In-App React State Restoration (No `location.reload()`)**:
   - Opening a `.json` file (`#btnOp`/`#fOp`), triggering `#btnDf` (2-click armed 5-second default reset), or `#btnBk` (restore `ckn11823v5_truoc_KL`) rehydrates `appStore` state, updates DOM/React inputs, recalculates active mode, and persists cleanly to `localStorage` without hard page reload (`window.location.reload()`).
   - Tracks `isDirty` edits relative to baseline snapshot (`load` / `open` / `save`) and wires `window.addEventListener("beforeunload", ...)` when unsaved changes exist.
4. **Asset Hygiene**:
   - `index.html` includes an inline `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,...">` to eliminate `/favicon.ico` HTTP 404 console noise.
