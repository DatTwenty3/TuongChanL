/**
 * BangTinhCauCong Web App — Legacy Shell Bridge Component
 *
 * Mounts all extracted calculation panes from `src/assets/panes.json`:
 * - Manages active/inactive pane visibility via DOM `hidden` and `.pane.on`
 * - Strips any extraneous `.tool`, `.tabs`, or duplicate `.proj` headers
 * - Dispatches all 16 `data-ck-act` actions (hydrology, DEM, OCR, DXF, foundation steps)
 * - Wires all engine DOM lifecycle observers (orchestrator, lookup, verification, deck joints, MD, DEM, hydro)
 * - Reflows math formulas via `mathAll()` on tab switch
 *
 * Clean-room standalone implementation with zero external CDN URLs.
 */

import React, { useEffect, useRef } from 'react';
import type { AppMode, TabId } from '../types/project.ts';
import { $ } from '../engine/context.ts';
import { initOrchestratorDom, run as orchestratorRun, showTab } from '../engine/orchestrator.ts';
import { initVerificationDom } from '../engine/verification/verificationSuite.ts';
import {
  formatCaptionsAndTables,
  initLookupBindings,
} from '../engine/verification/lookupTables.ts';
import { bindDeckJointEvents } from '../engine/bridge/deckJoints.ts';
import { bindMdDomEvents } from '../engine/bridge/abutmentFlex.ts';
import {
  hvAllFit,
  hvHcFit,
  hvHcSlide,
  hvPierEx,
  hvPreset,
  hvSecShift,
  hvStRe,
  hvStSel,
  hvStWhyFill,
  initBridgeHydroDom,
} from '../engine/hydrology/bridgeHydro.ts';
import { initCulvertHydroDom } from '../engine/hydrology/culvertHydro.ts';
import { initStationsDbDom } from '../engine/hydrology/stationsDb.ts';
import {
  hdCopy,
  hdDxf,
  hdFill,
  hdLoadFiles,
  hdRun,
  initDemWatershedDom,
} from '../engine/hydrology/demWatershed.ts';
import { initDxfDom } from '../engine/importers/dxfParser.ts';
import { initOcrDom } from '../engine/importers/ocrPipeline.ts';
import { mcocStep } from '../engine/foundations/pileGroup.ts';
import { sctStep } from '../engine/foundations/drilledShaft.ts';
import { sfdStep } from '../engine/foundations/shallowFdn.ts';
import { mathAll } from '../graphics/texMath.ts';
import panesData from '../assets/panes.json';

export interface LegacyShellBridgeProps {
  activeTab: TabId;
  mode: AppMode;
  includeTab7?: boolean;
  onTabChange?: (tabId: TabId) => void;
  onStateChange?: () => void;
}

export function LegacyShellBridge({
  activeTab,
  mode,
  includeTab7 = false,
  onTabChange,
  onStateChange,
}: LegacyShellBridgeProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter panes to mount: exclude tab 7 if handled by OverviewPane
  const panesToMount = includeTab7
    ? panesData
    : panesData.filter((p) => p.tabId !== 7);

  // Initial engine & DOM event wiring
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const cleanupOrch = initOrchestratorDom();
    const cleanupVer = initVerificationDom();
    initLookupBindings();
    bindDeckJointEvents(() => orchestratorRun());
    const cleanupMd = bindMdDomEvents();
    const cleanupDem = initDemWatershedDom();
    const cleanupBridgeHydro = initBridgeHydroDom();
    const cleanupCulvertHydro = initCulvertHydroDom();
    const cleanupStations = initStationsDbDom();
    initDxfDom();
    const cleanupOcr = initOcrDom();
    formatCaptionsAndTables();

    // Attach data-ck-act event delegation
    const container = containerRef.current;
    if (!container) return;

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const el = target?.closest<HTMLElement>('[data-ck-act]');
      if (!el) return;

      const act = el.dataset.ckAct;
      const arg = el.dataset.ckArg;

      switch (act) {
        case 'hdRun':
          hdRun().catch(console.error);
          break;
        case 'hdFill':
          hdFill();
          break;
        case 'hdDxf':
          hdDxf();
          break;
        case 'hdCopy':
          if (arg === 'bnd' || arg === 'main' || arg === 'br') {
            hdCopy(arg).catch(console.error);
          }
          break;
        case 'hvStSel':
          hvStSel();
          break;
        case 'hvStWhyFill':
          hvStWhyFill().catch(console.error);
          break;
        case 'hvSecShift':
          hvSecShift();
          break;
        case 'hvHcFit':
          hvHcFit();
          break;
        case 'hvPierEx':
          hvPierEx();
          break;
        case 'hvPreset':
          hvPreset();
          break;
        case 'hvAllFit':
          hvAllFit().catch(console.error);
          break;
        case 'hvStRe':
          if (arg === 'tvc') {
            const ta = $('tvc_rain');
            const st2El = $('tvc_st2') as HTMLInputElement | null;
            hvStRe(ta, st2El?.value);
          } else {
            hvStRe();
          }
          break;
        case 'mcocStep':
          mcocStep();
          break;
        case 'sctStep':
          sctStep();
          break;
        case 'sfdStep':
          sfdStep(null);
          break;
        default:
          break;
      }
    };

    const onInput = (e: Event) => {
      const target = e.target as HTMLElement | null;
      const el = target?.closest<HTMLElement>('[data-ck-act]');
      if (!el) return;
      const act = el.dataset.ckAct;
      if (act === 'hvHcSlide') {
        const val = Number((el as HTMLInputElement).value);
        hvHcSlide(val);
      }
    };

    const onChange = (e: Event) => {
      const target = e.target as HTMLElement | null;
      const el = target?.closest<HTMLElement>('[data-ck-act]');
      if (!el) return;
      const act = el.dataset.ckAct;
      if (act === 'hdLoadFiles') {
        const input = el as HTMLInputElement;
        if (input.files) {
          hdLoadFiles(input.files).catch(console.error);
        }
      }
      onStateChange?.();
    };

    container.addEventListener('click', onClick);
    container.addEventListener('input', onInput);
    container.addEventListener('change', onChange);

    // Initial formula typesetting
    try {
      mathAll();
    } catch {
      /* noop */
    }

    return () => {
      container.removeEventListener('click', onClick);
      container.removeEventListener('input', onInput);
      container.removeEventListener('change', onChange);
      cleanupOrch();
      cleanupVer();
      cleanupMd();
      cleanupDem();
      cleanupBridgeHydro();
      cleanupCulvertHydro();
      cleanupStations();
      cleanupOcr();
    };
  }, [onStateChange]);

  // Handle activeTab & mode change
  useEffect(() => {
    if (typeof document === 'undefined') return;
    try {
      showTab(activeTab);
      formatCaptionsAndTables();
      mathAll();
    } catch {
      /* noop */
    }
  }, [activeTab, mode]);

  return (
    <div ref={containerRef} className="legacy-shell-bridge">
      {panesToMount.map((pane) => (
        <div
          key={pane.paneId}
          id={pane.paneId}
          className={`pane ${activeTab === pane.tabId ? 'on' : ''}`}
          hidden={activeTab !== pane.tabId}
          dangerouslySetInnerHTML={{ __html: pane.html }}
        />
      ))}
    </div>
  );
}
