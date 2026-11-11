import React from 'react';
import { useAppStore } from '../state/appStore';

export const ToastBanner: React.FC = () => {
  const { toast, dismissToast } = useAppStore();

  const className = toast ? `show ${toast.kind}`.trim() : '';

  return (
    <div id="toast" role="status" aria-live="polite" className={className}>
      {toast ? (
        <>
          <span>{toast.msg}</span>
          {toast.kind !== 'wait' ? (
            <>
              {' '}
              <button type="button" className="tact" onClick={dismissToast}>
                Đóng
              </button>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
};
