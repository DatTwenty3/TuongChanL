import { TREE_ICONS } from '../assets/iconRegistry';
import type { DesignKindType, PavementKind } from '../types/project';

export type RibbonTabKey = 'HOME' | 'TOOLS' | 'HELP';

export type MainTabKey =
  | 'thong-tin'
  | 'quy-mo'
  | 'luu-luong'
  | 'dat-nen'
  | 'ao-duong-cu'
  | 'thong-so'
  | 'ket-cau'
  | 'vong'
  | 'truot'
  | 'keo-uon'
  | 'td-31'
  | 'td-32'
  | 'td-33'
  | 'td-34'
  | 'td-35'
  | 'td-36'
  | 'sua-vat-lieu'
  | 'cung-giao-thong'
  | 'cung-ket-cau'
  | 'cung-khe-noi'
  | 'cung-thoat-nuoc'
  | 'cung-kiem-toan';

export interface MainTabMeta {
  key: MainTabKey;
  label: string;
  icon: string;
  rehabOnly?: boolean;
  /** 'MEM' = chỉ mặt đường mềm (TCCS 38), 'CUNG' = chỉ mặt đường cứng (TCCS 39); vắng = dùng chung. */
  kind?: PavementKind;
}

export const MAIN_TABS: MainTabMeta[] = [
  { key: 'thong-tin', label: 'Thông tin dự án', icon: TREE_ICONS.docInfo },
  { key: 'quy-mo', label: 'Quy mô thiết kế', icon: TREE_ICONS.docInfo },
  { key: 'luu-luong', label: 'Lưu lượng xe và quy đổi', icon: TREE_ICONS.trafficCal, kind: 'MEM' },
  { key: 'dat-nen', label: 'Đất nền', icon: TREE_ICONS.pavementLayers },
  {
    key: 'ao-duong-cu',
    label: 'Áo đường cũ (Chương 10)',
    icon: TREE_ICONS.pavementLayers,
    rehabOnly: true,
    kind: 'MEM',
  },
  { key: 'thong-so', label: 'Thông số thiết kế áo đường', icon: TREE_ICONS.curveChart, kind: 'MEM' },
  { key: 'ket-cau', label: 'Kết cấu áo đường', icon: TREE_ICONS.gridAdd, kind: 'MEM' },
  { key: 'vong', label: 'Độ võng đàn hồi', icon: TREE_ICONS.curveChart, kind: 'MEM' },
  { key: 'truot', label: 'Cắt trượt', icon: TREE_ICONS.curveChart, kind: 'MEM' },
  { key: 'keo-uon', label: 'Kéo uốn', icon: TREE_ICONS.curveChart, kind: 'MEM' },
  { key: 'td-31', label: 'Toán đồ Hình 2', icon: TREE_ICONS.nomogramChart, kind: 'MEM' },
  { key: 'td-32', label: 'Toán đồ Hình 4', icon: TREE_ICONS.nomogramChart, kind: 'MEM' },
  { key: 'td-33', label: 'Toán đồ Hình 5', icon: TREE_ICONS.nomogramChart, kind: 'MEM' },
  { key: 'td-34', label: 'Toán đồ Hình 6', icon: TREE_ICONS.nomogramChart, kind: 'MEM' },
  { key: 'td-35', label: 'Toán đồ Hình 7', icon: TREE_ICONS.nomogramChart, kind: 'MEM' },
  { key: 'td-36', label: 'Toán đồ Hình 8', icon: TREE_ICONS.nomogramChart, kind: 'MEM' },
  { key: 'sua-vat-lieu', label: 'Sửa database vật liệu mẫu (File VatLieu.dat)', icon: TREE_ICONS.gridAdd },
  { key: 'cung-giao-thong', label: 'Tải trọng trục và số trục tích lũy Ne', icon: TREE_ICONS.trafficCal, kind: 'CUNG' },
  { key: 'cung-ket-cau', label: 'Kết cấu tấm BTXM (TCCS 39:2022)', icon: TREE_ICONS.gridAdd, kind: 'CUNG' },
  { key: 'cung-khe-noi', label: 'Khe nối (Điều 6)', icon: TREE_ICONS.pavementLayers, kind: 'CUNG' },
  { key: 'cung-thoat-nuoc', label: 'Thoát nước kết cấu áo đường (Điều 7)', icon: TREE_ICONS.pavementLayers, kind: 'CUNG' },
  { key: 'cung-kiem-toan', label: 'Kiểm toán tấm BTXM (Điều 8)', icon: TREE_ICONS.curveChart, kind: 'CUNG' },
];

export function getVisibleMainTabs(
  loaiTK: DesignKindType,
  loaiMat: PavementKind = 'MEM',
): MainTabMeta[] {
  return MAIN_TABS.filter((t) => {
    if (t.kind && t.kind !== loaiMat) return false;
    return !t.rehabOnly || loaiTK === 'CAI_TAO';
  });
}
