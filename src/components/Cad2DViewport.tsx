import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { attachCadViewport, toSVG, type CadViewportController } from '../cad';
import { useAppStore } from '../state/appStore';

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
    <div
      id="stage"
      ref={stageRef}
      hidden={viewMode !== '2d'}
      dangerouslySetInnerHTML={{ __html: svgMarkup }}
    />
  );
};
