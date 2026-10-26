import { useMemo } from 'react';

// Wobbly closed curve around (cx, cy). Neighbouring rings use slowly shifting seeds,
// so a stack of them reads like the contour lines of a map.
function ringPath(cx, cy, radius, seed, amplitude) {
  const points = 120;
  let d = '';
  for (let i = 0; i < points; i++) {
    const t = (i / points) * Math.PI * 2;
    const wobble =
      1 +
      amplitude *
        (Math.sin(3 * t + seed) * 0.5 +
          Math.sin(5 * t + seed * 1.7) * 0.28 +
          Math.sin(2 * t + seed * 0.6) * 0.42);
    const x = cx + radius * wobble * Math.cos(t);
    const y = cy + radius * wobble * Math.sin(t) * 0.92;
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return `${d}Z`;
}

function buildRings({ cx, cy, count, from, to, seedStart, seedStep, amplitude }) {
  return Array.from({ length: count }, (_, i) => {
    const k = i / (count - 1);
    return {
      d: ringPath(cx, cy, from + (to - from) * k, seedStart + i * seedStep, amplitude),
      opacity: 0.25 + 0.7 * (1 - Math.abs(k - 0.45)),
    };
  });
}

// Decorative glowing topographic lines in brand greens.
export default function ContourArt({ className = '' }) {
  const rings = useMemo(
    () => [
      ...buildRings({ cx: 340, cy: 330, count: 26, from: 28, to: 300, seedStart: 0.4, seedStep: 0.1, amplitude: 0.2 }),
      ...buildRings({ cx: 560, cy: 470, count: 14, from: 24, to: 170, seedStart: 2.2, seedStep: 0.14, amplitude: 0.16 }),
    ],
    []
  );

  return (
    <svg viewBox="0 0 720 720" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="contour-stroke" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="50%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#a3e635" />
        </linearGradient>
        <filter id="contour-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      <g fill="none" stroke="url(#contour-stroke)" strokeLinejoin="round">
        <g filter="url(#contour-glow)" strokeWidth="4" opacity="0.55">
          {rings.map((r, i) => (
            <path key={`g${i}`} d={r.d} opacity={r.opacity} />
          ))}
        </g>
        <g strokeWidth="1.4">
          {rings.map((r, i) => (
            <path key={i} d={r.d} opacity={r.opacity} />
          ))}
        </g>
      </g>
    </svg>
  );
}
