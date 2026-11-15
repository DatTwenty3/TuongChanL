import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Dữ liệu trích từ các tệp Excel mẫu của VHGpro 4 (đầu vào + giá trị đã tính) dùng làm chuẩn đối chiếu.
 * Đây là dữ liệu của bên thứ ba nên KHÔNG nằm trong repo công khai (xem fixtures/README.md);
 * thiếu tệp thì các phép đối chiếu Excel được bỏ qua, phần còn lại của bộ test vẫn chạy.
 */
function load(): any {
  try {
    return JSON.parse(readFileSync(fileURLToPath(new URL('../fixtures/vhg-templates.json', import.meta.url)), 'utf-8'));
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const fx: any = load();
export const hasFixture = fx !== null;
