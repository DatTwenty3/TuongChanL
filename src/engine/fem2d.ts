/**
 * 2D Plane-Strain FEM facade & synchronous helper (`FEM2D_MAKE`, `FEM2D`,
 * `packFemInput`, `runFemSync`).
 */

import { calcFemPack } from './calcOrchestrator.ts';
import {
  FEM2D,
  FEM2D_MAKE,
  type Fem2dApi,
  type Fem2dJobOutput,
  type Fem2dMcMaterial,
  type Fem2dMeshSpec,
  type Fem2dPackInput,
  type Fem2dPackOptions,
  type Fem2dRawMesh,
  type Fem2dRunOptions,
  type Fem2dStageSummary,
  type Fem2dWaterInput,
  type Fem2dWaterPackSummary,
} from './fem2dCore.ts';
import type { EngineProject } from './types.ts';

export { FEM2D, FEM2D_MAKE };
export type {
  Fem2dApi,
  Fem2dJobOutput,
  Fem2dMcMaterial,
  Fem2dMeshSpec,
  Fem2dPackInput,
  Fem2dPackOptions,
  Fem2dRawMesh,
  Fem2dRunOptions,
  Fem2dStageSummary,
  Fem2dWaterInput,
  Fem2dWaterPackSummary,
};

export function packFemInput(P: EngineProject, full = true): Fem2dPackInput | null {
  return calcFemPack(P, full);
}

export function runFemSync(
  P: EngineProject,
  opts?: { full?: boolean; raw?: boolean },
): Fem2dJobOutput | null {
  const m = calcFemPack(P, opts?.full ?? true);
  if (!m) return null;
  if (opts?.raw !== undefined) m.opt.raw = opts.raw;
  return FEM2D.job(m);
}
