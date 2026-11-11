# TuongChanL Web App — Master Functional Parity Specification

> **Strict Boundary**: This specification describes ONLY the engineering geometry, structural/geotechnical calculation solvers, 2D CAD engine, 3D WebGL viewer, report/export pipelines, and UI/UX features evidenced in the safe extracted REA modules of `TuongChanL`. Zero licensing, trial timer, machine-ID, `.lic`, or activation mechanisms are included or permitted.

---

## 1. Web Application Architecture (`E:\3. data\rea\TuongChanL-Web\`)

```text
TuongChanL-Web/
├── index.html                        # Vietnamese document root (<html lang="vi">), mounts #root
├── package.json                      # Vite + React + TypeScript + pdf-lib + Vitest
├── tsconfig.json                     # Strict TypeScript config
├── vite.config.ts                    # Vite + Vitest jsdom test config + ES worker config
├── specs/
│   ├── evidence-ledger.md            # SHA-256 checksums, REA evidence IDs & parity status tracker
│   └── parity-spec.md                # This single-source-of-truth functional contract
├── src/
│   ├── main.tsx                      # React 18 root bootstrap
│   ├── App.tsx                       # Workspace shell & provider composition
│   ├── vite-env.d.ts                 # Vite client type definitions
│   ├── types/
│   │   └── project.ts                # Exact domain contracts (100% field parity with TuongChanL)
│   ├── state/
│   │   └── appStore.ts               # Project state, debounces, FE/GS/FEM caches, dirty tracking, undo/toasts
│   ├── engine/
│   │   ├── presets.ts                # DIAS, baseProject, CANTI_DIM/REB/TIE, KE_TAB, D_TAB, preset*, mergeProject
│   │   ├── geom.ts                   # geom(), ancGrid(), ancWarn(), calcFill(), calcGeomP(), areaClipY()
│   │   ├── rebar.ts                  # buildBars(), buildBarsB/C/D/G(), barList(), numberMarks(), cFormula()
│   │   ├── quantities.ts             # quantities() concrete/blinding/formwork/rebar/ratio
│   │   ├── water.ts                  # WATER (build, seepSolve, pipingCheck, faceForce, contourLines)
│   │   ├── slope.ts                  # SLOPE (model, circleFS, search, run)
│   │   ├── calcCore.ts               # CALC (RC, wedge, coulomb, bearing*, seismicParams, COMB, calc, ...)
│   │   ├── calcOrchestrator.ts       # calcDefaults[D], calcEnsure, calcInputs, calcRun, calcSuggest, calcApplyFixes, calcEnsureAll
│   │   ├── calcRibbed.ts             # ribBeam, calcRibRun, calcGlobalChecks, calcRibChecks, calcSuggestRib
│   │   ├── fe3d.ts                   # FE3D (24-DOF quad shell + MITC4 + RCM + skyChol)
│   │   ├── cfe.ts                    # CFE (3D/strip retaining wall FE model, solve, check, ribProvider)
│   │   ├── fem2d.ts                  # FEM2D_MAKE() P6 Mohr-Coulomb + SRM engine & pack/unpack/svgPlastic
│   │   └── fem2d.worker.ts           # Vite ES Web Worker wrapping FEM2D_MAKE().job(m) (+ Blob fallback option)
│   ├── cad/
│   │   ├── layers.ts                 # LAYERS (17), PAPER, SCALES, DIMSTY, textW, capFirst
│   │   ├── ents.ts                   # Ents primitive builder + bbox()
│   │   ├── dimCallout.ts             # dimRaw, dimRows, callout, calloutAH, cbl, calloutM, chainNote, fanLabels
│   │   ├── dots.ts                   # settleDots multi-pass solver
│   │   ├── viewsCommon.ts            # viewSection, viewElevation, viewPlan, viewSectionRebar, viewRib*, viewElevRebar, viewBaseRebar
│   │   ├── viewsTemplateB.ts         # viewSectionRebarB, viewBarTableB
│   │   ├── viewsTemplateC.ts         # viewSectionRebarC, keyRebarC
│   │   ├── viewsTemplateD.ts         # viewSectionD, viewElevationD, viewSectionRebarD, viewElevRebarD, viewSlabPlanD, viewDrillD, viewLuoi3D, viewPlanD
│   │   ├── viewsSchedule.ts          # viewBarShapes, viewBarTable, viewSummary, notesFor
│   │   ├── sheets.ts                 # SHEET_DEFS (5 sheets), layoutViews, buildCluster, autoScale, buildSheet
│   │   ├── svg.ts                    # toSVG() (dark preview & light print)
│   │   └── dxf.ts                    # toDXF() AutoCAD R12 (AC1009), \U+XXXX, *D* DIM blocks, bulge circles
│   ├── model3d/
│   │   ├── mesh.ts                   # M3Mesh, M3Tubes, m3Clean, m3Tri, m3Concrete
│   │   ├── bars3d.ts                 # m3Bars, m3BarsC, m3BarsD, model3D
│   │   └── viewer3d.ts               # V3 shaders, v3Init, v3Upload, v3Draw, v3ClipVec, v3Pick, v3Overlay, v3Png
│   ├── reports/
│   │   ├── texToHtml.ts              # texTokens, texToHtml + .fx CSS styles
│   │   ├── cfig.ts                   # CFig SVG builder, cfW, cfPlace, cnf, CALC_DEC
│   │   ├── calcFigures.ts            # cfSection, cfWeights, cfPressure, cfBase, cfAnchor, cfRC, cfLoads, cfRbScheme
│   │   ├── calcExtFigures.ts         # cfWater, cfSeismic, cfSlope, calcExtInputs/Loads/Checks/Sum
│   │   ├── calcFeCharts.ts           # FE_RAMP, cfFe3D, cfFeStrip, cfFeMesh, cfFeChart, cfFeRibDiag, cfFeReact, calcFeSheet
│   │   ├── calcGsFemCharts.ts        # gsLut, gsRaster, gsChart, cfGs*, cfFemChart, calcFemSheet, calcGsView/Sheet
│   │   ├── calcSheetHtml.ts          # calcSheetHead, calcSheetTailCanti, calcRbSchedule/Sheet, calcSheetCanti, calcSheetHTML
│   │   └── calcRibSheet.ts           # cfRibPlan/Elev/Chart, sRibRC, calcSheetRib
│   ├── export/
│   │   ├── csv.ts                    # buildCsvContent() & exportCSV()
│   │   ├── docx.ts                   # zCrc32, zDeflate, zipBuild, omParse, dxTable, dxGrid, dxSvgPng, calcDocxBlob
│   │   ├── pdf.ts                    # printDoc() (hidden-iframe Print) + exportPdf() (direct downloadable .pdf via pdf-lib)
│   │   └── projectIo.ts              # downloadFile(), saveProject(), openProject(), baseName()
│   ├── styles/
│   │   └── app.css                   # Extracted styles.css L1–179 + report print styles (zero licensing styles)
│   └── components/
│       ├── HeaderToolbar.tsx         # Brand + open/save/DXF/PNG/DXF-all/SVG/Print/PDF/Docx/CSV buttons
│       ├── SidebarMetrics.tsx        # #sum 3-col cards & #warn list (CAD/3D vs Calc modes)
│       ├── SidebarCadPanel.tsx       # Template SVG thumbs (Mẫu 1..4), quick heights, dims, fill, rebar table, settings
│       ├── SidebarCalcPanel.tsx      # 12 calculation accordions (0..11), rebar auto-suggest box, heel hint
│       ├── Cad2DViewport.tsx         # #stage dark SVG viewport, wheel zoom-to-cursor, pointer pan, dblclick fit
│       ├── Model3DViewport.tsx       # #v3d WebGL canvas, #v3bar controls, #v3leg legend, #v3ax triad, #v3tip, #v3foc
│       ├── CalcReportViewport.tsx    # #calcv sticky .csub tabs, interactive FE element inspector, GS/FEM triggers
│       └── ToastBanner.tsx           # #toast notification bar
└── tests/                            # Vitest unit, numeric parity, CAD/DXF/SVG, DOCX/PDF, & UI tests
```

---

## 2. Exact Parity Contracts by Domain

### (a) Data Schema, `.tcl.json` Roundtrip, 4 Templates & `calcDefaults`

1. **File Envelope (`.tcl.json` / `.json`)**:
   - Export filename: `${baseName()}.tcl.json`, formatted `JSON.stringify({ app: "tuong-chan-L", v: 1, p: project }, null, 1)`.
   - `baseName(name)` normalizes `NFD`, strips combining marks `[\u0300-\u036f]`, maps `đ->d`, `Đ->D`, replaces `[^\w]+` with `_`, truncates to `40` chars (default `"tuong-chan"`).
   - `openProject` requires `parsed.p` and passes it to `mergeProject(parsed.p)`.
   - Exported files from original Windows `TuongChanL` MUST load losslessly without throwing or losing fields; saved files from Web App MUST obey `{ app: "tuong-chan-L", v: 1, p }` so original `TuongChanL` can open them back.

2. **Four Wall Templates (`Mẫu 1..4` ↔ `tpl: "B" | "A" | "C" | "D"`)**:
   - **Mẫu 1 · Chữ T ngược** (`tpl: "B"`): `presetCanti(500)` default; `H = 4..13 m` via `CANTI_DIM`, `CANTI_REB`, `CANTI_TIE`, `CANTI_N5`, `HK`. `type` defaults to `"canti"`, switchable to `"rib"`. `slopeFront: true`, `cover: 7.5`.
   - **Mẫu 2 · Có sườn** (`tpl: "A"`): `presetRib()`; `H: 820, tst: 52, tsb: 80, toe: 50, heel: 720, tBase: 80, tTip: 80, Lu: 1180, cover: 5, fil: 20, cap: { w: 90, hv: 30, hs: 15 }, beam: { on: true, w: 50, d: 50 }, rib: { t: 40, gap: 280, edge: 90, drop: 51 }`, `type: "rib"`, switchable to `"canti"`.
   - **Mẫu 3 · Khối kè có sườn** (`tpl: "C"`): `presetKe({}, idx)`; 27-entry `KE_TAB` (`K1`..`K104`); `concrete: "M200"`; `type` locked to `"rib"`; `C_MARKS` (`"1".."16"`, `"5A"`, plus `"17"` when anchored); flush front toe key (`toeEnd: true`).
   - **Mẫu 4 · Chữ T ngược neo đá** (`tpl: "D"`): `presetWall4({}, idx)`; 6-entry `D_TAB` (`D80, D65, D60, D60b, D45, D30`, default `idx = 1 -> D65`); `type` forced by preset (`"rib"` if `ribH > 0`, else `"canti"`); `blindOn: false`, `anc.on: true`, `vtop: 100`, `pvc: { d, a }`.

3. **96-Key `calcDefaults()` & `calcDefaultsD()` Contract** *(Verification note vs `01-data-and-templates.md`)*:
   - While `01-data-and-templates.md` prose counted "89 keys", direct inspection of [`calcDefaults()`](file:///E:/3.%20data/rea/analysis/modules/10_calc_orchestrator.js#L29-L128) establishes **96 exact keys** (all represented on [`CalcConfig`](file:///E:/3.%20data/rea/TuongChanL-Web/src/types/project.ts)):
     - Backfill & surcharge (10): `gs, phi, dw, dvA, dv, cs, q, LL, dT, qL`
     - Concrete, exposure, aggregate, interface (5): `gc, fc, ge, ag, ift`
     - Foundation, bearing, rock (23): `soil, gf, phif, cf, Su, Dw, hf, brm, phib, Nspt, Ri, phibS, brmR, qu, RMR, rockT, phibR, qRu, phit, eta, cR, phiR, gR`
     - Rock anchors (16): `anc, aOT, aSl, aSlSet, aTv, ad, afy, aDh, tauA, atau, aLr, aLc, agf, as, aX, amu`
     - Water & seepage (12): `wOn, hB, hF, wMode, gsat, gfs, Tn, kbx, kby, kfx, kfy, FSp`
     - Seismic (6): `eqOn, eqA, eqKm, eqKh, eqKv, eqG`
     - Slope & allowable safety factors (8): `bsOn, bsT, bsPhiR, fsSl, fsOt, fsGs, fsSlE, fsOtE`
     - 3D/Continuous FE (3): `feOn, feBasis, feN`
     - 2D FEM (7): `femOn, femMesh, femSrm, femEb, femEf, femPsi, femLifts`
     - Project metadata & decimal separator (6): `pjName, pjItem, pjPlace, pjBy, pjDate, dec`
   - `calcDefaultsD()` overrides 12 keys: `soil: "a", anc: true, aSl: "dw", aOT: false, LL: false, qL: 20, brmR: "cp", phibR: 0.45, dw: 25, phit: 0.9, feOn: true, feBasis: "fe"`.
   - `calcEnsure(P)`: migrates legacy `(kb, kf)` into `(kbx, kby) = kb * 1e-6`, `(kfx, kfy) = kf * 1e-6` before deleting `kb/kf`, then backfills missing keys from `calcDefaults()`.
   - `calcFamilyFix(p, wasD)`: when toggling `tpl === "D"`, swaps between `calcDefaultsD()` and `calcDefaults()` while retaining `dec`, `pjName..pjDate`.
   - `mergeProject(s)`: merges template baseline + nested objects (`rib, pvc, anc, key, beam, cap`) + per-key `rb` entries + legacy anchor migration (`tpl !== "D"`, `s.anc.on === undefined`, `s.calc.soil === "a" && s.calc.anc`).

---

### (b) Geometry, Rebar, Quantities, Warnings & Template Rules

1. **Cross-Section Geometry (`geom(p)`) in `cm`**:
   - Origin `(0, 0)` at toe underside; `B = toe + tsb + heel`, `yTop = tBase + H`, `xbb = toe + tsb`.
   - Mutual exclusions: `beamOn(p) = tpl === "A" && beam.on && !ancOn(p)`; `keyBlocked(p) = (tpl === "A" && beam.on) || (tpl !== "D" && ancOn(p))`.
   - Counterfort ribs (`type === "rib"`): `n = max(1, floor((Lu - 2*edge + gap)/(gap + t) + 1e-9))`, symmetric spacing around center of `Lu`, hypotenuse `T->E` polygon `hyp.tri`.
   - Anchors (`ancGrid(p, g)`): margin `>= 25 cm`, `Lc = min(L/2, max(10, tMin - cover))`, `Lb = L - Lc`, `G.dxt = max(dn, Lb)`.
2. **Template-Specific Rebar Rules**:
   - **Template `B`**: `CANTI_N5` / `n5sig(p)` rule — keeps exact CAD longitudinal bar total (`n5cad`) when `n5sig(p) === p.n5sig`; uses `CANTI_TIE` tie positions when `abs(g.B - p.tieB) < 0.1` (`tieRowsB` / `tieXsB`); `numberMarks` merges marks when `h1.d === l1.d`.
   - **Template `C`**: `F = cFormula(p, g, G)` vs baseline `F0` on `KE_TAB[keIdx]`; applies integer/length deltas to `row.c[mark]` and marks `edited = true` when `F !== F0`; adds `5A` and anchor `17` cleanly.
   - **Template `D`**: fixed end margin `zm = cover + 2.5 cm`; separates rear `h1` (`t3`) and front `h1a` (`t3a`); slab perimeter ring `b3`, end U-bars `b4`, Grid 3 (`b4a`, `b6`) avoiding clear layers, heel ties `b5`, diagonal rib `t7` stepped along normal; anchor key maps to `"k1"`.
   - **Template `A` / Generic**: `footTop` nudges 0.25 cm left up to 24 cm to clear `l1` longitudinal bars inside edge beam; `beamDots` distributes `e1` along perimeter; `ribBarSet` generates `ng = 1..6` curtailed `r1..r1f` bars via `ribCuts`.
3. **Quantities (`quantities(p, res)`)**:
   - `conc.{foot, stem, key, rib, tot}` (`m³`), `blind` (`m³`), `form.{foot, stem, rib, ends, tot}` (`m²`, skipping slopes `|dx|/L > 0.866`, deducting rib footprint on sloped stem, optional end faces `formEnds !== false`), `byD`, `totKg`, `ratio = totKg / vol`.
4. **Warnings (`res.warn`)**:
   - Exact preservation of TCVN 11823 – 5.10.3.1 clear spacing (`a*10 - d < max(1.5*d, 38)` mm), max pitch `> 45 cm` (G), stock bar length `> 11700 mm`, cover `< 4 cm` (G, D), `tsb < tst` (G, B, C), `ancWarn` (`Lc` clamp & `Lr < 5 cm`), and Template `C` CAD-delta verification warning (`edited`).

---

### (c) Calculation Engines, Solvers & Status Badge

1. **`WATER` (`src/engine/water.ts`)**:
   - `WATER.build(I, g, opt)` computes clamped `hB, hF, hFtop`, selects `"hs"` (always forced on rock foundations) vs `"fd"` (`seepSolve` finite-volume PCG with harmonic conductances, bilinear `headAt`, Darcy `stream`, `ubHead`), integrates Simpson/midpoint resultant loads `back`, `uplift`, `front`, and checks `pipingCheck` (Terzaghi exit prism in `"fd"` vs Lane creep gradient in `"hs"`).
2. **`SLOPE` (`src/engine/slope.ts`)**:
   - Simplified Bishop (`model`, `circleFS`, `search`, `run`): 23×17×7 = 2,737 coarse grid + 40-pass pattern refinement (`N = 48` slices, `FS_init = 1.5`, 40 fixed-point iterations, `ma >= 0.2`, clay total stress `u = 0` vs pore water pressure). Requires `FS >= 1 / bsPhiR`.
3. **`CALC` (`src/engine/calcCore.ts`)**:
   - **Upper-case `CALC.RC`** section engine (`mat`, `flex` 200-step bisection, `crack` with unconditional `s <= smax` in `rcOK`, `shear` MCFT with negative compression axial force `-l.N`, `run` with `phi = 1.0` for `"DB"` seismic cases & `minR` against `CD` only).
   - Trial Coulomb `wedge` (`0.05°` step, water submergence, `cs`, Mononobe-Okabe `(kh, kv)` inertia on soil weight), TCVN 11823-3 `heqOf` HL-93 `LS` live load, 6 load combos `COMB` (`Ia, Ib, Ic, SD, Ea, Eb`), Meyerhof `press`, Vesic bearing (`SD` loads for inclination `iq, ig, ic`), Peck SPT bearing, Hoek-Brown rock bearing, `iface` construction joint shear friction, and anchor tension/dowel shear (`aSl === "dw"` bypasses base friction).
4. **Orchestrator (`calcRun`) & Ribbed Wall (`calcRibRun`)**:
   - `calcRun(P)` converts cm -> m (`calcGeomP`), collects inputs (`calcInputs`), runs `CALC.calc` (`model: "canti"`) or `calcRibRun` (`model: "rib"`, `ribBeam` 1D FEM continuous beam, smearing rib self-weight/displaced soil, 9-level stem + rib T-section w/ `Vch` + cutoff + `tie2` + heel + `tie3` + toe + 5-group shrinkage), merges `CFE.check` (when `feOn` & cache current — re-running rib with `CFE.ribProvider` `KFE = 1.1` when `feBasis === "fe"`), and optionally runs `SLOPE.run` when `bsOn`.
5. **`FE3D` & `CFE` (`src/engine/fe3d.ts`, `cfe.ts`)**:
   - 24-DOF flat quad shell with Taylor/Wilson incompatible membrane modes (`inv4` static condensation) + MITC4 assumed shear (`kappa = 5/6`) + drilling penalty + 6×6 Jacobi rigid-body check + RCM bandwidth minimization + variable-band Cholesky (`skyChol`).
   - Statically determinate pin supports (`[0, ym, 0]`, `[B, ym, 0]`, `[0, ym, Lu]`) + self-balanced Meyerhof soil reactions (`Rpin ~ 0`), extracting check sections `S1..S4` or `S1..S9` (`KFE = 1.1` on rib sections `S8, S9` & profile).
6. **`FEM2D` Web Worker (`src/engine/fem2d.ts`, `fem2d.worker.ts`)**:
   - Graded P6 quadratic triangles (~3,000 fine `"n"` / ~1,000 coarse `"c"`), fully bonded soil–wall nodes, multi-surface active-set Mohr-Coulomb + zero tension-cutoff Rankine return mapping, modified Newton -> L-BFGS (`m = 8`) -> recursive step halving across construction stages `S0..S4` + optional `srm`.
   - **Web-Adaptation**: In Vite + TypeScript, we support dedicated Vite ES Web Worker (`new Worker(new URL('./fem2d.worker.ts', import.meta.url), { type: 'module' })`) **AND** unit-testable synchronous/fallback `FEM2D.job(m)` invocation with exact message contract `{ id, m } -> { id, out } | { id, err }` and 1200 ms debounce + max 2 auto-retry anti-loop guard (`calcFemCanAuto`).
7. **Auto-Sizing & `#calcBadge`**:
   - `calcFindBars` filters `CALC_DS × CALC_AS` for `a*10 - d >= max(1.5*d, 38)` sorted by `(As, cur.a match, d)`.
   - `calcSuggest` (`s1 -> s2 -> b1 -> b2 -> h1 -> l1`) & `calcSuggestRib` (`h1 -> s1 -> s2 -> b1 -> b2 -> l1 -> r1 -> r2 -> r3`) + `calcApplyFixes(P, items)` + `calcHeelHint(P)` (`+5 cm..+400 cm`).
   - `#calcBadge` displays `"✗ N"` (`.bad`), `"…"` (if `calcFeStale`), or `"✓"` (`.ok`), ignoring `info: true` items.

---

### (d) 2D CAD 5 Sheets, SVG, AutoCAD R12 DXF & CSV Exports

1. **5 Sheets (`SHEET_DEFS`)**: Exact view compositions for `B`, `A`, `C`, `D` across:
   - Sheet 1: `CHI TIẾT TƯỜNG CHẮN` (`noScale: false`)
   - Sheet 2: `BỐ TRÍ THÉP TƯỜNG CHẮN (1)` (`noScale: false`)
   - Sheet 3: `BỐ TRÍ THÉP TƯỜNG CHẮN (2)` (`noScale: false`, appends `viewDrillD` when `g.an` active on any template)
   - Sheet 4: `CHI TIẾT CÁC THANH THÉP` (`noScale: true`, 3-col `100×46 mm` cells from `barList(res)`)
   - Sheet 5: `BẢNG THỐNG KÊ KHỐI LƯỢNG` (`noScale: true`, `viewBarTableB` on `B`, `viewBarTable + viewSummary` on `A/C/D`)
   - No drawing border frame or corner title block on CAD sheets (`buildCluster` adds `8 mm` outer margin + `notesFor`).
2. **Layers & Drafting Engine**:
   - Exact 17 `LAYERS`, `PAPER` (`A3..A0`), `SCALES` (`10..250`), `DIMSTY[tpl]`, `Ents`, `dimRows` (24×1.25 mm de-collision + forbid stations), `callout`/`calloutAH`/`calloutM`/`chainNote`/`fanLabels`, `settleDots` (2 pushes + ring search + progressive radius shrink down to `d/20`), and `autoScale`.
3. **Exports**:
   - `toSVG(sh, o)`: `#212830` dark preview vs `#ffffff` light print (`Y_svg = H - y`), halo strokes, `col: 3` green text.
   - `toDXF(sheets)`: AutoCAD R12 `AC1009`, mm units (`*10`), `\U+XXXX` Unicode escape, `CONTINUOUS/DASHED/CENTER` scaled by `S0`, 17 layers, anonymous `*D*` `BLOCK` + `DIMENSION` entities, 2-vertex thick `bulge = 1` closed `POLYLINE` circles for filled `RDOT`/`RDOTW`, 4-point `SOLID` arrows, multi-sheet vertical stacking for `exportDXF(true)`.
   - `exportCSV`: UTF-8 BOM `\ufeff`, quoted CRLF fields, unaccented ASCII headers, iterating unmerged **`res.bars`** (preserving exact TuongChanL parity) + concrete/blinding/formwork totals.
4. **2D Viewport Gestures**:
   - Wheel zoom `k = 0.85` / `1/0.85` anchored to cursor using `preserveAspectRatio` letterbox math (`ar > sar` vs `ar <= sar`), pointer-capture drag pan (`.grab`), `dblclick` and `#bFit` reset to `{ x: 0, y: 0, w: sh.W, h: sh.H }`.

---

### (e) 3D WebGL Viewer (`model3D`, `M3Mesh`, `M3Tubes`, `V3`)

1. **Geometry & Tube Sweep (`model3D`, `cm`, origin at toe underside)**:
   - `m3Concrete`: 3 separate `M3Mesh` buffers (`conc`, `lean`, `soil`) with CCW ear-clipping (`m3Tri`) and rib side-wall predicate `o.keep`.
   - `M3Tubes`: parallel-transport Rodrigues frame `m3rot`, miter cap `1 / max(0.2, dot)`, split on sharp reversals `dot < -0.85`, 60,000-vertex chunking (`Uint16Array` safe), returns per-bar `{ ci, i0, n }` index slices.
   - Template rules: `m3Bars` (`B/A`, `l1` vs `r1*` & `e1` vs `r1*` avoidance), `m3BarsC` (`1..17` + two unscheduled `"KH"` key visual groups with `bs: []`), `m3BarsD` (`±3.5 cm` `s1/s2` alternating offsets, `nudgeX`, `t7` normal shift optimization).
   - Reset signature `sig = [p.tpl, p.type, p.H, p.Lu, g.B].join("|")`.
2. **WebGL Pipeline (`V3`)**:
   - Three shaders (`pTube`, `pMesh`, `pLine`), `preserveDrawingBuffer: true`, `6` or `8` sides chosen at `nSeg < 2500`, minimum `0.9 px` tube screen width (`uMinPx = 0.9`), two-pass front/back cull transparent concrete/lean/soil (`alpha`), dimmed non-focus bars (`a = 0.16`), 17-color `V3_PAL` vs `"cad"` red, legend offset compensation (`v3LegW()`).
   - **Section Clipping (`v3ClipVec`)**: `axis ∈ { '', 'x', 'y', 'z' }`, `t ∈ [0..1]`, `flip` checkbox, shader `discard`.
   - **CPU Picking (`v3Pick`), Legend Toggle & Discrepancy `*`**: projects `gr.segs` omitting clipped midpoints, hover `#v3tip`, click group `#v3leg` or canvas bar to isolate `V3.focus` (`Esc`/background clears), `#v3leg` checkboxes mutate `V3.hidden`, `v3Diff(gr)` flags `*` when drawn bar count differs from BOM.
   - **PNG Export (`v3Png`)**: composites WebGL buffer + bottom template/metric caption + `#v3ax` triad (`0.9×` DPI scale) -> `${baseName()}_3D.png`.

---

### (f) Reports, Word (`.docx`), Browser Print & Real Downloadable `.pdf`

1. **Equations & Figures (`texToHtml`, `CFig`)**:
   - `texToHtml` preserves raw LaTeX in `<span class="fx" data-tex="...">` while rendering pure HTML/CSS stacked fractions/radicals/sub-sup stacks.
   - `CFig` uses `CALC_DEC` (`.` / `,`), offscreen canvas `Times New Roman` label measurement (`cfW`), and greedy anti-collision placement (`cfPlace`).
   - `calcSheetHTML` stitches Header/Sec 1..9+, `calcExt*`, Cantilever or Ribbed detail checks, optional FE3D contours (`cfFe3D`, `feViewDom`), FEM2D (`gsRaster` JPEG + P6 mesh), Bishop (`cfGsBishop`), per-1m rebar schedule (`calcRbView`), and `KẾT LUẬN CHUNG`.
2. **Word `.docx` (`calcDocxBlob`, `calcExportDocx`)**:
   - Zero-dep ZIP builder (`zCrc32`, `CompressionStream("deflate-raw")`, STORED fallback for media), parses `calcSheetHTML` DOM into OOXML A4 (`11906×16838 dxa`), 6-col borderless `.cr` grids, dynamic proportionally weighted `<w:tblHeader/>` tables, multi-line `<m:oMath>` OMML conversion (`omParse` + prime/subscript promotion into `<m:sSubSup>`), and `2.6×` SVG rasterization (`image/png` or `image/jpeg` for wrapped contour images) -> `${baseName()}_tinh-toan.docx`.
3. **Dual PDF Strategy (Mandatory Web Parity Enhancement)**:
   - Original `TuongChanL` used Electron `APP.printPdf(doc, name)` on desktop (`Xuất PDF` / `In / PDF`) and hidden-`<iframe>` `window.print()` fallback in plain browsers.
   - In the standalone Web App, we provide **BOTH**:
     1. **`In / PDF` (`#bPrint`)**: Hidden-`<iframe>` native browser Print (`@page { size: ${pw}mm ${ph}mm; margin: 0 }` for active CAD sheets 1..5; `@page { size: A4; margin: 14mm 10mm }` + `.csheet { width: 772px; zoom: 0.9 }` for Calc report after `calcEnsureAll`). Hidden in 3D mode (`mode3`).
     2. **`Xuất PDF` (`#bPdf`)**: Direct offline downloadable `.pdf` Blob (`${baseName()}_to${curSheet+1}.pdf` in 2D CAD mode, or `${baseName()}_tinh-toan.pdf` in Calc mode; hidden when `mode3`) powered by `pdf-lib` (`^1.17.1`):
        - In **2D CAD mode**: vector-renders CAD primitives (`Ents` lines, polylines, filled circles, arrows, rasterized/embedded text labels or clean light-theme SVG->high-DPI PNG/vector page) on an exact **`pw × ph` mm** PDF page (`mm * 72 / 25.4` points) matching the chosen paper (`A3..A0`) and sheet dimensions!
        - In **Calc Report mode**: awaits `calcEnsureAll`, captures report pages cleanly onto multi-page **A4 (`595.28 × 841.89 pt`)** PDF pages (via high-res HTML/SVG canvas pagination cleanly split at logical block boundaries without mid-line text slicing) and downloads immediately via `downloadFile(..., 'application/pdf')` with `"ok"` toast feedback.

---

### (g) UI/UX Architecture (`styles.css`, `shell.html`, `beforeunload`, Toasts)

1. **Exact Visual Fidelity (`src/styles/app.css`)**:
   - Port lines `1..179` of `E:\3. data\rea\analysis\modules\styles.css` verbatim (CSS custom properties `--bg: #eef1f4`, `--acc: #0e6ba8`, `--ok: #1b7f4b`, `--warn: #b25a00`, `aside { width: 372px }`, `@media (max-width:900px)`, `#stage`, `#v3d`, `#calcv`, `.csheet`, `#toast`).
   - Omit lines `180..200` completely.
2. **Header, Navigation & Contextual Action Visibility**:
   - Header (`<header>`): `.brand` (`"L"`, `"Tường chắn chữ L"`, `"Bố trí chung & cốt thép · bản vẽ 2D + mô hình 3D · LEDAT"`), buttons `#bOpen`, `#bSave`, `#bDxf`, `#bPng`, `#bDxfAll`, `#bSvg`, `#bPrint`, `#bPdf`, `#bDocx`, `#bCsv`. (Custom web app branding `LEDAT` also used in OOXML `docProps/app.xml` `<Application>Tường chắn chữ L - LEDAT</Application>`.)
   - Visibility matrix matching `applyMode()` (`26_app_ui_export.js#L808-832`):
     - **2D CAD (`mode2d`)**: `#bDxf`, `#bDxfAll`, `#bSvg`, `#bPrint`, `#bPdf`, `#bCsv`, `#sinfo`, `#bFit`, `.tip` shown; `#bPng`, `#bDocx` hidden.
     - **3D (`mode3`)**: `#bPng`, `#bDxfAll`, `#bCsv` shown; `#bDxf`, `#bSvg`, `#bPrint`, `#bPdf`, `#bDocx`, `#sinfo`, `#bFit`, `.tip` hidden.
     - **Calc (`modeC`)**: `#bPrint`, `#bPdf`, `#bDocx` shown; `#bDxf`, `#bDxfAll`, `#bSvg`, `#bCsv`, `#bPng`, `#sinfo`, `#bFit`, `.tip` hidden.
   - Left Sidebar: 3-col `#sum` metrics, `#warn` list, `<details>` accordion `#panel` (switching dynamically between 2D/3D Parameter Accordions Sec `0..6` and Calc Accordions Sec `0..11`).
   - Right Viewport `<nav>`: 5 sheet buttons (`1. Chi tiết tường chắn` .. `5. Bảng thống kê khối lượng`), `#tab3d` (green), `#tabCalc` (amber + `#calcBadge`).
3. **Web App Safety & Guardrails**:
   - **Unsaved Changes Guard (`beforeunload`)**: Remove the Electron-only `if (APP)` guard around `markClean()`; baseline snapshot `_snap = snapP()` is captured on initial mount, `openProject()`, and `saveProject()`. Register `window.addEventListener('beforeunload', e => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } })`.
   - **Status Toasts (`#toast`)**: Preserve `.ok`, `.err`, `.wait` variants and auto-dismiss timing (`6000 ms`, `12000 ms` on `"err"`).

---

## 3. Acceptance & Parity Verification Criteria

1. `npm run typecheck` (`tsc --noEmit`) passes with exit code `0`.
2. Automated Vitest suite verifies:
   - `.tcl.json` roundtrip across all 4 templates (`B, A, C, D`), `KE_TAB` (27), `D_TAB` (6), `CANTI_DIM` (4..13 m), `mergeProject` legacy anchor & `(kb,kf)` migration, `96`-key `calcDefaults`.
   - Geometry, rebar counts/lengths, concrete/formwork/blinding/steel quantities, and warnings against observed formulas.
   - `CALC`, `WATER`, `SLOPE`, `calcRibRun`, `FE3D`, `CFE`, `FEM2D`, `calcSuggest*`/`calcApplyFixes`, and `#calcBadge` numerical parity.
   - 5-sheet CAD generation, `toSVG` (dark & light), R12 `toDXF` (`AC1009`, `\U+XXXX`, `*D*` blocks, `bulge = 1` circles), and BOM `CSV`.
   - `model3D` mesh & tube generation (`m3Concrete`, `M3Tubes` chunking/mitering).
   - `texToHtml`, `calcSheetHTML`, `calcDocxBlob` valid ZIP/OOXML/OMML signature (`PK\x03\x04` + `[Content_Types].xml`), and downloadable `.pdf` (`%PDF-`) generation.
   - Clean UI mode switches, parameter edits updating CAD/3D/Calc badge, and `beforeunload` dirty guard.
3. Static grep audit confirms **zero** occurrences of licensing, trial, machine-ID, or activation artifacts in `E:\3. data\rea\TuongChanL-Web\`.
