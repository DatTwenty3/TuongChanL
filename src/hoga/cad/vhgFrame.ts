/** Khung bản vẽ theo bản mẫu VHGpro: một hình chữ nhật (lớp VHG-140), lề trái 20 mm, các lề khác 5 mm; không có khung tên. */
import type { Builder } from './ents';
import { A3 } from './sheets';

export const FRAME = { l: 20, r: 5, t: 5, b: 5 };

export function vhgFrame(b: Builder): void {
  const s = b.s;
  b.rect('KHUNG', FRAME.l * s, FRAME.b * s, (A3.w - FRAME.r) * s, (A3.h - FRAME.t) * s);
}
