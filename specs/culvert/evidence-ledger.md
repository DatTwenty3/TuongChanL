# BangTinhCauCong Web App — REA Evidence & Provenance Ledger

## 1. Boundary & Clean-Room Policy

- **Zero Licensing Policy**: Four non-engineering ASAR entries (`license.js`, `app/activate.html`, `main.js`, `preload.js`) were strictly excluded from extraction and never inspected. Automated AST and regex verification of `analysis-cau-cong/extracted/app/index.html` (`3,599,487` B, `20,210` lines) confirmed **0** licensing, activation, trial timer, `.lic`, hardware/machine ID, or IPC blocks inside any extracted HTML, CSS, or JS module. **Zero** licensing artifacts may exist anywhere inside `E:\3. data\rea\BangTinhCauCong-Web\`.
- **Verification Discipline**: Every specification, schema contract, engineering formula, lookup table, static font/DEM payload, and UI/export behavior traces directly to concrete REA Evidence IDs (`ev_*`, `ai_*`, `agm_*`, `aex_*`, `occ_*`, `art_*`), verified SHA-256 digests, and sliced clean-room files under [`E:\3. data\rea\analysis-cau-cong\`](file:///E:/3.%20data/rea/analysis-cau-cong/phase1-inventory.md).

---

## 2. Primary REA Evidence Chain (`analysis-cau-cong/`)

| Pipeline Step | Operation | REA Evidence / Manifest ID | Verified SHA-256 | Evidence File & Scope |
|---|---|---|---|---|
| Desktop App Inspection | `inspect-desktop-application` (`E:\3. data\rea\Bang tinh ket cau cau cong`) | `ev_77d3ae3619671e29a474aec9ba2ee987e03ce956bee4014a053410ebf8dfb287`<br>Candidate: `dsc_2fc3b93e2f9ae41d4d9f29c7cf620c0c7e69c82681900cc0fee0bb8dfdd34397` | Directory snapshot:<br>`e973f4e6ae8f071807fb257f77fccee3977760e2fe323e41d4d32a350d16d3bb` | [`desktop.evidence.json`](file:///E:/3.%20data/rea/analysis-cau-cong/desktop.evidence.json) (`81` entries examined; `11` probed; PE64 Electron `213,976,576` B; `resources/app.asar` identified) |
| ASAR Artifact Inventory | `inspect-artifact` (`resources\app.asar`) | Parent: `ev_336d4b8bc1add2acdb0a1259d96adf3a22a7714908bdb088ff48c7803b1d7c65`<br>Inspection: `ai_bb65bc18a560395231274985d1c993fddf8c754a6360143e9e8a63094763ac99`<br>Inventory substep: `ev_e96c869cdc71775733b8f6bda08e9610e0e4db2e5ab695afc84fecb21d83df61` | `app.asar` (`66,774,022` B):<br>`362d86d325beb66f1d84284a53ce5011ba63b60f45fe7e0304e744c4790c7556`<br>Manifest: `agm_e5e3b869867b106b850163c2bf4ad57be5ba19b64d85678e807b120ae5add0d1`<br>Graph: `cb94dbc3a01cf6e13ec7527415e0eaf99c769d87948749cf23fb651588752ad4` | [`asar.evidence.json`](file:///E:/3.%20data/rea/analysis-cau-cong/asar.evidence.json) (`138` total occurrences, `137` edges; `134` safe occurrences inventoried; `4` excluded non-engineering files) |
| Selective Extraction | `extract-artifact` (`resources\app.asar`, 10 safe `--occurrence-id`s) | `ev_054a48cd91c835c8d2f86894e900e15ca3f967c6cb3c41fffc15b7dfa0a0ef81`<br>Extraction ID: `aex_0339f4b1ba49ba81d6b97d30ad8bca98e03440597990c4c14c3378a67dcafeac` | Aggregate `files_sha256`:<br>`eec02acd42930b4b4cf21a3d32352c02d4b80a9e765326de0d5f775be1efb155` | [`extract.evidence.json`](file:///E:/3.%20data/rea/analysis-cau-cong/extract.evidence.json) (`containment_verified: true`, zero integrity contradictions; exclusively `10` safe files in `analysis-cau-cong/extracted/`) |

> *(Provenance Reconciliation Note: Early note in `BangTinhCauCong-Web/AGENTS.md` §3 listed `ev_d41b1d02...` for `inspect-artifact`; direct verification against [`asar.evidence.json`](file:///E:/3.%20data/rea/analysis-cau-cong/asar.evidence.json) confirms `ev_336d4b8bc1add2acdb0a1259d96adf3a22a7714908bdb088ff48c7803b1d7c65` & substep `ev_e96c869cdc71775733b8f6bda08e9610e0e4db2e5ab695afc84fecb21d83df61` with manifest `agm_e5e3b869867b106b850163c2bf4ad57be5ba19b64d85678e807b120ae5add0d1`.)*

---

## 3. Extracted Non-Licensing ASAR Files & Offline Static Asset Parity

### 3.1 Top-Level Safe Extracted Files (`analysis-cau-cong/extracted/`, 10 Occurrences)

| Logical Path | Occurrence ID (`occ_*`) | Artifact ID (`art_*`) | Bytes | SHA-256 | Role / Target Disposition |
|---|---|---|---:|---|---|
| `package.json` | `occ_48bf8172394d67903dd022ce3de0eba68b998cb9de053b9363ea900de496d063` | `art_2c873e6df5f25d49b7e5255bd58390039a5cd66bf1c18efbf3a83ea8a75012b0` | 275 | `ff9c2b97c8437328f09cf7be7f3e7272938e1f59288cc0a07e0840983ef70271` | Reference manifest (`bang-tinh-cau-cong` v1.0.0) |
| `app/index.html` | `occ_e32f9eb9dbed7e08f111d5aa43d714f0c72622a8412ace80c70c0ef531636efb` | `art_9c62ff98133065ec0f67929d7795bdfb0ab7722ab8edae53da07b20ce1681817` | 3,599,487 | `3a1af4ce191de0d30040bfd0c743f77fecb5b31a7cc282d312e8a49be4a81cc0` | Losslessly sliced into `styles.css`, `shell.html`, `01..20` |
| `app/fonts/Arimo_400Regular.ttf` | `occ_429ce51f4d9fedcba5c1a24b193b90e9caff370172d252e2bb6fc529d807a920` | `art_fb7273d484f6ab2ff72a2905126d829bc6dfd2a36dd5a4eb0c930c90c9bac67c` | 318,320 | `88cc899855d30f9c779b73c3319d0e077b098f927187aafce11ca029add707a6` | Copied verbatim to `public/fonts/Arimo_400Regular.ttf` (`VERIFIED`) |
| `app/fonts/Tinos_400Regular.ttf` | `occ_be6f99c256688358ac961b44611bae95ea9d64a8acc7c2061ccc27f45c7439b7` | `art_47480c73fa890c23d79a23ee273ceb46200655df2329d6abf5c0b6a295316e1b` | 508,752 | `924ef269e73da94c1803ff68877f5d998dd16605c5ffad82ee181034f8a1fffe` | Copied verbatim to `public/fonts/Tinos_400Regular.ttf` (`VERIFIED`) |
| `app/fonts/Tinos_400Regular_Italic.ttf` | `occ_4e6c5ed623a491a6647969f1f74c200af024018ca08d736f9899e1196fe1d64e` | `art_d6ae7dd86cfe4b194fd8209e9d8f29c09c77e58d8240f91696f1b1399d6e2fe` | 549,824 | `4a52de5bcf70e37bd71949f8a85302b75795a1943aedffbbee4f2db7744e1c81` | Copied verbatim to `public/fonts/Tinos_400Regular_Italic.ttf` (`VERIFIED`) |
| `app/fonts/Tinos_700Bold.ttf` | `occ_2e2aaa28cdc5eaf94f16b0220469e623cc057671f0584c09243a865a54f595fe` | `art_af873f448411f36368861cadeea948e0b43f4d9490030c3ee683d8d7a3091fed` | 583,484 | `576a19b5dc026cafe6ae8fde4c849588dae6475cf5d912cebdf2827388c43ad9` | Copied verbatim to `public/fonts/Tinos_700Bold.ttf` (`VERIFIED`) |
| `app/fonts/Tinos_700Bold_Italic.ttf` | `occ_ce3704864ffbc742a70ec7aec8ea2b5e0739d5501f2e8dfb1903a5aa8a5e0f6e` | `art_02dfe81da26c1fb6433753a545d436206898ec9028d438e26fc2ff04c19053b9` | 563,688 | `10c90ef7896d758923c06a1485d7824cdb457466da0bf7d42f81c5228931281b` | Copied verbatim to `public/fonts/Tinos_700Bold_Italic.ttf` (`VERIFIED`) |
| `app/dem/cop1.txt` | `occ_a3daff8e43e901ec91eccd603c509369fe5a7e13bd923c0282bfdd62c5d84bee` | `art_ae6b11d8fec1247604c5050f86ec358e4143b1d0e2544e51c3b00c3a77e5d69a` | 10,155,520 | `c0a12040f16d7d93283a8cf2ea24ebe9f11077e0a2c30a77ec7cfd725bdbff39` | Copied verbatim to `public/dem/cop1.txt` (`VERIFIED`) |
| `app/dem/cop2.txt` | `occ_105bd660bd45352d6f3d0d195d9ea4f8d54c23badef16542ed0234123f637d22` | `art_af805c6f0435610501333163724566360d35f8329a8a0e034bee8856ed5d4d65` | 10,155,524 | `d73ca7e955394674bd2d79b0c6795bcfe510f8051798bd4fc8938962aef9e4b3` | Copied verbatim to `public/dem/cop2.txt` (`VERIFIED`) |
| `app/dem/thanhhoa.txt` | `occ_69d1015ab10221616efa4041120dd41fd7ef68d52185831ac4dec7086743a8cf` | `art_33090e5b010abd1b3d9a524c7c93f539529c2465481ab74db7db58ed15b92caf` | 11,744,716 | `5a82c94d9917106455b01f07b323680b73e285bcc329321d9fdd76a58932e80e` | Copied verbatim to `public/dem/thanhhoa.txt` (`VERIFIED`) |

### 3.2 Bundled Reference `cdn/` Libraries Observed in `app.asar` (`asar.evidence.json`)

| Library | ASAR Primary File & Version | Primary Occurrence ID & SHA-256 | Web App Replacement |
|---|---|---|---|
| `exceljs` | `cdn/exceljs@4.4.0/dist/exceljs.min.js` (`947,702` B) | `occ_ae028e7e...` / `7e49da68588e250dbb8bba190d2caa8ab3787cc0284bda1d8b2f805c4df742c9` | npm `exceljs@4.4.0` |
| `plotly.js-dist-min` | `cdn/plotly.js-dist-min@2.35.2/plotly.min.js` (`4,558,696` B) | `occ_1034e5ac...` / `6d21266ce1bd7d9e5ab4e115989c70c20de0382fd973a8f26ab58619eba4d603` | npm `plotly.js-dist-min@^2.35.2` |
| `mathjax` | `cdn/mathjax@3.2.2/es5/tex-svg.js` (`2,108,580` B; `73` files) | `occ_3ff3c202...` / `d4295dc33744836935c1399feece5159577b34c5c8ffb9f1c6324cd82e03a882` | npm `mathjax@3.2.2` (+ `public/vendor/mathjax/` offline bundle) |
| `geotiff` | `cdn/geotiff@2.1.3/dist-browser/geotiff.js` (`317,520` B) | `occ_072ff5b7...` / `cb5c9731bfee1f8bff1728e54e4436ada81ea3258b178a3d6603c61b58d99e6c` | npm `geotiff@2.1.3` |
| `proj4` | `cdn/proj4@2.11.0/dist/proj4.js` (`91,058` B) | `occ_fcc38044...` / `4975fbf411fac1842c5b91d362d323d3f01ca0cb52385a2ea219790ffaa20a80` | npm `proj4@^2.11.0` |
| `jspdf` | `cdn/jspdf@2.5.1/dist/jspdf.umd.min.js` (`364,463` B) | `occ_a2cf1451...` / `98ccf17aa10c20bb1301762618fcc9b6ab3a4e7f26b6071d64d0b41154df3875` | npm `jspdf@^2.5.1` |
| `jszip` | `cdn/jszip@3.10.1/dist/jszip.min.js` (`97,630` B) | `occ_e8b37c7e...` / `acc7e41455a80765b5fd9c7ee1b8078a6d160bbbca455aeae854de65c947d59e` | npm `jszip@^3.10.1` |
| `tesseract.js` / `core` / `@tesseract.js-data/eng` | `tesseract.min.js`, `worker.min.js`, `tesseract-core-*lstm.wasm.js`, `eng.traineddata.gz` | `occ_bc22e292...`, `occ_f61bfb52...`, `occ_d2edcb0f...` | npm `tesseract.js@5.1.1` + `@tesseract.js-data/eng@1.0.0` (+ `public/vendor/tesseract/` offline assets) |

---

## 4. Clean-Room Source Slices (`analysis-cau-cong/modules/MANIFEST.md`)

All **22** files derive losslessly from `analysis-cau-cong/extracted/app/index.html` (`3a1af4ce...`, `0` licensing lines excluded; raw `Script #9` sum = `1,808,085` bytes = `100%`):

| # | Module File | Raw B | Raw SHA-256 | Formatted B | Lines | Formatted SHA-256 |
|---|---|---:|---|---:|---:|---|
| - | `styles.css` | 20,358 | `a530e638f1b68d7c5e49721b853ce4e1c384efc8fd360721f8ee313e8c1e412b` | 24,317 | 1,331 | `6c152ff1beda53f9b8d52e37fb6a97cc4f9f32428de4cd6fdf8491775bf03d76` |
| - | `shell.html` | 1,685,909 | `1d9276ed9df56c86fadcf3196e50c239a6da05c90650f80b128950692cb46c96` | 1,685,909 | 6,739 | `1d9276ed9df56c86fadcf3196e50c239a6da05c90650f80b128950692cb46c96` |
| 01 | `01_boot_shims_and_sf.js` | 12,004 | `e4b0b1f5ad51a21d2fdd9fc7632d8f58b554108be089683d8755f91b6a6573c9` | 17,414 | 560 | `8d0ec2b0913cf9a34778cf6018bf5745f9ca0d41e36ab6e9693f2c72c0dc152f` |
| 02 | `02_core_utils_and_column_pm.js` | 9,592 | `d3fe3adac028fbcca77d6a8b04e5a410e903a8c7dd0bf7625aef3ce6d4e75ba7` | 11,990 | 300 | `b3c399f1090cbea7888dd145b45b7648a5bde141881c1176844aab507ad1a7e6` |
| 03 | `03_abutment_loads_and_rc.js` | 87,191 | `b38546cd6c6f89da8fe5df083786885136352ba87d79bf237fa183ab34bd2593` | 113,933 | 3,089 | `828ddf404c67f3de0749629faa14f04be3ee890a8398406f37e91d70f00b235e` |
| 04 | `04_girder_slab_hollow_rc.js` | 69,741 | `f9b6a554ab9d5eafc80aaf1ae5e56334ce5b4990aafca551b3a46522846a2aaf` | 102,028 | 3,220 | `cdbdf9fbfbd0940adf95d093552ae3d72b1693da1aed0b8bccef904c9ee521aa` |
| 05 | `05_girder_post_tensioned_i.js` | 163,827 | `6810d103ed552fcdbc54d17aae31371ba8b5c5faf6ed4222c61435009c5b953e` | 213,303 | 5,612 | `47421a2d4fd0eaa0e0d0fddbd94f409be3dcf241f5088eb361345b5d67ce3e7e` |
| 06 | `06_retaining_wall_gravity.js` | 126,782 | `4644685373764051e0b0a840a863ccde68bb48b589efdb5880fd807001f5434d` | 175,552 | 5,691 | `fa0fd07c08836a2893e6aa6e048c4f37ed2a52c9830045a83da04b9f1782712e` |
| 07 | `07_approach_slab_and_culvert_soil.js` | 68,148 | `483edb8d84ebe6f192bfe15711167389217d9e4d220dd1a9b2a85891aa43cbea` | 90,375 | 2,456 | `ccefc5fec976adcb6e95e38abbb2c2783ee40d7cd8cc2b42d6a7fcfa36453871` |
| 08 | `08_flexible_abutment_md.js` | 66,911 | `9f9c3b930cd1e8562c3c0d57a8865fb3374f949fba042cb6f60a53debde7316d` | 90,363 | 2,590 | `32e00d167891613f5e961798901d2e0dafc1d3cd0509a9887e921d91b7affec0` |
| 09 | `09_retaining_wall_cantilever_l.js` | 52,862 | `b6cfb251f9c1ca5fe42c01aea3f5a91147e3697f81999aceb6bca3684c732d64` | 68,032 | 1,800 | `99f1898a8af7dc0752dc5133b584fc012f96d66c36cd0be433bddb9a3de7d890` |
| 10 | `10_superstructure_ui_and_deck_joints.js` | 206,936 | `6c8d4e4f4330fd2743848cf99453d400093ea5a3768fa1327aa3217cac520b26` | 256,050 | 6,270 | `822b71515bb400d215681a66ded68a71e60df9c26802a33ccdd5b47a4579470f` |
| 11 | `11_culverts_box_and_circular.js` | 126,040 | `8cb2f4c3ac30607233a51f11c8062830bc14b15a0406487fbd838d0a32224ebc` | 166,506 | 4,380 | `26308297261f3b584c26532d589cd2c73cb04ec9ad0d2513665570e7f65de363` |
| 12 | `12_piles_geotech_mcoc_and_pm3d.js` | 117,607 | `2596202c82ff970b58c81383f99855563e76644ebcffa36658dc0ceec2ecd47f` | 151,453 | 4,080 | `ba8e363cb3d1a3f5f7884354ce5b945e0c5dd298e62fb955791e198999c42f56` |
| 13 | `13_pier_flexible_tr.js` | 168,966 | `29f020684c8c960afd6b781fecf2637e20ba66ca7d712d041bfc1a04eff6065e` | 224,092 | 6,067 | `a6683fc462ce4082746fe1ff24a443aa4a0d2d031d57da70c1adbad54ec1dc9c` |
| 14 | `14_pier_solid_dct_and_shallow_fdn_ui.js` | 101,033 | `e67aa89f20001a3d68f3d6277bc621d6b1923121cb97d6ca164bbb38b0751e58` | 142,254 | 4,501 | `dfb3fdbfa7eed3f0e4341023ec62049bcab60f8ec17d5bebfc2339a90a16b502` |
| 15 | `15_bridge_hydrology_data_and_calc.js` | 224,240 | `a01a618f5b51fe67d34e562351af7e068ecb9ce847af416afc2924e989e90fcd` | 302,087 | 8,879 | `88d9a219777e13ab37b215b8d3f7b29484f04aaafa6c7603e5ae53da17b4ae9f` |
| 16 | `16_dem_watershed_ocr_dxf_import.js` | 100,073 | `4992b81d375e1a0fab3ec8d5df029fe21e1e97fd04994c7f6558258995b8733c` | 135,459 | 4,253 | `6cd7415c760c8341f2550dd09f31ba19c5a0466fbc9d8db666eff7ea6b13b55f` |
| 17 | `17_culvert_hydrology_and_dxftools.js` | 67,479 | `6d6410c8f241389e78d928fb3bdc0e853faebed2058dd2ef1d0d70cf370d0af9` | 94,080 | 2,803 | `611504a6dbbd18f3c364dae7236cecccf97e9857756d13c66eb07a342f74ac87` |
| 18 | `18_appmode_export_xlsx_pdf.js` | 50,657 | `a33524bec40afc1aa5bae603e528f9f85fe7708d833ad65639eeba018df71e94` | 72,512 | 1,967 | `337e971680038b8b3b94e91b0b8583f88a0ffba868f0e324543d77addda1ce7e` |
| 19 | `19_lookup_caption_mode_guard.js` | 30,908 | `bc77d1b2420709e703cd8feb1a702d012225d5b7c49757396874639e768c0bf5` | 42,807 | 995 | `f05c23be138066de6f5718c70b915230b38603ee806b7eec970a3fcfe3f26027` |
| 20 | `20_verification_tests_vt.js` | 41,690 | `7d34611f8abe4a10c04107e37601d91f70f3238e4403fe79032cfab11d806a18` | 59,658 | 2,024 | `4afe965f8358dde7263a92c898d6aaa30d76bfda2d55a3a37471f649790469dd` |

---

## 5. Target Web App Subsystem Mapping & Parity Status

Status legend: `SPECIFIED` (contract defined in `specs/01..04.md` & `parity-spec.md`) -> `IMPLEMENTED` -> `VERIFIED`.

| Target Web Subsystem (`BangTinhCauCong-Web/`) | Source Module(s) (`analysis-cau-cong/modules/`) | Spec Reference | Owner Role | Target Verification Evidence | Status |
|---|---|---|---|---|---|
| `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `public/fonts/*.ttf`, `public/dem/*.txt`, `public/vendor/*` | `extracted/package.json`, `extracted/app/{fonts,dem}/*` | `parity-spec.md` §1, §5 | `coordinator-lead` | Byte + SHA-256 parity check on all 8 static assets (`100%`) + 7 offline vendor files | `VERIFIED` |
| `src/types/project.ts`, `src/types/ambient.d.ts`, `src/types/index.ts`, `tests/types.test.ts` | `01`–`20` + `shell.html` + `styles.css` | `parity-spec.md` §2–§4 | `coordinator-lead` | `npm run typecheck` (exit `0`); `npx vitest run tests/types.test.ts` (`7/7` passed) | `VERIFIED` |
| `src/engine/context.ts`, `math/rcmFrame.ts`, `math/rc.ts` | `02`, `03` (`RC`), `08` (`MD.plate`), `11` (`CH.Frame`), `12` (`pt3/capDir/compute3`) | `01` §2; `02` §3, §4; `03` §2 | `solver-engineer` | Differential `vm` unit tests + `VT` `G4`, `G7` | `SPECIFIED` |
| `src/engine/bridge/crossfall.ts`, `girderHollow.ts`, `girderI.ts`, `deckJoints.ts` | `04`, `05`, `10`, `13` (`XFmk`, `XFgir`, `SUPDIST`) | `02` §1–§2 | `solver-engineer` | Differential parity + `VT.live()` HL-93, LLDF, losses, bearing, strip, joint, link, barrier | `SPECIFIED` |
| `src/engine/bridge/abutmentHeavy.ts`, `abutmentFlex.ts`, `pierFlex.ts`, `pierSolid.ts`, `approachSlab.ts` | `03`, `07` (`QD`), `08`, `13`, `14` | `02` §1, §4–§6; `03` §5, §7.1 | `solver-engineer` | Differential parity + `VT` `G6` + `VT.live()` abutment & approach slab | `SPECIFIED` |
| `src/engine/foundations/shallowFdn.ts`, `pileGroup.ts`, `drilledShaft.ts` | `01` (`SF`), `12` (`RK`, `PILE`, `MC`, `SCT`), `14` (`SFM`, `SFD`, `sfGrid`) | `03` §3–§4 | `solver-engineer` | Differential parity + `VT` `G1`, `G5`, `G8` | `SPECIFIED` |
| `src/engine/culvertsWalls/boxCulvert.ts`, `pipeCulvert.ts`, `wallGravity.ts`, `wallCantilever.ts` | `06`, `07` (`CHN`), `09`, `11` (`CH`, `CT`) | `03` §6, §7.2–§7.4 | `solver-engineer` | Differential parity + `VT` `G1`, `G2`, `G9` + `VT.live()` TC/CH/CT | `SPECIFIED` |
| `src/engine/hydrology/*` (`stationsDb`, `bridgeHydro`, `culvertHydro`, `demWatershed`) | `15`, `16` (`HVD`, `NCW`, `HVZONE`, `HVWL`), `17` | `04` §2–§4 | `solver-engineer` | Differential parity + GeoTIFF DEM `cop`/`srtm` test + `VT` `G3` + `VT.live()` HV/Manning | `SPECIFIED` |
| `src/engine/importers/*` (`dxfParser`, `ocrPipeline`) | `16` (`DXS`, `TCV3`, `OCRK`), `17` (`TVX`) | `04` §3.3, §5 | `solver-engineer` | Unit tests on TCVN3 DXF blocks, `dxsBridge`, offline Tesseract OCR | `SPECIFIED` |
| `src/engine/verification/*` (`lookupTables`, `verificationSuite`) | `19` (`LK`), `20` (`VT`) | `01` §6.1, §7; `parity-spec.md` §4 | `solver-engineer` | All `106` fixed checks (`63` `add()` calls) + `15` live blocks + `20` `LK` tables pass | `SPECIFIED` |
| `src/graphics/*` (`svgPrimitives`, `cadDxfExport`, `plots3d`, `texMath`) | `02` (`mathAll`), `03` (`svgKit`), `04` (`dgKit`), `06` (`tcDxf`), `12` (`render3`), `16` (`HVD.dxf`, `hdDxfFig`, `hdZip`) | `01` §2.2; `03` §2.5, §6.2; `04` §4.3 | `graphics-export-engineer` | SVG/DXF R12 (`TC_U2T`, `\U+XXXX`) + ZIP CRC-32 + MathJax/Plotly tests | `SPECIFIED` |
| `src/reports/*` (`bridgeReports`, `foundationReports`, `culvertWallReports`, `hydroDemReports`) | `03`–`17` SVG/HTML builders + `05` (`GIW`) | `02`–`04`; `parity-spec.md` §1 | `graphics-export-engineer` | HTML/SVG differential checks across active bridge & standalone modes | `SPECIFIED` |
| `src/export/*` (`excelExport`, `pdfExport`, `projectIo`) | `12` (`KEEP`/`saveAll`), `16` (`TM_DB`), `18` (`buildWB`, `buildPdf`, JSON I/O) | `01` §5.3; `04` §6.2–§6.4 | `graphics-export-engineer` | Real `.xlsx` ZIP/XML, real A4 `.pdf` w/ embedded Tinos/Arimo TTFs, `.json` roundtrip | `SPECIFIED` |
| `index.html`, `src/{main.tsx,App.tsx,styles/app.css,state/appStore.ts,components/*}` | `styles.css`, `shell.html`, `01`, `12`, `16`, `18`, `19` | `01` §1–§6; `04` §6.1 | `frontend-builder` | React Testing Library UI tests + 7-mode / 46-tab DOM parity | `SPECIFIED` |
| `tests/qa/*`, `specs/qa-verification-report.md` | All `analysis-cau-cong/modules/01..20` via Node `vm` + Chromium E2E | `parity-spec.md` §1–§5 | `qa-verifier` | Node `vm` differential parity, 106 `VT` checks, E2E downloads, 0 licensing tokens | `SPECIFIED` |

---

## 6. Direct Specification Audit & Reconciliation Notes

1. **`IT_TAB` Exact Item Count**: Direct inspection of [`12_piles_geotech_mcoc_and_pm3d.js`](file:///E:/3.%20data/rea/analysis-cau-cong/modules/12_piles_geotech_mcoc_and_pm3d.js#L1558-L1591) establishes **32 tab-to-item mappings** spanning **22 distinct item keys** (`8..14`, `mtt..mvl`, `ttt..tvl`, `qd`; prose in `01-ui-shell-modes-and-state.md#L219` summarized 18).
2. **`VT` Benchmark vs Conditional Live Counts**: [`20_verification_tests_vt.js`](file:///E:/3.%20data/rea/analysis-cau-cong/modules/20_verification_tests_vt.js#L18-L1960) invokes `add()` **63 times** to populate **106 fixed checks** (`G1`–`G9`), followed by `VT.live()` containing **15** conditional active-project verification blocks (`11` core bridge/active blocks plus culvert/retaining/hydrology mode blocks).
3. **Intentionally Preserved Bar Area & Published Table Variations**: Separate bar area lookup maps in `02` (`AREA`), `11` (`CH.AREA`, `CT.AREA`), and `03` (`RC.bar`), plus published print irregularities flagged in `HVTAB.A3` and `TVC_ST`, are preserved verbatim to ensure 100% numeric agreement with original `Bang tinh ket cau cau cong`.
4. **Offline Browser Replacements**: Dynamic jsDelivr URLs (`exceljs`, `geotiff`, `proj4`, `jspdf`, `jszip`, `plotly.js-dist-min`, `mathjax`, `tesseract.js`) and desktop `window.claude` / `window.__tv4` download bridges + `location.reload()` are replaced cleanly by bundled npm packages, local static assets under `public/`, Blob `<a download>`, and reactive store rehydration with `beforeunload` dirty protection.
