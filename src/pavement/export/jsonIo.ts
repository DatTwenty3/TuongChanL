import {
  calcRigid,
  createDefaultRigidInput,
  createDefaultRigidTraffic,
  type RigidInput,
  type RigidStateSnapshot,
  type RigidTrafficInputs,
  type SavedRigidOption,
} from '../engine';

export interface RigidExportBundle {
  current: {
    fields: Record<string, string>;
    layers: RigidInput['layers'];
    spec: RigidTrafficInputs['spec'];
  };
  options: Array<{
    name: string;
    state: {
      fields: Record<string, string>;
      layers: RigidInput['layers'];
      spec: RigidTrafficInputs['spec'];
    };
  }>;
}

export function snapshotToLegacyFormat(snap: RigidStateSnapshot): RigidExportBundle['current'] {
  const I = snap.input;
  const T = snap.traffic;
  return {
    fields: {
      cap: I.cap,
      model: String(I.model),
      caly: String(I.caly),
      hc: String(I.hc),
      L: String(I.L),
      B: String(I.B),
      fr: String(I.fr),
      Ec: String(I.Ec),
      muc: String(I.muc),
      ac: String(I.ac),
      Tg: String(I.Tg),
      Ps: String(I.Ps),
      Pmax: String(I.Pmax),
      Ne: String(I.Ne),
      kr: String(I.kr),
      kc: String(I.kc),
      gr: String(I.gr),
      E0: String(I.E0),
      matBound: I.matBound,
      Eb: String(I.Eb),
      hb: String(I.hb),
      mub: String(I.mub),
      fbr: String(I.fbr),
      adtt: String(T.adtt),
      fhuong: String(T.fhuong),
      flan: String(T.flan),
      naxle: String(T.naxle),
      grow: String(T.grow),
      tyear: String(T.tyear),
      eta: String(T.eta),
    },
    layers: JSON.parse(JSON.stringify(I.layers)),
    spec: JSON.parse(JSON.stringify(T.spec)),
  };
}

export function legacyFormatToSnapshot(raw: unknown): RigidStateSnapshot {
  const defIn = createDefaultRigidInput();
  const defTr = createDefaultRigidTraffic();
  if (!raw || typeof raw !== 'object') {
    return { input: defIn, traffic: defTr };
  }
  const obj = raw as Record<string, unknown>;
  // Support both legacy { fields, layers, spec } and native { input, traffic }
  if (obj.input && typeof obj.input === 'object') {
    const inp = obj.input as Partial<RigidInput>;
    const tr = (obj.traffic || {}) as Partial<RigidTrafficInputs>;
    return {
      input: {
        ...defIn,
        ...inp,
        layers: Array.isArray(inp.layers) ? inp.layers : defIn.layers,
      },
      traffic: {
        ...defTr,
        ...tr,
        spec: Array.isArray(tr.spec) ? tr.spec : defTr.spec,
      },
    };
  }
  const f = (obj.fields || {}) as Record<string, string>;
  const num = (k: string, fb: number) => {
    const v = parseFloat(f[k]);
    return Number.isFinite(v) ? v : fb;
  };
  return {
    input: {
      cap: typeof f.cap === 'string' ? f.cap : defIn.cap,
      model: num('model', defIn.model) === 1 ? 1 : 2,
      caly: num('caly', defIn.caly) === 1 ? 1 : 0,
      hc: num('hc', defIn.hc),
      L: num('L', defIn.L),
      B: num('B', defIn.B),
      fr: num('fr', defIn.fr),
      Ec: num('Ec', defIn.Ec),
      muc: num('muc', defIn.muc),
      ac: num('ac', defIn.ac),
      Tg: num('Tg', defIn.Tg),
      Ps: num('Ps', defIn.Ps),
      Pmax: num('Pmax', defIn.Pmax),
      Ne: num('Ne', defIn.Ne),
      kr: num('kr', defIn.kr),
      kc: num('kc', defIn.kc),
      gr: num('gr', defIn.gr),
      E0: num('E0', defIn.E0),
      matBound: typeof f.matBound === 'string' ? f.matBound : defIn.matBound,
      Eb: num('Eb', defIn.Eb),
      hb: num('hb', defIn.hb),
      mub: num('mub', defIn.mub),
      fbr: num('fbr', defIn.fbr),
      layers: Array.isArray(obj.layers) ? (obj.layers as RigidInput['layers']) : defIn.layers,
    },
    traffic: {
      adtt: num('adtt', defTr.adtt),
      fhuong: num('fhuong', defTr.fhuong),
      flan: num('flan', defTr.flan),
      naxle: num('naxle', defTr.naxle),
      grow: num('grow', defTr.grow),
      tyear: num('tyear', defTr.tyear),
      eta: num('eta', defTr.eta),
      spec: Array.isArray(obj.spec) ? (obj.spec as RigidTrafficInputs['spec']) : defTr.spec,
    },
  };
}

export function serializeRigidJson(current: RigidStateSnapshot, options: SavedRigidOption[]): string {
  const bundle: RigidExportBundle = {
    current: snapshotToLegacyFormat(current),
    options: options.map((o) => ({
      name: o.name,
      state: snapshotToLegacyFormat(o.state),
    })),
  };
  return JSON.stringify(bundle, null, 2);
}

export function parseRigidJson(jsonText: string): {
  current?: RigidStateSnapshot;
  options?: SavedRigidOption[];
} {
  const d = JSON.parse(jsonText) as Record<string, unknown>;
  const options = Array.isArray(d.options)
    ? d.options.map((rawOpt) => {
        const o = rawOpt as { name?: string; state?: unknown };
        const state = legacyFormatToSnapshot(o.state);
        return {
          name: String(o.name || 'PA'),
          state,
          result: calcRigid(state.input),
        };
      })
    : undefined;
  const current = d.current ? legacyFormatToSnapshot(d.current) : undefined;
  return { current, options };
}

export function downloadRigidJson(current: RigidStateSnapshot, options: SavedRigidOption[]): void {
  const text = serializeRigidJson(current, options);
  const b = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = 'PhuongAn_BTXM.json';
  a.click();
  URL.revokeObjectURL(a.href);
}
