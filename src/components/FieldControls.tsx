import React, { useEffect, useRef, useState } from 'react';
import {
  D_TAB,
  KE_TAB,
  clamp,
  dIdxOf,
  fmt,
  presetCanti,
  presetKe,
  presetWall4,
} from '../engine';
import { getProjectPath, useAppStore } from '../state/appStore';

export const keLabel = (r: { H: number }): string => `H = ${fmt(r.H / 100, 2)} m`;

export const KE_HS: ReadonlyArray<[number, number]> = (() => {
  const m = new Map<number, number>();
  KE_TAB.forEach((r, i) => {
    if (!m.has(r.H)) m.set(r.H, i);
  });
  return [...m.entries()].sort((a, b) => a[0] - b[0]);
})();

export const keFirst = (idx?: number | null): number => {
  const safeIdx = clamp((idx ?? 0) | 0, 0, KE_TAB.length - 1);
  const H = KE_TAB[safeIdx].H;
  const hit = KE_HS.find((e) => e[0] === H);
  return hit ? hit[1] : KE_HS[0][1];
};

export interface NumFieldProps {
  path: string;
  label: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
}

export const NumField: React.FC<NumFieldProps> = ({ path, label, unit, min, max, step }) => {
  const { project, setPath } = useAppStore();
  const raw = getProjectPath(project, path);
  const numVal = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;

  const [draft, setDraft] = useState<string>(() => String(numVal));
  const focusedRef = useRef(false);
  const lastCommittedRef = useRef<number>(numVal);

  useEffect(() => {
    if (!focusedRef.current || numVal !== lastCommittedRef.current) {
      setDraft(String(numVal));
      lastCommittedRef.current = numVal;
    }
  }, [numVal, path]);

  return (
    <label className="row">
      <span className="lab">{label}</span>
      <span className="inp">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={draft}
          data-path={path}
          onFocus={() => {
            focusedRef.current = true;
          }}
          onChange={(e) => {
            const next = e.target.value;
            setDraft(next);
            const v = parseFloat(next);
            if (!Number.isNaN(v) && Number.isFinite(v)) {
              lastCommittedRef.current = v;
              setPath(path, v);
            }
          }}
          onBlur={() => {
            focusedRef.current = false;
            setDraft(String(numVal));
            lastCommittedRef.current = numVal;
          }}
        />
        <i>{unit ?? ''}</i>
      </span>
    </label>
  );
};

export interface TxtFieldProps {
  path: string;
  label: string;
}

export const TxtField: React.FC<TxtFieldProps> = ({ path, label }) => {
  const { project, setPath } = useAppStore();
  const raw = getProjectPath(project, path);
  const val = raw == null ? '' : String(raw);

  return (
    <label className="row wide">
      <span className="lab">{label}</span>
      <span className="inp">
        <input
          type="text"
          value={val}
          data-path={path}
          onChange={(e) => setPath(path, e.target.value)}
        />
      </span>
    </label>
  );
};

export interface DateFieldProps {
  path: string;
  label: string;
}

export const DateField: React.FC<DateFieldProps> = ({ path, label }) => {
  const { project, setPath } = useAppStore();
  const raw = getProjectPath(project, path);
  const val = raw == null ? '' : String(raw);

  return (
    <label className="row wide">
      <span className="lab">{label}</span>
      <span className="inp">
        <input
          type="date"
          value={val}
          data-path={path}
          onChange={(e) => setPath(path, e.target.value)}
        />
      </span>
    </label>
  );
};

export interface SelFieldProps {
  path: string;
  label: string;
  options: ReadonlyArray<[string | number, string]>;
  numeric?: boolean;
  stack?: boolean;
  transform?: (rawValue: string) => unknown;
}

export const SelField: React.FC<SelFieldProps> = ({
  path,
  label,
  options,
  numeric,
  stack,
  transform,
}) => {
  const { project, setPath } = useAppStore();
  const raw = getProjectPath(project, path);
  const strVal = raw == null ? '' : String(raw);

  return (
    <label className={stack ? 'row stack' : 'row'}>
      <span className="lab">{label}</span>
      <span className="inp">
        <select
          value={strVal}
          data-path={path}
          onChange={(e) => {
            const v = e.target.value;
            const next = transform ? transform(v) : numeric ? parseFloat(v) : v;
            setPath(path, next);
          }}
        >
          {options.map(([v, text]) => (
            <option key={String(v)} value={String(v)}>
              {text}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
};

export interface ChkFieldProps {
  path: string;
  label: string;
  title?: string;
}

export const ChkField: React.FC<ChkFieldProps> = ({ path, label, title }) => {
  const { project, setPath } = useAppStore();
  const checked = Boolean(getProjectPath(project, path));

  return (
    <label className="chk" title={title}>
      <input
        type="checkbox"
        checked={checked}
        data-path={path}
        onChange={(e) => setPath(path, e.target.checked)}
      />{' '}
      {label}
    </label>
  );
};

export interface SciFieldProps {
  path: string;
  label: string;
}

function formatSci(v: unknown): string {
  const x = Number(v);
  return Number.isFinite(x) && x > 0 ? x.toExponential().replace('e+', 'e') : '1e-6';
}

export const SciField: React.FC<SciFieldProps> = ({ path, label }) => {
  const { project, setPath } = useAppStore();
  const raw = getProjectPath(project, path);
  const formatted = formatSci(raw);

  const [draft, setDraft] = useState<string>(formatted);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) {
      setDraft(formatted);
    }
  }, [formatted, path]);

  return (
    <label className="row">
      <span className="lab">{label}</span>
      <span className="inp">
        <input
          type="text"
          inputMode="decimal"
          value={draft}
          data-path={path}
          title="Ví dụ: 1e-5 = 0,00001 m/s"
          onFocus={() => {
            focusedRef.current = true;
          }}
          onChange={(e) => {
            const next = e.target.value;
            setDraft(next);
            const v = parseFloat(next.replace(',', '.'));
            if (Number.isFinite(v) && v > 0) {
              setPath(path, Math.min(1, Math.max(1e-12, v)));
            }
          }}
          onBlur={() => {
            focusedRef.current = false;
            setDraft(formatSci(getProjectPath(project, path)));
          }}
        />
        <i>m/s</i>
      </span>
    </label>
  );
};

export const QuickHRow: React.FC = () => {
  const { project, setTemplatePreset } = useAppStore();

  type QuickItem = {
    label: string;
    active: boolean;
    apply: () => void;
  };

  const items: QuickItem[] = [];
  if (project.tpl === 'B') {
    [4, 5, 6, 7, 8, 9, 10, 11, 12, 13].forEach((h) =>
      items.push({
        label: String(h),
        active: project.H === h * 100,
        apply: () => setTemplatePreset((meta) => presetCanti(h * 100, meta)),
      }),
    );
  } else if (project.tpl === 'C') {
    KE_HS.forEach(([H, i]) =>
      items.push({
        label: fmt(H / 100, 2),
        active: keFirst(project.keIdx) === i,
        apply: () => setTemplatePreset((meta) => presetKe(meta, i)),
      }),
    );
  } else if (project.tpl === 'D') {
    D_TAB.forEach((r, i) =>
      items.push({
        label:
          fmt(r.H / 100, 2) +
          (r.id === 'D60' ? ' · bản 1,0' : r.id === 'D60b' ? ' · bản 0,8' : ''),
        active: dIdxOf(project) === i,
        apply: () => setTemplatePreset((meta) => presetWall4(meta, i)),
      }),
    );
  }

  return (
    <div className="qh">
      <span className="lab">Kích thước nhanh – chiều cao H (m):</span>
      {items.length === 0 ? (
        <span className="hint">
          Mẫu 2 chỉ có một cỡ (h = 8,2 m); sửa kích thước ở mục &quot;Kích thước mặt cắt&quot; của
          tab Bản vẽ.
        </span>
      ) : (
        items.map((it) => (
          <button
            key={it.label}
            type="button"
            className={it.active ? 'on' : undefined}
            title="Nạp kích thước và cốt thép mặc định của mẫu ở chiều cao này"
            onClick={it.apply}
          >
            {it.label}
          </button>
        ))
      )}
    </div>
  );
};
