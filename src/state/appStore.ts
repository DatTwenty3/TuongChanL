import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  SHEET_DEFS,
  autoScale,
  buildSheet,
  toDXF,
  toSVG,
} from '../cad';
import {
  ancEnsure,
  buildBars,
  pileEnsure,
  calcApplyFixes,
  calcEnsure,
  calcFamilyFix,
  calcFeCurrent,
  calcFeEnsure,
  calcFeStale,
  calcFemCanAuto,
  calcFemCurrent,
  calcFemKey,
  calcFemNeed,
  calcFemOut,
  calcFemRun,
  calcGsKey,
  calcGsNeed,
  calcGsOut,
  calcGsRunNow,
  calcHeelHint,
  calcRun,
  getFemCache,
  isD,
  presetCanti,
  quantities,
  setCalcDec as setEngineCalcDec,
  type CalcRunResult,
  type EngineBarsResult,
  type EngineProject,
  type EngineSuggestItem,
} from '../engine';
import {
  baseName,
  buildCsvContent,
  calcExportDocx,
  downloadFile,
  exportCadPdf,
  exportCalcPdf,
  openProjectFromFile,
  parseProjectFile,
  printCadSheet,
  printCalcReport,
  saveProjectFile,
  serializeProject,
  setAnc,
} from '../export';
import { V3 } from '../model3d';
import { setCalcDec as setReportDec, type FeInteractiveState } from '../reports';
import type { CadSheet, QuantitiesResult } from '../types/project';

export type WorkspaceViewMode = '2d' | '3d' | 'calc';
export type CalcSubTab = 'sheet' | 'gs' | 'rb' | 'fe' | 'pile';
export type ToastKind = '' | 'ok' | 'err' | 'wait';

export type ThemeMode = 'light' | 'dark';

/** Bản nháp tự lưu của phiên làm việc trước (localStorage). */
export interface DraftInfo {
  /** thời điểm lưu (ms) */
  t: number;
  name: string;
}

const DRAFT_KEY = 'tuong-chan-btct:draft';
const THEME_KEY = 'tuong-chan-btct:theme';
const HIST_MAX = 100;
/** Các thay đổi liên tiếp cách nhau dưới ngưỡng này (gõ số, giữ nút tăng/giảm) gộp thành 1 bước hoàn tác. */
const HIST_MERGE_MS = 700;

function lsGet(key: string): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function lsSet(key: string, value: string | null): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* hết dung lượng / chế độ riêng tư: bỏ qua */
  }
}

interface DraftRecord {
  t: number;
  name: string;
  data: string;
}

function readDraft(): DraftRecord | null {
  const raw = lsGet(DRAFT_KEY);
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Partial<DraftRecord>;
    if (typeof d.t === 'number' && typeof d.data === 'string') {
      return { t: d.t, name: typeof d.name === 'string' ? d.name : '', data: d.data };
    }
  } catch {
    /* bản nháp hỏng */
  }
  return null;
}

function initialTheme(): ThemeMode {
  const saved = lsGet(THEME_KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  return 'dark';
}

export interface ToastMessage {
  id: number;
  msg: string;
  kind: ToastKind;
}

const META_KEYS: Array<keyof EngineProject> = [
  'name',
  'title',
  'company',
  'client',
  'designer',
  'checker',
  'date',
  'steel',
  'paper',
  'scale',
  'cover',
  'tBlind',
  'blindOn',
  'formEnds',
  'dimLeg',
  'fillMode',
  'fillH',
  'calc',
  'pile',
];

export function cloneProject(p: EngineProject): EngineProject {
  const next = JSON.parse(JSON.stringify(p)) as EngineProject;
  calcEnsure(next);
  ancEnsure(next);
  pileEnsure(next);
  return next;
}

export function extractKeepMeta(p: EngineProject): Partial<EngineProject> {
  const kept: Partial<EngineProject> = {};
  const src = p as unknown as Record<string, unknown>;
  const dst = kept as unknown as Record<string, unknown>;
  META_KEYS.forEach((k) => {
    const v = src[k];
    if (v !== undefined) {
      dst[k] = typeof v === 'object' && v !== null ? JSON.parse(JSON.stringify(v)) : v;
    }
  });
  return kept;
}

export function getProjectPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function setProjectPath(obj: unknown, path: string, value: unknown): void {
  const keys = path.split('.');
  const last = keys.pop();
  if (!last) return;
  let cur = obj as Record<string, unknown>;
  for (const k of keys) {
    if (!cur[k] || typeof cur[k] !== 'object') {
      cur[k] = {};
    }
    cur = cur[k] as Record<string, unknown>;
  }
  cur[last] = value;
}

function projectSnapshot(p: EngineProject): string {
  try {
    const copy = cloneProject(p);
    return JSON.stringify(copy);
  } catch {
    return '';
  }
}

export interface AppStoreValue {
  project: EngineProject;
  viewMode: WorkspaceViewMode;
  curSheet: number;
  calcSub: CalcSubTab;
  lastH1: number;
  barsRes: EngineBarsResult;
  quantitiesRes: QuantitiesResult;
  sheetScale: number;
  getSheet: (idx: number) => CadSheet;
  getAllSheets: () => CadSheet[];
  calcResult: CalcRunResult;
  feRev: number;
  gsRev: number;
  femRev: number;
  gsBusy: boolean;
  femBusy: boolean;
  femTick: number;
  heelHint: number | null | undefined;
  heelHintBusy: boolean;
  fitNonce: number;
  toast: ToastMessage | null;
  isDirty: boolean;
  exportBusy: boolean;
  v3Ref: React.MutableRefObject<V3 | null>;
  v3Rev: number;
  bumpV3Rev: () => void;
  cadAccordions: Record<string, boolean>;
  setCadAccordion: (id: string, open: boolean) => void;
  calcAccordions: Record<string, boolean>;
  setCalcAccordion: (id: string, open: boolean) => void;
  feViewState: FeInteractiveState;
  setFeViewState: React.Dispatch<React.SetStateAction<FeInteractiveState>>;
  setViewMode: (mode: WorkspaceViewMode) => void;
  selectSheetTab: (idx: number) => void;
  setCalcSub: (sub: CalcSubTab) => void;
  requestFit2d: () => void;
  updateProject: (mutator: (draft: EngineProject) => void) => void;
  setPath: (path: string, value: unknown) => void;
  setTemplatePreset: (nextBuilder: (meta: Partial<EngineProject>) => EngineProject, isCardSwitch?: boolean) => void;
  toggleAnc: (on: boolean) => void;
  applyRebarFixes: (items: EngineSuggestItem[]) => void;
  runHeelHint: () => void;
  runGsNow: (auto?: boolean) => void;
  runFemNow: () => void;
  showToast: (msg: string, kind?: ToastKind) => void;
  dismissToast: () => void;
  openProjectFile: (file: File) => Promise<void>;
  saveProject: () => void;
  exportDxf: (all: boolean) => void;
  exportSvg: () => void;
  exportCsv: () => void;
  exportPdf: () => Promise<void>;
  exportDocx: () => Promise<void>;
  export3dPng: () => Promise<void>;
  printCurrent: () => Promise<void>;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  theme: ThemeMode;
  toggleTheme: () => void;
  cmdOpen: boolean;
  setCmdOpen: (open: boolean) => void;
  draft: DraftInfo | null;
  restoreDraft: () => void;
  discardDraft: () => void;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

export const nearestCantiH = (H: number): number => Math.min(13, Math.max(4, Math.round(H / 100)));

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [project, setProject] = useState<EngineProject>(() => cloneProject(presetCanti(500)));
  const [viewMode, setViewModeState] = useState<WorkspaceViewMode>('3d');
  const [curSheet, setCurSheet] = useState<number>(0);
  const [calcSub, setCalcSubState] = useState<CalcSubTab>('sheet');
  const [lastH1, setLastH1] = useState<number>(5);

  const [feRev, setFeRev] = useState(0);
  const [gsRev, setGsRev] = useState(0);
  const [femRev, setFemRev] = useState(0);
  const [gsBusy, setGsBusy] = useState(false);
  const [femBusy, setFemBusy] = useState(false);
  const [femTick, setFemTick] = useState(0);

  const [heelHint, setHeelHint] = useState<number | null | undefined>(undefined);
  const [heelHintBusy, setHeelHintBusy] = useState(false);
  const [fitNonce, setFitNonce] = useState(0);
  const [exportBusy, setExportBusy] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [v3Rev, setV3Rev] = useState(0);
  const [cleanRev, setCleanRev] = useState(0);
  const v3Ref = useRef<V3 | null>(null);

  const [theme, setTheme] = useState<ThemeMode>(initialTheme);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [histRev, setHistRev] = useState(0);
  const [draft, setDraft] = useState<DraftInfo | null>(() => {
    const d = readDraft();
    return d ? { t: d.t, name: d.name } : null;
  });

  const [cadAccordions, setCadAccordions] = useState<Record<string, boolean>>({});
  const [calcAccordions, setCalcAccordions] = useState<Record<string, boolean>>(() => {
    const c = project.calc;
    return {
      '0': true,
      '1': true,
      '2': true,
      '3': true,
      '4': Boolean(c?.wOn),
      '5': Boolean(c?.eqOn),
      '6': true,
      '7': Boolean(c?.feOn),
      '8': Boolean(c?.femOn),
      '9': false,
      '10': true,
      '11': false,
    };
  });
  const [feViewState, setFeViewState] = useState<FeInteractiveState>({
    q: 'M',
    k: 'bao',
    az: 24,
    el: 20,
    ribs: 'grey',
  });

  const setCadAccordion = useCallback((id: string, open: boolean) => {
    setCadAccordions((prev) => (prev[id] === open ? prev : { ...prev, [id]: open }));
  }, []);

  const setCalcAccordion = useCallback((id: string, open: boolean) => {
    setCalcAccordions((prev) => (prev[id] === open ? prev : { ...prev, [id]: open }));
  }, []);

  const prevCalcAutoRef = useRef({
    wOn: Boolean(project.calc?.wOn),
    eqOn: Boolean(project.calc?.eqOn),
    feOn: Boolean(project.calc?.feOn),
    femOn: Boolean(project.calc?.femOn),
  });

  const cleanSnapRef = useRef<string>(projectSnapshot(project));
  const toastTimerRef = useRef<number>(0);
  const toastSeqRef = useRef<number>(1);
  const feTimerRef = useRef<number>(0);
  const gsTimerRef = useRef<number>(0);
  const femTimerRef = useRef<number>(0);
  const femTickRef = useRef<number>(0);

  const gsBusyRef = useRef(false);
  const gsAutoGuardRef = useRef<{ k: string; n: number }>({ k: '', n: 0 });
  const femAutoGuardRef = useRef<{ k: string; n: number }>({ k: '', n: 0 });

  const projectRef = useRef(project);
  projectRef.current = project;
  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;

  const showToast = useCallback((msg: string, kind: ToastKind = '') => {
    window.clearTimeout(toastTimerRef.current);
    const id = toastSeqRef.current++;
    setToast({ id, msg, kind });
    if (kind !== 'wait') {
      toastTimerRef.current = window.setTimeout(
        () => {
          setToast((cur) => (cur && cur.id === id ? null : cur));
        },
        kind === 'err' ? 12000 : 6000,
      );
    }
  }, []);

  const dismissToast = useCallback(() => {
    window.clearTimeout(toastTimerRef.current);
    setToast(null);
  }, []);

  const bumpV3Rev = useCallback(() => setV3Rev((n) => n + 1), []);

  const markClean = useCallback((p?: EngineProject) => {
    cleanSnapRef.current = projectSnapshot(p || projectRef.current);
    setCleanRev((n) => n + 1);
  }, []);

  const isDirty = useMemo(() => {
    void cleanRev;
    return projectSnapshot(project) !== cleanSnapRef.current;
  }, [project, cleanRev]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (projectSnapshot(projectRef.current) !== cleanSnapRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const projectDec = useMemo<'dot' | 'comma'>(() => {
    const dec = project.calc?.dec === ',' ? ',' : '.';
    setEngineCalcDec(dec);
    setReportDec(dec);
    return dec === ',' ? 'comma' : 'dot';
  }, [project.calc?.dec]);

  const barsRes = useMemo(() => buildBars(project), [project]);
  const quantitiesRes = useMemo(() => quantities(project, barsRes), [project, barsRes]);
  const sheetScale = useMemo(
    () => autoScale(project, barsRes, quantitiesRes),
    [project, barsRes, quantitiesRes],
  );

  const sheetCacheRef = useRef<{
    p: EngineProject | null;
    barsRes: EngineBarsResult | null;
    q: QuantitiesResult | null;
    S: number;
    sheets: Array<CadSheet | null>;
  }>({
    p: null,
    barsRes: null,
    q: null,
    S: 0,
    sheets: SHEET_DEFS.map(() => null),
  });

  if (
    sheetCacheRef.current.p !== project ||
    sheetCacheRef.current.barsRes !== barsRes ||
    sheetCacheRef.current.q !== quantitiesRes ||
    sheetCacheRef.current.S !== sheetScale
  ) {
    sheetCacheRef.current = {
      p: project,
      barsRes,
      q: quantitiesRes,
      S: sheetScale,
      sheets: SHEET_DEFS.map(() => null),
    };
  }

  const getSheet = useCallback(
    (idx: number): CadSheet => {
      const safeIdx = Math.max(0, Math.min(SHEET_DEFS.length - 1, idx));
      const c = sheetCacheRef.current;
      if (!c.sheets[safeIdx]) {
        c.sheets[safeIdx] = buildSheet(project, barsRes, quantitiesRes, safeIdx, sheetScale);
      }
      return c.sheets[safeIdx]!;
    },
    [project, barsRes, quantitiesRes, sheetScale],
  );

  const getAllSheets = useCallback((): CadSheet[] => {
    return SHEET_DEFS.map((_, i) => getSheet(i));
  }, [getSheet]);

  const calcResult = useMemo(() => {
    void feRev;
    void gsRev;
    void femRev;
    void projectDec;
    const dec = project.calc?.dec === ',' ? ',' : '.';
    setEngineCalcDec(dec);
    setReportDec(dec);
    return calcRun(project);
  }, [project, projectDec, feRev, gsRev, femRev]);

  useEffect(() => {
    if (project.tpl === 'B') {
      setLastH1(nearestCantiH(project.H));
    }
    if (!project.calc?.feOn) {
      setCalcSubState((sub) => (sub === 'fe' ? 'sheet' : sub));
    }
    const nextAuto = {
      wOn: Boolean(project.calc?.wOn),
      eqOn: Boolean(project.calc?.eqOn),
      feOn: Boolean(project.calc?.feOn),
      femOn: Boolean(project.calc?.femOn),
    };
    const prevAuto = prevCalcAutoRef.current;
    const patch: Record<string, boolean> = {};
    const checkAuto = (id: string, key: keyof typeof nextAuto, rememberToggle: boolean) => {
      if (nextAuto[key] && !prevAuto[key]) {
        patch[id] = true;
      } else if (!rememberToggle && nextAuto[key] !== prevAuto[key]) {
        patch[id] = nextAuto[key];
      }
    };
    checkAuto('4', 'wOn', false);
    checkAuto('5', 'eqOn', false);
    checkAuto('7', 'feOn', false);
    checkAuto('8', 'femOn', true);
    prevCalcAutoRef.current = nextAuto;
    if (Object.keys(patch).length > 0) {
      setCalcAccordions((prev) => ({ ...prev, ...patch }));
    }
  }, [project]);

  // ----- Hoàn tác / làm lại: ghi lại mọi thay đổi của `project` (đối tượng bất biến nên chỉ giữ tham chiếu) -----
  const histRef = useRef<{
    past: EngineProject[];
    future: EngineProject[];
    prev: EngineProject;
    skip: boolean;
    t: number;
  }>({ past: [], future: [], prev: project, skip: false, t: 0 });

  useEffect(() => {
    const h = histRef.current;
    if (h.prev === project) return;
    if (h.skip) {
      h.skip = false;
    } else if (JSON.stringify(h.prev) !== JSON.stringify(project)) {
      const now = Date.now();
      if (h.past.length === 0 || now - h.t > HIST_MERGE_MS) {
        h.past.push(h.prev);
        if (h.past.length > HIST_MAX) h.past.shift();
      }
      h.t = now;
      h.future = [];
    }
    h.prev = project;
    setHistRev((n) => n + 1);
  }, [project]);

  const undo = useCallback(() => {
    const h = histRef.current;
    const target = h.past.pop();
    if (!target) return;
    h.future.push(projectRef.current);
    h.skip = true;
    h.t = 0;
    setHeelHint(undefined);
    setProject(target);
  }, []);

  const redo = useCallback(() => {
    const h = histRef.current;
    const target = h.future.pop();
    if (!target) return;
    h.past.push(projectRef.current);
    h.skip = true;
    h.t = 0;
    setHeelHint(undefined);
    setProject(target);
  }, []);

  const canUndo = useMemo(() => {
    void histRev;
    return histRef.current.past.length > 0;
  }, [histRev]);
  const canRedo = useMemo(() => {
    void histRev;
    return histRef.current.future.length > 0;
  }, [histRev]);

  // ----- Giao diện sáng / tối -----
  const toggleTheme = useCallback(() => {
    setTheme((cur) => {
      const next: ThemeMode = cur === 'dark' ? 'light' : 'dark';
      lsSet(THEME_KEY, next);
      return next;
    });
  }, []);

  // ----- Tự lưu bản nháp: chỉ ghi khi có thay đổi chưa lưu và người dùng đã xử lý bản nháp cũ -----
  const draftPendingRef = useRef(draft !== null);
  useEffect(() => {
    if (draftPendingRef.current) return;
    const id = window.setTimeout(() => {
      if (projectSnapshot(project) === cleanSnapRef.current) {
        lsSet(DRAFT_KEY, null);
        return;
      }
      const rec: DraftRecord = {
        t: Date.now(),
        name: project.name || '',
        data: serializeProject(project),
      };
      lsSet(DRAFT_KEY, JSON.stringify(rec));
    }, 800);
    return () => window.clearTimeout(id);
  }, [project, cleanRev]);

  const discardDraft = useCallback(() => {
    draftPendingRef.current = false;
    lsSet(DRAFT_KEY, null);
    setDraft(null);
  }, []);

  const restoreDraft = useCallback(() => {
    const rec = readDraft();
    draftPendingRef.current = false;
    setDraft(null);
    if (!rec) {
      showToast('Không còn bản nháp để khôi phục.', 'err');
      return;
    }
    try {
      const loaded = cloneProject(parseProjectFile(rec.data));
      setHeelHint(undefined);
      setProject(loaded);
      showToast('Đã khôi phục phiên làm việc trước (chưa lưu thành file).', 'ok');
    } catch (e) {
      console.error(e);
      lsSet(DRAFT_KEY, null);
      showToast('Bản nháp bị hỏng, không khôi phục được.', 'err');
    }
  }, [showToast]);

  const updateProject = useCallback((mutator: (draft: EngineProject) => void) => {
    setHeelHint(undefined);
    setProject((prev) => {
      const draft = cloneProject(prev);
      mutator(draft);
      calcEnsure(draft);
      ancEnsure(draft);
      pileEnsure(draft);
      return draft;
    });
  }, []);

  const setPath = useCallback(
    (path: string, value: unknown) => {
      updateProject((draft) => {
        setProjectPath(draft, path, value);
        if (path === 'tBase' && isD(draft)) {
          draft.tTip = Number(value);
        }
        if (path === 'calc.soil' && value !== 'a' && draft.anc?.on) {
          draft.anc.on = false;
        }
      });
    },
    [updateProject],
  );

  const setTemplatePreset = useCallback(
    (nextBuilder: (meta: Partial<EngineProject>) => EngineProject) => {
      setHeelHint(undefined);
      setProject((prev) => {
        const wasD = prev.tpl === 'D';
        const kept = extractKeepMeta(prev);
        const built = nextBuilder(kept);
        calcFamilyFix(built, wasD);
        return cloneProject(built);
      });
    },
    [],
  );

  const toggleAnc = useCallback(
    (on: boolean) => {
      updateProject((draft) => {
        setAnc(draft, on);
      });
    },
    [updateProject],
  );

  const applyRebarFixes = useCallback(
    (items: EngineSuggestItem[]) => {
      updateProject((draft) => {
        calcApplyFixes(draft, items);
      });
    },
    [updateProject],
  );

  const runHeelHint = useCallback(() => {
    setHeelHintBusy(true);
    window.setTimeout(() => {
      try {
        const add = calcHeelHint(projectRef.current);
        setHeelHint(add);
      } finally {
        setHeelHintBusy(false);
      }
    }, 20);
  }, []);

  const runFemNow = useCallback(() => {
    if (getFemCache().busy) return;
    const p = projectRef.current;
    const started = calcFemRun(p, () => {
      window.clearInterval(femTickRef.current);
      setFemBusy(false);
      setFemRev((n) => n + 1);
    });
    if (!started) {
      setFemRev((n) => n + 1);
      return;
    }
    setFemBusy(true);
    window.clearInterval(femTickRef.current);
    femTickRef.current = window.setInterval(() => {
      setFemTick((t) => t + 1);
      if (!getFemCache().busy) {
        window.clearInterval(femTickRef.current);
        setFemBusy(false);
      }
    }, 250);
  }, []);

  const runGsNow = useCallback(
    (auto = false) => {
      if (gsBusyRef.current) return;
      const p = projectRef.current;
      const R = calcRun(p);
      if (!R || 'error' in R || 'unsupported' in R || !R.g) {
        setGsRev((n) => n + 1);
        return;
      }
      gsBusyRef.current = true;
      setGsBusy(true);
      window.setTimeout(() => {
        try {
          calcGsRunNow(projectRef.current);
        } catch (e) {
          console.error(e);
        }
        gsBusyRef.current = false;
        setGsBusy(false);
        if (!auto) setCalcSubState('gs');
        setGsRev((n) => n + 1);
        if (!auto && !calcFemCurrent(projectRef.current)) {
          runFemNow();
        }
      }, 30);
    },
    [runFemNow],
  );

  // V3 model sync is handled exclusively by Model3DViewport to avoid duplicate setModel calls on 2D->3D transitions.

  // Auto-run 3D Plate FE (900ms outside Calc tab, 80ms inside Calc tab)
  useEffect(() => {
    window.clearTimeout(feTimerRef.current);
    if (!calcFeStale(project)) return;
    const delay = viewMode === 'calc' ? 80 : 900;
    feTimerRef.current = window.setTimeout(() => {
      try {
        if (calcFeEnsure(projectRef.current)) {
          setFeRev((n) => n + 1);
        }
      } catch (e) {
        console.error(e);
      }
    }, delay);
    return () => window.clearTimeout(feTimerRef.current);
  }, [project, viewMode]);

  // Auto-run Global Stability (Bishop + Seepage) when in Calc tab (600ms debounce, max 2 retries)
  useEffect(() => {
    window.clearTimeout(gsTimerRef.current);
    if (viewMode !== 'calc' || gsBusyRef.current || !calcGsNeed(project)) return;
    gsTimerRef.current = window.setTimeout(() => {
      if (viewModeRef.current !== 'calc' || gsBusyRef.current || !calcGsNeed(projectRef.current)) {
        return;
      }
      const k = calcGsKey(projectRef.current);
      if (k === gsAutoGuardRef.current.k) {
        if (++gsAutoGuardRef.current.n > 2) return;
      } else {
        gsAutoGuardRef.current = { k, n: 1 };
      }
      runGsNow(true);
    }, 600);
    return () => window.clearTimeout(gsTimerRef.current);
  }, [project, viewMode, gsRev, runGsNow]);

  // Auto-run 2D FEM in WebWorker when in Calc tab (1200ms debounce, max 2 retries)
  useEffect(() => {
    window.clearTimeout(femTimerRef.current);
    if (viewMode !== 'calc' || !calcFemCanAuto() || !calcFemNeed(project)) return;
    femTimerRef.current = window.setTimeout(() => {
      if (viewModeRef.current !== 'calc' || !calcFemNeed(projectRef.current)) return;
      const k = calcFemKey(projectRef.current);
      if (k === femAutoGuardRef.current.k) {
        if (++femAutoGuardRef.current.n > 2) return;
      } else {
        femAutoGuardRef.current = { k, n: 1 };
      }
      runFemNow();
    }, 1200);
    return () => window.clearTimeout(femTimerRef.current);
  }, [project, viewMode, femRev, runFemNow]);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      window.clearTimeout(toastTimerRef.current);
      window.clearTimeout(feTimerRef.current);
      window.clearTimeout(gsTimerRef.current);
      window.clearTimeout(femTimerRef.current);
      window.clearInterval(femTickRef.current);
    };
  }, []);

  const setViewMode = useCallback((mode: WorkspaceViewMode) => {
    setViewModeState(mode);
  }, []);

  const selectSheetTab = useCallback((idx: number) => {
    setCurSheet(Math.max(0, Math.min(SHEET_DEFS.length - 1, idx)));
    setViewModeState('2d');
  }, []);

  const setCalcSub = useCallback((sub: CalcSubTab) => {
    setCalcSubState(sub);
  }, []);

  const requestFit2d = useCallback(() => {
    setFitNonce((n) => n + 1);
  }, []);

  // File & Export operations
  const openProjectFile = useCallback(
    async (file: File) => {
      try {
        const loaded = cloneProject(await openProjectFromFile(file));
        setHeelHint(undefined);
        const h = histRef.current;
        h.past = [];
        h.future = [];
        h.skip = true;
        setProject(loaded);
        if (loaded.tpl === 'B') {
          setLastH1(nearestCantiH(loaded.H));
        }
        if (!loaded.calc?.feOn) {
          setCalcSubState((sub) => (sub === 'fe' ? 'sheet' : sub));
        }
        markClean(loaded);
        showToast(`Đã mở dự án “${file.name}”.`, 'ok');
      } catch (e) {
        console.error(e);
        const msg = e instanceof Error ? e.message : String(e);
        showToast(msg || 'File dự án không hợp lệ.', 'err');
      }
    },
    [markClean, showToast],
  );

  const saveProject = useCallback(() => {
    try {
      const fn = saveProjectFile(project);
      markClean(project);
      showToast(`Đã lưu “${fn}”.`, 'ok');
    } catch (e) {
      console.error(e);
      showToast(`Không lưu được dự án: ${e instanceof Error ? e.message : String(e)}`, 'err');
    }
  }, [project, markClean, showToast]);

  const exportDxf = useCallback(
    (all: boolean) => {
      try {
        const sheets = all ? getAllSheets() : [getSheet(curSheet)];
        const dxf = toDXF(sheets);
        const filename = `${baseName(project.name)}_${all ? 'tat-ca' : `to${curSheet + 1}`}.dxf`;
        downloadFile(filename, dxf, 'application/dxf');
        showToast(`Đã xuất “${filename}”.`, 'ok');
      } catch (e) {
        console.error(e);
        showToast(`Không xuất được DXF: ${e instanceof Error ? e.message : String(e)}`, 'err');
      }
    },
    [project.name, curSheet, getAllSheets, getSheet, showToast],
  );

  const exportSvg = useCallback(() => {
    try {
      const sh = getSheet(curSheet);
      const svg = toSVG(sh, { w: '100%', h: '100%' });
      const filename = `${baseName(project.name)}_to${curSheet + 1}.svg`;
      downloadFile(filename, svg, 'image/svg+xml');
      showToast(`Đã xuất “${filename}”.`, 'ok');
    } catch (e) {
      console.error(e);
      showToast(`Không xuất được SVG: ${e instanceof Error ? e.message : String(e)}`, 'err');
    }
  }, [project.name, curSheet, getSheet, showToast]);

  const exportCsv = useCallback(() => {
    try {
      const csv = buildCsvContent(barsRes, quantitiesRes);
      const filename = `${baseName(project.name)}_thong-ke-thep.csv`;
      downloadFile(filename, csv, 'text/csv;charset=utf-8');
      showToast(`Đã xuất “${filename}”.`, 'ok');
    } catch (e) {
      console.error(e);
      showToast(`Không xuất được CSV: ${e instanceof Error ? e.message : String(e)}`, 'err');
    }
  }, [project.name, barsRes, quantitiesRes, showToast]);

  const exportPdf = useCallback(async () => {
    if (exportBusy) return;
    setExportBusy(true);
    try {
      if (viewMode === 'calc') {
        showToast('Đang chuẩn bị xuất PDF…', 'wait');
        const filename = await exportCalcPdf(project, (m) => showToast(m, 'wait'));
        setFeRev((n) => n + 1);
        setGsRev((n) => n + 1);
        setFemRev((n) => n + 1);
        showToast(`Đã xuất “${filename}”.`, 'ok');
      } else {
        showToast('Đang tạo PDF bản vẽ…', 'wait');
        const filename = await exportCadPdf(project, getSheet(curSheet), curSheet);
        showToast(`Đã xuất “${filename}”.`, 'ok');
      }
    } catch (e) {
      console.error(e);
      showToast(`Không xuất được PDF: ${e instanceof Error ? e.message : String(e)}`, 'err');
    } finally {
      setExportBusy(false);
    }
  }, [exportBusy, viewMode, project, getSheet, curSheet, showToast]);

  const exportDocx = useCallback(async () => {
    if (exportBusy) return;
    setExportBusy(true);
    showToast('Đang chuẩn bị xuất Word…', 'wait');
    try {
      const { blob } = await calcExportDocx(project, (msg) => showToast(msg, 'wait'));
      setFeRev((n) => n + 1);
      setGsRev((n) => n + 1);
      setFemRev((n) => n + 1);
      const filename = `${baseName(project.name)}_tinh-toan.docx`;
      downloadFile(
        filename,
        blob,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
      showToast(`Đã xuất “${filename}”.`, 'ok');
    } catch (e) {
      console.error(e);
      showToast(`Không xuất được Word: ${e instanceof Error ? e.message : String(e)}`, 'err');
    } finally {
      setExportBusy(false);
    }
  }, [exportBusy, project, showToast]);

  const export3dPng = useCallback(async () => {
    const v3 = v3Ref.current;
    if (!v3 || !v3.ok || !v3.model) {
      showToast('Mô hình 3D chưa sẵn sàng để chụp ảnh.', 'err');
      return;
    }
    try {
      const blob = await v3.toPngBlob(project);
      if (!blob) {
        showToast('Không tạo được ảnh PNG.', 'err');
        return;
      }
      const filename = `${baseName(project.name)}_3D.png`;
      downloadFile(filename, blob, 'image/png');
      showToast(`Đã xuất “${filename}”.`, 'ok');
    } catch (e) {
      console.error(e);
      showToast(`Không xuất được ảnh 3D: ${e instanceof Error ? e.message : String(e)}`, 'err');
    }
  }, [project, showToast]);

  const printCurrent = useCallback(async () => {
    if (exportBusy) return;
    setExportBusy(true);
    try {
      if (viewMode === 'calc') {
        showToast('Đang chuẩn bị bản in…', 'wait');
        await printCalcReport(project, (msg) => showToast(msg, 'wait'));
        setFeRev((n) => n + 1);
        setGsRev((n) => n + 1);
        setFemRev((n) => n + 1);
        dismissToast();
      } else {
        await printCadSheet(project, getSheet(curSheet), curSheet);
      }
    } catch (e) {
      console.error(e);
      showToast(`Không mở được hộp thoại in: ${e instanceof Error ? e.message : String(e)}`, 'err');
    } finally {
      setExportBusy(false);
    }
  }, [exportBusy, viewMode, project, getSheet, curSheet, showToast, dismissToast]);

  const value: AppStoreValue = useMemo(
    () => ({
      project,
      viewMode,
      curSheet,
      calcSub,
      lastH1,
      barsRes,
      quantitiesRes,
      sheetScale,
      getSheet,
      getAllSheets,
      calcResult,
      feRev,
      gsRev,
      femRev,
      gsBusy,
      femBusy,
      femTick,
      heelHint,
      heelHintBusy,
      fitNonce,
      toast,
      isDirty,
      exportBusy,
      v3Ref,
      v3Rev,
      bumpV3Rev,
      cadAccordions,
      setCadAccordion,
      calcAccordions,
      setCalcAccordion,
      feViewState,
      setFeViewState,
      setViewMode,
      selectSheetTab,
      setCalcSub,
      requestFit2d,
      updateProject,
      setPath,
      setTemplatePreset,
      toggleAnc,
      applyRebarFixes,
      runHeelHint,
      runGsNow,
      runFemNow,
      showToast,
      dismissToast,
      openProjectFile,
      saveProject,
      exportDxf,
      exportSvg,
      exportCsv,
      exportPdf,
      exportDocx,
      export3dPng,
      printCurrent,
      canUndo,
      canRedo,
      undo,
      redo,
      theme,
      toggleTheme,
      cmdOpen,
      setCmdOpen,
      draft,
      restoreDraft,
      discardDraft,
    }),
    [
      project,
      viewMode,
      curSheet,
      calcSub,
      lastH1,
      barsRes,
      quantitiesRes,
      sheetScale,
      getSheet,
      getAllSheets,
      calcResult,
      feRev,
      gsRev,
      femRev,
      gsBusy,
      femBusy,
      femTick,
      heelHint,
      heelHintBusy,
      fitNonce,
      toast,
      isDirty,
      exportBusy,
      v3Rev,
      bumpV3Rev,
      cadAccordions,
      setCadAccordion,
      calcAccordions,
      setCalcAccordion,
      feViewState,
      setFeViewState,
      setViewMode,
      selectSheetTab,
      setCalcSub,
      requestFit2d,
      updateProject,
      setPath,
      setTemplatePreset,
      toggleAnc,
      applyRebarFixes,
      runHeelHint,
      runGsNow,
      runFemNow,
      showToast,
      dismissToast,
      openProjectFile,
      saveProject,
      exportDxf,
      exportSvg,
      exportCsv,
      exportPdf,
      exportDocx,
      export3dPng,
      printCurrent,
      canUndo,
      canRedo,
      undo,
      redo,
      theme,
      toggleTheme,
      cmdOpen,
      draft,
      restoreDraft,
      discardDraft,
    ],
  );

  // Also keep calcGsOut / calcFemOut references warmed/tree-shaken properly
  void calcGsOut;
  void calcFemOut;

  return React.createElement(AppStoreContext.Provider, { value }, children);
};

export function useAppStore(): AppStoreValue {
  const ctx = useContext(AppStoreContext);
  if (!ctx) {
    throw new Error('useAppStore must be used inside <AppProvider>');
  }
  return ctx;
}
