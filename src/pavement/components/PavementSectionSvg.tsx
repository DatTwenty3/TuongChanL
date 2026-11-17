import { fmt } from '../engine';

export interface SectionLayerItem {
  name: string;
  thicknessCm: number;
  mat: 'concrete' | 'bound' | 'gran';
  detailText: string;
}

interface PavementSectionSvgProps {
  idPrefix: string;
  layers: SectionLayerItem[];
  subgradeText?: string;
  loadMode: 'pmax' | 'ptt' | 'none';
  loadValueKn?: number;
  concreteSurfaceDetail?: boolean;
  showTotalDim?: boolean;
  padT?: number;
  availH?: number;
  minH?: number;
  soilH?: number;
}

const FILLS: Record<SectionLayerItem['mat'], string> = {
  concrete: 'var(--c-concrete)',
  bound: 'var(--c-bound)',
  gran: 'var(--c-gran)',
};

export function PavementSectionSvg({
  idPrefix,
  layers,
  subgradeText,
  loadMode,
  loadValueKn = 0,
  concreteSurfaceDetail = false,
  showTotalDim = true,
  padT = 46,
  availH = 300,
  minH = 30,
  soilH = 66,
}: PavementSectionSvgProps) {
  const W = 640;
  const padB = 20;
  const x0 = 128;
  const w = 236;
  const totalCm = layers.reduce((s, l) => s + Math.max(0, l.thicknessCm), 0) || 1;
  const heights = layers.map((l) => Math.max(minH, (Math.max(0, l.thicknessCm) / totalCm) * availH));
  const totalH = heights.reduce((a, b) => a + b, 0);
  const H = padT + totalH + soilH + padB;
  const cx = x0 + w * 0.42;

  const hatchId = `${idPrefix}hatchB`;
  const dotId = `${idPrefix}dotG`;
  const soilId = `${idPrefix}soilP`;
  const arId = `${idPrefix}ar`;
  const arSId = `${idPrefix}arS`;
  const arEId = `${idPrefix}arE`;

  let zigPath = '';
  if (concreteSurfaceDetail) {
    zigPath = `M${x0} ${padT + 3}`;
    for (let xx = x0; xx < x0 + w; xx += 8) {
      zigPath += ' l4 -3 l4 3';
    }
  }

  let curY = padT;
  const layerEls = layers.map((l, idx) => {
    const y = curY;
    const h = heights[idx];
    const my = y + h / 2;
    const jx = x0 + w * 0.72;
    curY += h;
    return (
      <g key={`${l.name}-${idx}`}>
        <rect x={x0} y={y} width={w} height={h} fill={FILLS[l.mat]} stroke="#7c8894" strokeWidth={1} />
        {l.mat === 'bound' && <rect x={x0} y={y} width={w} height={h} fill={`url(#${hatchId})`} />}
        {l.mat === 'gran' && <rect x={x0} y={y} width={w} height={h} fill={`url(#${dotId})`} />}
        {concreteSurfaceDetail && l.mat === 'concrete' && (
          <>
            <path d={zigPath} stroke="#b9bbb4" strokeWidth={1} fill="none" />
            <line x1={jx} y1={y - 1} x2={jx} y2={y + h * 0.5} stroke="#6b7681" strokeWidth={1.6} />
            <rect x={jx - 2} y={y - 1} width={4} height={3} fill="#3a4650" />
          </>
        )}
        <line x1={x0 + w} y1={my} x2={x0 + w + 22} y2={my} stroke="#9aa4ad" strokeWidth={1} />
        <text x={x0 + w + 27} y={my - 2} fontSize={loadMode === 'none' ? 11 : 11.5} fontWeight={650} fill="var(--ink)">
          {l.name}
        </text>
        <text x={x0 + w + 27} y={my + 11} fontSize={10.5} fill="var(--muted)" fontFamily="var(--mono)">
          {l.detailText}
        </text>
        {showTotalDim && <line x1={x0 - 10} y1={y} x2={x0} y2={y} stroke="#aab3bb" strokeWidth={1} />}
      </g>
    );
  });

  const soilY = curY;
  const smy = soilY + soilH / 2;
  const dx = x0 - 24;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', maxWidth: `${W}px`, height: 'auto', display: 'block' }}
      xmlns="http://www.w3.org/2000/svg"
      fontFamily="var(--sans)"
    >
      <defs>
        <pattern id={hatchId} width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="7" stroke="#9aa07f" strokeWidth="1.1" />
        </pattern>
        <pattern id={dotId} width="10" height="10" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.5" fill="#b79b6f" />
          <circle cx="8" cy="8" r="1.2" fill="#b79b6f" />
        </pattern>
        <pattern id={soilId} width="14" height="9" patternUnits="userSpaceOnUse">
          <path d="M0 9 L4 4 M7 9 L11 4" stroke="#a98a5c" strokeWidth="1" />
        </pattern>
        <marker id={arId} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0 0 L6 3 L0 6 z" fill="var(--ink)" />
        </marker>
        <marker id={arSId} markerWidth="7" markerHeight="7" refX="0" refY="3" orient="auto">
          <path d="M6 0 L0 3 L6 6 z" fill="var(--muted)" />
        </marker>
        <marker id={arEId} markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
          <path d="M0 0 L6 3 L0 6 z" fill="var(--muted)" />
        </marker>
      </defs>

      {loadMode !== 'none' && (
        <>
          <rect x={cx - 26} y={10} width={52} height={15} rx={3} fill="#2b3946" />
          <text x={cx} y={21} fill="#fff" fontSize={10} fontWeight={700} textAnchor="middle">
            {loadMode === 'pmax' ? (loadValueKn ? 'P/' : 'P') : 'P'}
          </text>
          <line x1={cx} y1={25} x2={cx} y2={padT - 2} stroke="var(--ink)" strokeWidth={2.2} markerEnd={`url(#${arId})`} />
          {loadMode === 'pmax' ? (
            <text x={cx + 34} y={20} fill="var(--muted)" fontSize={10.5}>
              Trục xe P
              <tspan fontSize={8} dy={2}>
                max
              </tspan>
              ={loadValueKn} kN
            </text>
          ) : (
            <text x={cx + 34} y={20} fill="var(--muted)" fontSize={10.5}>
              P
              <tspan fontSize={8} dy={2}>
                tt
              </tspan>{' '}
              = {loadValueKn} kN
            </text>
          )}
        </>
      )}

      {layerEls}

      <rect x={x0} y={soilY} width={w} height={soilH} fill="var(--c-soil)" stroke="#7c8894" strokeWidth={1} />
      <rect x={x0} y={soilY} width={w} height={soilH} fill={`url(#${soilId})`} />
      <line x1={x0 + w} y1={smy} x2={x0 + w + 22} y2={smy} stroke="#9aa4ad" strokeWidth={1} />
      <text x={x0 + w + 27} y={smy - 2} fontSize={loadMode === 'none' ? 11 : 11.5} fontWeight={650} fill="var(--ink)">
        Nền đất
      </text>
      {subgradeText && (
        <text x={x0 + w + 27} y={smy + 11} fontSize={10.5} fill="var(--muted)" fontFamily="var(--mono)">
          {subgradeText}
        </text>
      )}
      {showTotalDim && (
        <>
          <line x1={x0 - 10} y1={soilY} x2={x0} y2={soilY} stroke="#aab3bb" strokeWidth={1} />
          <line
            x1={dx}
            y1={padT}
            x2={dx}
            y2={soilY}
            stroke="var(--muted)"
            strokeWidth={1}
            markerStart={`url(#${arSId})`}
            markerEnd={`url(#${arEId})`}
          />
          <text
            x={dx - 6}
            y={(padT + soilY) / 2}
            fontSize={10.5}
            fill="var(--muted)"
            fontFamily="var(--mono)"
            textAnchor="middle"
            transform={`rotate(-90 ${dx - 6} ${(padT + soilY) / 2})`}
          >
            Σh = {fmt(totalCm, 0)} cm
          </text>
        </>
      )}
    </svg>
  );
}
