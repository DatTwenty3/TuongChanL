/**
 * BangTinhCauCong Web App — Standard Reference Lookup Modal (`#lkBg`)
 *
 * Renders the exact TCVN standard lookup dialog matching
 * `analysis-cau-cong/modules/19_lookup_caption_mode_guard.js:23-29`:
 * - `<div id="lkBg" hidden class="noprint">`
 * - `<div id="lkBox" role="dialog" aria-modal="true" aria-labelledby="lkTt">`
 * - `<div id="lkHd"><span id="lkTt"></span><button type="button" id="lkX">Đóng</button></div>`
 * - `<div id="lkBd"></div>`
 *
 * Automatically bound to all 20 TCVN 11823 / 9845 / 4054 / 10380 lookup tables
 * and interactive SVG charts (Cd and Kef) via `src/engine/verification/lookupTables.ts`.
 *
 * Clean-room standalone implementation with zero external CDN URLs.
 */

import React, { useCallback, useEffect } from 'react';
import {
  getLookupEntry,
  initLookupBindings,
} from '../engine/verification/lookupTables.ts';

export interface LookupModalProps {
  onClose?: () => void;
}

export function closeLookupModal(doc: Document = document): void {
  const bg = doc.getElementById('lkBg');
  if (bg) bg.hidden = true;
}

export function openLookupModal(
  key: string,
  target: HTMLInputElement | HTMLSelectElement | null = null,
  doc: Document = document,
): void {
  const entry = getLookupEntry(key);
  if (!entry) return;
  const bg = doc.getElementById('lkBg');
  const tt = doc.getElementById('lkTt');
  const bd = doc.getElementById('lkBd');
  const btnX = doc.getElementById('lkX') as HTMLButtonElement | null;
  if (!bg || !tt || !bd) return;
  tt.textContent = entry.t;
  bd.innerHTML = entry.f();
  bg.hidden = false;
  if (btnX && typeof btnX.focus === 'function') btnX.focus();
}

export function LookupModal({ onClose }: LookupModalProps) {
  const handleClose = useCallback(() => {
    closeLookupModal();
    if (onClose) onClose();
  }, [onClose]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        handleClose();
      }
    },
    [handleClose],
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    initLookupBindings();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const bg = document.getElementById('lkBg');
        if (bg && !bg.hidden) {
          handleClose();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [handleClose]);

  return (
    <div
      id="lkBg"
      hidden
      className="noprint"
      onClick={handleBackdropClick}
      data-testid="lookup-modal-backdrop"
    >
      <div id="lkBox" role="dialog" aria-modal="true" aria-labelledby="lkTt">
        <div id="lkHd">
          <span id="lkTt">Tra cứu tiêu chuẩn</span>
          <button type="button" id="lkX" onClick={handleClose}>
            Đóng
          </button>
        </div>
        <div id="lkBd" />
      </div>
    </div>
  );
}
