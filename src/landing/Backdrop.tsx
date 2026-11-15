import React, { useEffect, useRef } from 'react';

/** Đường sóng ngang: các nửa sóng bậc hai từ x0, đủ dài để trượt đúng một chu kỳ rồi lặp liền mạch. */
function wavePath(y: number, amp: number, period: number): string {
  const half = period / 2;
  const n = Math.ceil((1200 + 3 * period) / half);
  return `M${-period * 1.5} ${y} q${half / 2} ${-2 * amp} ${half} 0` + ` t${half} 0`.repeat(n);
}

/** Các đường đồng mức trôi ngang: [y, biên độ, chu kỳ, giây / chu kỳ, lớp màu, chiều]. */
const WAVES: [number, number, number, number, 'a' | 'b' | 'c', 1 | -1][] = [
  [110, 26, 520, 26, 'a', 1],
  [170, 34, 640, 34, 'b', -1],
  [235, 22, 460, 22, 'c', 1],
  [520, 30, 600, 30, 'a', -1],
  [585, 38, 720, 38, 'b', 1],
  [650, 26, 540, 28, 'c', -1],
  [715, 32, 680, 36, 'a', 1],
];

/** Đường chuyền (đa giác nét đứt) có một điểm chạy dọc theo. */
const TRAVERSE = 'M210 300 L 380 640 L 760 600 L 930 250 Z';
const STATIONS: [number, number, number][] = [
  [210, 300, 0],
  [930, 250, 0.8],
  [760, 600, 1.6],
  [380, 640, 2.2],
];

/**
 * Nền động kiểu bản đồ của trang chủ LEDAT-GIS: vệt màu aurora trôi chậm, lưới mờ, đường đồng mức chảy ngang,
 * đường chuyền nét đứt có điểm chạy, và hiệu ứng thị sai nhẹ theo chuột. Khi người dùng chọn giảm chuyển động
 * thì sóng và aurora vẫn chạy nhưng rất chậm, điểm chạy và thị sai tắt (xem landing.css).
 */
export const Backdrop: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        el.style.setProperty('--mx', (e.clientX / window.innerWidth - 0.5).toFixed(3));
        el.style.setProperty('--my', (e.clientY / window.innerHeight - 0.5).toFixed(3));
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  return (
    <div ref={ref} aria-hidden="true" className="bd">
      <div className="bd-par" style={{ ['--depth' as string]: '-28px' }}>
        <div className="bd-aurora bd-aurora-a" />
        <div className="bd-aurora bd-aurora-b" />
        <div className="bd-aurora bd-aurora-c" />
      </div>
      <div className="bd-par bd-par-svg" style={{ ['--depth' as string]: '14px' }}>
        <svg className="bd-drift" viewBox="0 0 1200 760" preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern id="bd-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M40 0H0V40" className="bd-gridline" fill="none" strokeWidth="1" />
            </pattern>
            <radialGradient id="bd-fade" cx="50%" cy="45%" r="60%">
              <stop offset="0%" className="bd-fade-stop" stopOpacity="0.9" />
              <stop offset="55%" className="bd-fade-stop" stopOpacity="0.3" />
              <stop offset="100%" className="bd-fade-stop" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="1200" height="760" fill="url(#bd-grid)" />
          {WAVES.map(([y, amp, period, secs, tone, dir], k) => (
            <g key={k} className="bd-in" style={{ animationDelay: `${0.15 + k * 0.15}s` }}>
              <path
                d={wavePath(y, amp, period)}
                fill="none"
                strokeWidth="1.5"
                className={`bd-wave bd-wave-${tone}`}
                style={{
                  ['--period' as string]: `${dir * period}px`,
                  animationDuration: `${secs}s`,
                  animationDelay: `${-k * 3}s`,
                }}
              />
            </g>
          ))}
          <path d={TRAVERSE} fill="none" className="bd-traverse" strokeDasharray="4 6" strokeWidth="1.2" />
          <g className="bd-traveller">
            <circle r="9" className="bd-dot" opacity="0.15" />
            <circle r="3.5" className="bd-dot" />
            <animateMotion dur="16s" repeatCount="indefinite" path={TRAVERSE} />
          </g>
          {STATIONS.map(([x, y, delay]) => (
            <g key={`${x}-${y}`}>
              <circle cx={x} cy={y} r="5" className="bd-ping bd-dot" style={{ animationDelay: `${delay}s` }} />
              <circle cx={x} cy={y} r="4" className="bd-station" strokeWidth="2" />
            </g>
          ))}
          <rect width="1200" height="760" fill="url(#bd-fade)" />
        </svg>
      </div>
    </div>
  );
};
