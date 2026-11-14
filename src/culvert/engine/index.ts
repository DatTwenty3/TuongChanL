/**
 * BangTinhCauCong Web App — Unified Calculation Engine Barrel & Orchestrator Entry.
 *
 * Clean-room unified entry point exporting:
 *  - Core DOM/headless context & interpolation (`context.ts`)
 *  - RC / 2D Frame / 4-node Mindlin plate solvers (`math/rc.ts`, `math/rcmFrame.ts`)
 *  - Foundation solvers (`foundations/*`)
 *  - Culvert & retaining wall solvers (`culvertsWalls/*`)
 *  - Bridge superstructure & substructure solvers (`bridge/*`)
 *  - Hydrology, scour, watershed & station DBs (`hydrology/*`)
 *  - DXF & offline OCR importers (`importers/*`)
 *  - TCVN 11823:2017 lookup tables (`verification/lookupTables.ts`)
 *  - TCVN verification suite (`verification/verificationSuite.ts`)
 *  - Top-level mode/tab/pipeline orchestrator (`orchestrator.ts`)
 */

// Core Context & Math
export * from './context.ts';
export * from './math/rc.ts';
export * from './math/rcmFrame.ts';

// Foundations
export * from './foundations/shallowFdn.ts';
export * from './foundations/pileGroup.ts';
export * from './foundations/drilledShaft.ts';

// Culverts & Retaining Walls
export * from './culvertsWalls/boxCulvert.ts';
export * from './culvertsWalls/pipeCulvert.ts';
export * from './culvertsWalls/wallGravity.ts';
export * from './culvertsWalls/wallCantilever.ts';

// Bridge Superstructure & Substructure
export * from './bridge/crossfall.ts';
export * from './bridge/girderHollow.ts';
export * from './bridge/girderI.ts';
export * from './bridge/deckJoints.ts';
export * from './bridge/abutmentHeavy.ts';
export * from './bridge/abutmentFlex.ts';
export * from './bridge/pierFlex.ts';
export * from './bridge/pierSolid.ts';
export * from './bridge/approachSlab.ts';

// Disambiguate colliding symbols across bridge modules
export { supK } from './bridge/deckJoints.ts';
export { supK as damSupK } from './bridge/girderHollow.ts';
export { mdOn } from './bridge/abutmentHeavy.ts';
export { mdOn as mdFlexOn } from './bridge/abutmentFlex.ts';

// Hydrology & Watershed
export * from './hydrology/stationsDb.ts';
export * from './hydrology/bridgeHydro.ts';
export * from './hydrology/culvertHydro.ts';
export * from './hydrology/demWatershed.ts';

// Importers
export * from './importers/dxfParser.ts';
export * from './importers/ocrPipeline.ts';

// Verification Tables & Suite
export * from './verification/lookupTables.ts';
export * from './verification/verificationSuite.ts';

// Top-Level Engine Orchestrator
export * from './orchestrator.ts';
export { run, tab3Step } from './orchestrator.ts';
export { run as runVt } from './verification/verificationSuite.ts';
