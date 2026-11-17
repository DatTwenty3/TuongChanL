import { useCallback, useEffect, useMemo, useState } from 'react';
import { readTheme, writeTheme, type ThemeMode } from '../shared/theme';
import {
  calcRigid,
  calcTC1,
  calcTC2,
  calcTC3,
  computeSN37Low,
  computeSN37New,
  computeSN37Overlay,
  createDefaultDrainInput,
  createDefaultFlexState,
  createDefaultJointInput,
  createDefaultRigidInput,
  createDefaultRigidTraffic,
  createDefaultSn37LowInput,
  createDefaultSn37NewInput,
  createDefaultSn37OverlayInput,
  resolveFlexInput,
  type SavedRigidOption,
  type Sn37SubTab,
  type StdCode,
  type TabId,
} from './engine';
import {
  buildFlexWordDoc,
  buildFlexWorkbook,
  buildRigidWordDoc,
  buildRigidWorkbook,
  buildSN37WordDoc,
  buildSN37Workbook,
  downloadWordDoc,
  downloadWorkbook,
} from './export';
import {
  DrainModule,
  FlexModule,
  Header,
  JointModule,
  RigidModule,
  Sn37Module,
  StandardBanner,
} from './components';

const STD_DEFAULT_TAB: Record<StdCode, TabId> = {
  '39': 'rigid',
  '38': 'flex',
  '37': 'sn37',
};

const TAB_STD: Record<TabId, StdCode> = {
  rigid: '39',
  drain: '39',
  joint: '39',
  flex: '38',
  sn37: '37',
};

export function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const initial = readTheme();
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = initial;
    }
    return initial;
  });

  const [activeTab, setActiveTab] = useState<TabId>('rigid');
  const activeStd: StdCode = TAB_STD[activeTab];

  // TCCS 39 state
  const [rigidInput, setRigidInput] = useState(createDefaultRigidInput);
  const [rigidTraffic, setRigidTraffic] = useState(createDefaultRigidTraffic);
  const [rigidOptions, setRigidOptions] = useState<SavedRigidOption[]>([]);
  const [drainInput, setDrainInput] = useState(createDefaultDrainInput);
  const [jointInput, setJointInput] = useState(createDefaultJointInput);

  // TCCS 38 state
  const [flexState, setFlexState] = useState(createDefaultFlexState);

  // TCCS 37 state
  const [sn37Sub, setSn37Sub] = useState<Sn37SubTab>('new');
  const [sn37New, setSn37New] = useState(createDefaultSn37NewInput);
  const [sn37Ol, setSn37Ol] = useState(createDefaultSn37OverlayInput);
  const [sn37Low, setSn37Low] = useState(createDefaultSn37LowInput);

  const rigidResult = useMemo(() => calcRigid(rigidInput), [rigidInput]);
  const flexResolved = useMemo(() => resolveFlexInput(flexState), [flexState]);
  const flexTc1 = useMemo(() => calcTC1(flexResolved), [flexResolved]);
  const flexTc2 = useMemo(() => calcTC2(flexResolved), [flexResolved]);
  const flexTc3 = useMemo(() => calcTC3(flexResolved), [flexResolved]);
  const sn37NewRes = useMemo(() => computeSN37New(sn37New), [sn37New]);
  const sn37OlRes = useMemo(() => computeSN37Overlay(sn37Ol), [sn37Ol]);
  const sn37LowRes = useMemo(() => computeSN37Low(sn37Low), [sn37Low]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--nav-h', activeStd === '39' ? '128px' : '76px');
  }, [activeStd]);

  // Select full number text on click/focus so typing replaces old value cleanly
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target;
      if (t instanceof HTMLInputElement && t.type === 'number') {
        const handler = (ev: MouseEvent) => {
          ev.preventDefault();
          try {
            t.select();
          } catch {
            // ignore
          }
          t.removeEventListener('mouseup', handler);
        };
        t.addEventListener('mouseup', handler, { once: true });
      }
    };
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target;
      if (t instanceof HTMLInputElement && t.type === 'number') {
        try {
          t.select();
        } catch {
          // ignore
        }
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((cur) => {
      const next: ThemeMode = cur === 'dark' ? 'light' : 'dark';
      writeTheme(next);
      document.documentElement.dataset.theme = next;
      return next;
    });
  }, []);

  const switchTab = (tab: TabId) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo(0, 0);
    }
  };

  const switchStd = (std: StdCode) => {
    switchTab(STD_DEFAULT_TAB[std]);
  };

  const handleExportWord = () => {
    if (activeTab === 'flex') {
      downloadWordDoc(buildFlexWordDoc(flexResolved, flexTc1, flexTc2, flexTc3), 'ThuyetMinh_AoDuongMem_TCCS38.doc');
    } else if (activeTab === 'sn37') {
      downloadWordDoc(buildSN37WordDoc(sn37NewRes, sn37OlRes, sn37LowRes), 'ThuyetMinh_AoDuongMem_TCCS37.doc');
    } else {
      downloadWordDoc(buildRigidWordDoc(rigidInput, rigidResult, rigidTraffic), 'ThuyetMinh_BTXM_TCCS39.doc');
    }
  };

  const handleExportExcel = () => {
    if (activeTab === 'flex') {
      downloadWorkbook(
        buildFlexWorkbook(flexState, flexResolved, flexTc1, flexTc2, flexTc3),
        'TinhToan_AoDuongMem_TCCS38.xlsx',
      );
    } else if (activeTab === 'sn37') {
      downloadWorkbook(buildSN37Workbook(sn37NewRes, sn37OlRes, sn37LowRes), 'TinhToan_AoDuongMem_TCCS37.xlsx');
    } else {
      downloadWorkbook(
        buildRigidWorkbook(rigidInput, rigidResult, rigidTraffic, rigidOptions),
        'TinhToan_BTXM_TCCS39.xlsx',
      );
    }
  };

  return (
    <>
      <Header
        activeTab={activeTab}
        theme={theme}
        onToggleTheme={toggleTheme}
        onExportWord={handleExportWord}
        onExportExcel={handleExportExcel}
      />
      <StandardBanner
        activeStd={activeStd}
        activeTab={activeTab}
        onSelectStd={switchStd}
        onSelectTab={switchTab}
      />

      <RigidModule
        visible={activeTab === 'rigid'}
        input={rigidInput}
        traffic={rigidTraffic}
        result={rigidResult}
        options={rigidOptions}
        onChangeInput={setRigidInput}
        onChangeTraffic={setRigidTraffic}
        onSaveOption={() =>
          setRigidOptions((prev) => [
            ...prev,
            {
              name: `PA ${prev.length + 1}`,
              state: {
                input: JSON.parse(JSON.stringify(rigidInput)),
                traffic: JSON.parse(JSON.stringify(rigidTraffic)),
              },
              result: rigidResult,
            },
          ])
        }
        onRenameOption={(idx, name) =>
          setRigidOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, name } : o)))
        }
        onLoadOption={(idx) => {
          const opt = rigidOptions[idx];
          if (!opt) return;
          setRigidInput(JSON.parse(JSON.stringify(opt.state.input)));
          setRigidTraffic(JSON.parse(JSON.stringify(opt.state.traffic)));
        }}
        onDeleteOption={(idx) => setRigidOptions((prev) => prev.filter((_, i) => i !== idx))}
        onImportBundle={(cur, opts) => {
          if (opts) setRigidOptions(opts);
          if (cur) {
            setRigidInput(cur.input);
            setRigidTraffic(cur.traffic);
          }
        }}
      />

      <DrainModule visible={activeTab === 'drain'} input={drainInput} onChange={setDrainInput} />

      <JointModule visible={activeTab === 'joint'} input={jointInput} onChange={setJointInput} />

      <FlexModule
        visible={activeTab === 'flex'}
        state={flexState}
        resolved={flexResolved}
        tc1={flexTc1}
        tc2={flexTc2}
        tc3={flexTc3}
        onChange={setFlexState}
      />

      <Sn37Module
        visible={activeTab === 'sn37'}
        subTab={sn37Sub}
        onChangeSubTab={setSn37Sub}
        newInput={sn37New}
        newResult={sn37NewRes}
        onChangeNew={setSn37New}
        olInput={sn37Ol}
        olResult={sn37OlRes}
        onChangeOl={setSn37Ol}
        lowInput={sn37Low}
        lowResult={sn37LowRes}
        onChangeLow={setSn37Low}
      />

      <footer className="appfooter">
        <span>LEDAT-BIM · Kết cấu mặt đường · TCCS 37 · 38 · 39 / TCĐBVN</span>
        <span className="dot">•</span>
        <span className="dev">© <b>LEDAT</b></span>
      </footer>
    </>
  );
}

export default App;
