import React, { useEffect, useState } from 'react';

export interface StatusBarProps {
  statusMessage: string;
  progress: number;
  isRunning: boolean;
}

export function StatusBar({
  statusMessage,
  progress,
  isRunning,
}: StatusBarProps): React.ReactElement {
  const [keys, setKeys] = useState({
    caps: false,
    num: true,
    scrl: false,
    ovr: false,
  });

  useEffect(() => {
    const syncKeys = (ev: KeyboardEvent) => {
      if (typeof ev.getModifierState === 'function') {
        setKeys((prev) => ({
          caps: ev.getModifierState('CapsLock'),
          num: ev.getModifierState('NumLock'),
          scrl: ev.getModifierState('ScrollLock'),
          ovr: ev.key === 'Insert' ? !prev.ovr : prev.ovr,
        }));
      }
    };
    window.addEventListener('keydown', syncKeys);
    window.addEventListener('keyup', syncKeys);
    return () => {
      window.removeEventListener('keydown', syncKeys);
      window.removeEventListener('keyup', syncKeys);
    };
  }, []);

  return (
    <footer className="adm-statusbar" role="status" aria-live="polite" data-testid="status-bar">
      <div className="adm-status-text" data-testid="status-message">
        {statusMessage}
      </div>
      <div className="adm-status-progress-wrap" title="Tiến trình kiểm toán">
        <div className="adm-status-progress-track">
          <div
            className="adm-status-progress-fill"
            style={{ width: `${isRunning || progress > 0 ? Math.min(100, Math.max(0, progress)) : 0}%` }}
          />
        </div>
      </div>
      <div className="adm-status-keys">
        <span className={`adm-status-key ${keys.caps ? 'on' : ''}`}>CAPS</span>
        <span className={`adm-status-key ${keys.num ? 'on' : ''}`}>NUM</span>
        <span className={`adm-status-key ${keys.scrl ? 'on' : ''}`}>SCRL</span>
        <span className="adm-status-key on">{keys.ovr ? 'OVR' : 'INS'}</span>
      </div>
    </footer>
  );
}
