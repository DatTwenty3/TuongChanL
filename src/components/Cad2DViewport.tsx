import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { attachCadViewport, toSVG, type CadViewportController } from '../cad';
import { useAppStore } from '../state/appStore';
import { Icon } from './Icon';

export const Cad2DViewport: React.FC = () => {
  const { viewMode, curSheet, getSheet, fitNonce } = useAppStore();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const ctrlRef = useRef<CadViewportController | null>(null);
  const lastKeyRef = useRef<string>('');
  const prevFitNonceRef = useRef<number>(fitNonce);

  const sheet = getSheet(curSheet);
  const sheetRef = useRef(sheet);
  sheetRef.current = sheet;

  const svgMarkup = useMemo(() => toSVG(sheet), [sheet]);
  const sheetKey = `${curSheet}|${sheet.W}|${sheet.H}`;

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ctrl = attachCadViewport(el, () => sheetRef.current);
    ctrlRef.current = ctrl;
    return () => {
      ctrl.dispose();
      ctrlRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const ctrl = ctrlRef.current;
    if (!ctrl) return;
    if (lastKeyRef.current !== sheetKey || prevFitNonceRef.current !== fitNonce) {
      lastKeyRef.current = sheetKey;
      prevFitNonceRef.current = fitNonce;
      ctrl.fit();
      return;
    }
    const vb = ctrl.getViewBox();
    if (vb) {
      ctrl.setViewBox(vb);
    } else {
      ctrl.fit();
    }
  }, [svgMarkup, sheetKey, fitNonce]);

  return (
    <>
      <div
        id="stage"
        ref={stageRef}
        hidden={viewMode !== '2d'}
        dangerouslySetInnerHTML={{ __html: svgMarkup }}
      />
      <div className="zoomctl" hidden={viewMode !== '2d'}>
        <button
          id="bZoomIn"
          type="button"
          aria-label="Phóng to"
          title="Phóng to"
          onClick={() => ctrlRef.current?.zoomBy(0.7)}
        >
          <Icon name="plus" size={18} />
        </button>
        <button
          id="bZoomOut"
          type="button"
          aria-label="Thu nhỏ"
          title="Thu nhỏ"
          onClick={() => ctrlRef.current?.zoomBy(1 / 0.7)}
        >
          <Icon name="minus" size={18} />
        </button>
        <button
          id="bZoomFit"
          type="button"
          aria-label="Vừa khung"
          title="Vừa khung"
          onClick={() => ctrlRef.current?.fit()}
        >
          <Icon name="fit" size={17} />
        </button>
      </div>
    </>
  );
};
