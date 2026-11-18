/**
 * Safe visual asset registry extracted from ADMv2.exe DFM resources and ToanDo.dat.
 * All paths resolve from `(import.meta.env.BASE_URL || '/')` + `assets/`.
 */

const BASE_URL = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
const assetUrl = (rel: string): string => `${BASE_URL}${rel.replace(/^\/+/, '')}`;

export const UI_ICONS = {
  appOrb: assetUrl('assets/ui/rib_MainRibbon_ApplicationButton_Glyph_Data.png'),
  programIcon: assetUrl('assets/ui/ProgramIcon_Picture_Data.png'),
  splashIcon: assetUrl('assets/ui/Image2_Picture_Data.png'),
  refTangMat: assetUrl('assets/ui/imgRef_TangMat_Picture_Data.png'),
  infoKcad: assetUrl('assets/ui/img_InfoKCAD_Picture_Data.png'),

  // Ribbon Large (32x32)
  newLarge: assetUrl('assets/ui/toolbtn_NewProject_HotGlyph_Data.png'),
  openLarge: assetUrl('assets/ui/rbbtn_OpenFile_HotGlyph_Data.png'),
  saveSubLarge: assetUrl('assets/ui/ribbtn_SaveSub_Glyph_Data.png'),
  saveLarge: assetUrl('assets/ui/ribbtn_Save_LargeGlyph_Data.png'),
  saveAsLarge: assetUrl('assets/ui/ribbtn_SaveAs_LargeGlyph_Data.png'),
  closeLarge: assetUrl('assets/ui/ribbtn_Close_LargeGlyph_Data.png'),
  projectInfoLarge: assetUrl('assets/ui/ribbtn_ProjectInfo_HotGlyph_Data.png'),
  quymoLarge: assetUrl('assets/ui/ribbtn_QuyMoTK_HotGlyph_Data.png'),
  xeLarge: assetUrl('assets/ui/ribbtn_ThanhPhanXe_HotGlyph_Data.png'),
  datNenLarge: assetUrl('assets/ui/ribbtn_DatNen_HotGlyph_Data.png'),
  kcadLarge: assetUrl('assets/ui/ribbtn_KCAD_HotGlyph_Data.png'),
  themPaLarge: assetUrl('assets/ui/ribbtn_ThemPA_HotGlyph_Data.png'),
  runLarge: assetUrl('assets/ui/ribbtn_Run_HotGlyph_Data.png'),
  exportExcelLarge: assetUrl('assets/ui/ribbtn_ExportToExcel_HotGlyph_Data.png'),
  td31Large: assetUrl('assets/ui/ribbtn_TD31_HotGlyph_Data.png'),
  td32Large: assetUrl('assets/ui/ribbtn_TD32_HotGlyph_Data.png'),
  td33Large: assetUrl('assets/ui/ribbtn_TD33_HotGlyph_Data.png'),
  td34Large: assetUrl('assets/ui/ribbtn_TD34_HotGlyph_Data.png'),
  td35Large: assetUrl('assets/ui/ribbtn_TD35_HotGlyph_Data.png'),
  td36Large: assetUrl('assets/ui/ribbtn_TD36_HotGlyph_Data.png'),
  loadVlLarge: assetUrl('assets/ui/ribbtn_SuaDataVL_HotGlyph_Data.png'),
  saveVlLarge: assetUrl('assets/ui/ribbtn_SaveDataVL_HotGlyph_Data.png'),
  aboutLarge: assetUrl('assets/ui/ribbtn_About_HotGlyph_Data.png'),
  tieuChuanLarge: assetUrl('assets/ui/ribbtn_TieuChuan_LargeGlyph_Data.png'),

  // Small (16x16)
  newSmall: assetUrl('assets/ui/ribbtn_New_Glyph_Data.png'),
  openSmall: assetUrl('assets/ui/rbbtn_OpenFile_Glyph_Data.png'),
  saveSmall: assetUrl('assets/ui/ribbtn_Save_Glyph_Data.png'),
  saveAsSmall: assetUrl('assets/ui/ribbtn_SaveAs_Glyph_Data.png'),
  closeSmall: assetUrl('assets/ui/ribbtn_Close_Glyph_Data.png'),
  exitSmall: assetUrl('assets/ui/ribbtn_Exit_Glyph_Data.png'),
  xoaPaSmall: assetUrl('assets/ui/ribbtn_XoaPA_Glyph_Data.png'),
  suaPaSmall: assetUrl('assets/ui/ribbtn_SuaPA_Glyph_Data.png'),
  resetXeSmall: assetUrl('assets/ui/btn_ResetXe_Glyph_Data.png'),
  chonKcadSmall: assetUrl('assets/ui/btn_ChonKCAD_Glyph_Data.png'),
  thamKhaoSmall: assetUrl('assets/ui/btn_ThamKhaoTangMat_Glyph_Data.png'),
  xoaLopSmall: assetUrl('assets/ui/btn_XoaLop_Glyph_Data.png'),
  luuKcadSmall: assetUrl('assets/ui/btn_LuuKCAD_Glyph_Data.png'),
  resetSmall: assetUrl('assets/ui/btn_Reset_Glyph_Data.png'),
  okSmall: assetUrl('assets/ui/OKButton_Glyph_Data.png'),
  okRefSmall: assetUrl('assets/ui/sBitBtn1_Glyph_Data.png'),
} as const;

export const TREE_ICONS = {
  folderOpen: assetUrl('assets/ui/tree/folder_open.png'),
  checkGreen: assetUrl('assets/ui/tree/check_green.png'),
  crossRed: assetUrl('assets/ui/tree/cross_red.png'),
  folderClosed: assetUrl('assets/ui/tree/folder_closed.png'),
  folderAlt: assetUrl('assets/ui/tree/folder_alt.png'),
  arrowSub: assetUrl('assets/ui/tree/arrow_sub.png'),
  trafficCal: assetUrl('assets/ui/tree/traffic_cal.png'),
  docInfo: assetUrl('assets/ui/tree/doc_info.png'),
  nomogramChart: assetUrl('assets/ui/tree/nomogram_chart.png'),
  gridAdd: assetUrl('assets/ui/tree/grid_add.png'),
  curveChart: assetUrl('assets/ui/tree/curve_chart.png'),
  pavementLayers: assetUrl('assets/ui/tree/pavement_layers.png'),
} as const;

export const TOANDO_IMAGES: Record<'3-1' | '3-2' | '3-3' | '3-4' | '3-5' | '3-6', string> = {
  '3-1': assetUrl('toando/Toan_do_3-1.png'),
  '3-2': assetUrl('toando/Toan_do_3-2.png'),
  '3-3': assetUrl('toando/Toan_do_3-3.png'),
  '3-4': assetUrl('toando/Toan_do_3-4.png'),
  '3-5': assetUrl('toando/Toan_do_3-5.png'),
  '3-6': assetUrl('toando/Toan_do_3-6.png'),
};

export const EQUATION_ICONS = {
  check: assetUrl('assets/equations/img_Check_Picture_Data.png'),
  cross: assetUrl('assets/equations/img_Cross_Picture_Data.png'),
} as const;
