/**
 * Preset dành cho giao diện (mở rộng so với ứng dụng gốc).
 * `presetKe` giữ nguyên để đối chiếu bản gốc; các khác biệt cố ý nằm ở đây:
 *  - Mẫu 3: MẶC ĐỊNH KHÔNG có chân khay ở mọi chiều cao (người dùng tự bật).
 *    Trong thư viện bản vẽ gốc, một số cao độ được vẽ sẵn có chân khay (K1, K2, K102…).
 *  - Mẫu 3: kích thước đứng ghi chiều cao thân H đã chọn (`dimStem`).
 */

import { presetKe } from './presets.ts';
import type { EngineProject } from './types.ts';

export function appPresetKe(keep: Partial<EngineProject> = {}, idx = 0): EngineProject {
  const p = presetKe(keep, idx);
  p.key.on = false;
  p.dimStem = true;
  return p;
}
