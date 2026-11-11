/**
 * Vite ES module Web Worker executing heavy 2D FEM staged construction and
 * Mohr-Coulomb Strength Reduction Method (SRM) jobs asynchronously.
 */

import { FEM2D_MAKE } from './fem2dCore.ts';
import type { Fem2dJobOutput, Fem2dPackInput } from './fem2dCore.ts';

export interface Fem2dWorkerRequest {
  id: number;
  m: Fem2dPackInput;
}

export interface Fem2dWorkerResponse {
  id: number;
  out?: Fem2dJobOutput;
  err?: string;
}

const workerScope = globalThis as unknown as {
  onmessage: ((e: MessageEvent<Fem2dWorkerRequest>) => void) | null;
  postMessage: (message: Fem2dWorkerResponse) => void;
};

const solver = FEM2D_MAKE();

workerScope.onmessage = (e: MessageEvent<Fem2dWorkerRequest>) => {
  const { id, m } = e.data;
  try {
    workerScope.postMessage({ id, out: solver.job(m) });
  } catch (err: unknown) {
    workerScope.postMessage({
      id,
      err: String((err instanceof Error ? err.message : err) || err),
    });
  }
};
