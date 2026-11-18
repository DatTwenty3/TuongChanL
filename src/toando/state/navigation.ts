import { TREE_ICONS } from '../assets/iconRegistry';
import type { DesignKindType } from '../types/project';

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
  | 'sua-vat-lieu';

export interface MainTabMeta {
  key: MainTabKey;
  label: string;
  icon: string;
  rehabOnly?: boolean;
}

export const MAIN_TABS: MainTabMeta[] = [
  { key: 'thong-tin', label: 'Thông tin dự án', icon: TREE_ICONS.docInfo },
  { key: 'quy-mo', label: 'Quy mô thiết kế', icon: TREE_ICONS.docInfo },
  { key: 'luu-luong', label: 'Lưu lượng xe và quy đổi', icon: TREE_ICONS.trafficCal },
  { key: 'dat-nen', label: 'Đất nền', icon: TREE_ICONS.pavementLayers },
  {
    key: 'ao-duong-cu',
    label: 'Áo đường cũ (Chương 10)',
    icon: TREE_ICONS.pavementLayers,
    rehabOnly: true,
  },
  { key: 'thong-so', label: 'Thông số thiết kế áo đường', icon: TREE_ICONS.curveChart },
  { key: 'ket-cau', label: 'Kết cấu áo đường', icon: TREE_ICONS.gridAdd },
  { key: 'vong', label: 'Độ võng đàn hồi', icon: TREE_ICONS.curveChart },
  { key: 'truot', label: 'Cắt trượt', icon: TREE_ICONS.curveChart },
  { key: 'keo-uon', label: 'Kéo uốn', icon: TREE_ICONS.curveChart },
  { key: 'td-31', label: 'Toán đồ Hình 2', icon: TREE_ICONS.nomogramChart },
  { key: 'td-32', label: 'Toán đồ Hình 4', icon: TREE_ICONS.nomogramChart },
  { key: 'td-33', label: 'Toán đồ Hình 5', icon: TREE_ICONS.nomogramChart },
  { key: 'td-34', label: 'Toán đồ Hình 6', icon: TREE_ICONS.nomogramChart },
  { key: 'td-35', label: 'Toán đồ Hình 7', icon: TREE_ICONS.nomogramChart },
  { key: 'td-36', label: 'Toán đồ Hình 8', icon: TREE_ICONS.nomogramChart },
  { key: 'sua-vat-lieu', label: 'Sửa database vật liệu mẫu (File VatLieu.dat)', icon: TREE_ICONS.gridAdd },
];

export function getVisibleMainTabs(loaiTK: DesignKindType): MainTabMeta[] {
  return MAIN_TABS.filter((t) => !t.rehabOnly || loaiTK === 'CAI_TAO');
}
