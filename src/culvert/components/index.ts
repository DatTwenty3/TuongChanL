/**
 * BangTinhCauCong Web App — Components Barrel
 *
 * Clean-room barrel exporting all UI components:
 * - Toolbar: Top action bar (modes, export scope, Excel/PDF/JSON actions, status)
 * - ProjectHeader: Project metadata inputs (#pj1..#pj6)
 * - TabStrip: 46-tab navigation strip with dynamic visibility and TCVN labels
 * - OverviewPane: Tab 7 dashboard, summary cards, TOC (#tqToc), item checklist (#tqIt)
 * - VerificationPane: Tab 60 software verification suite (#vt_run, #vt_sum, #vt_tb)
 * - LookupModal: Accessible offline TCVN standard reference lookup dialog (#lkBg)
 * - LegacyShellBridge: Mounts and wires 45 engineering calculation panes
 *
 * Clean-room standalone implementation with zero external CDN URLs.
 */

export * from './Toolbar.tsx';
export * from './ProjectHeader.tsx';
export * from './TabStrip.tsx';
export * from './OverviewPane.tsx';
export * from './VerificationPane.tsx';
export * from './LookupModal.tsx';
export * from './LegacyShellBridge.tsx';
