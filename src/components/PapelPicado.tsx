import { useId } from "react";

// A string of cut tissue-paper flags. Purely decorative.

const COLORS = ["var(--rosa)", "var(--marigold)", "var(--turquesa)", "var(--marigold-deep)", "var(--indigo)"];

export function PapelPicado({ flags = 9, className = "" }: { flags?: number; className?: string }) {
  const maskId = useId();
  const width = flags * 64;

  return (
    <svg
      viewBox={`0 0 ${width} 92`}
      className={`block w-full ${className}`}
      preserveAspectRatio="xMidYMin meet"
      aria-hidden
    >
      <defs>
        <mask id={maskId} maskContentUnits="objectBoundingBox">
          <rect width="1" height="1" fill="var(--mask-reveal)" />
          {/* flower in the middle */}
          <circle cx="0.5" cy="0.42" r="0.09" fill="var(--mask-cutout)" />
          {[0, 60, 120, 180, 240, 300].map((deg) => (
            <ellipse
              key={deg}
              cx="0.5"
              cy="0.24"
              rx="0.06"
              ry="0.1"
              fill="var(--mask-cutout)"
              transform={`rotate(${deg} 0.5 0.42)`}
            />
          ))}
          {/* border of small diamonds */}
          {[0.15, 0.32, 0.5, 0.68, 0.85].map((x) => (
            <rect key={x} x={x - 0.03} y="0.06" width="0.06" height="0.06" fill="var(--mask-cutout)" transform={`rotate(45 ${x} 0.09)`} />
          ))}
          {[0.2, 0.4, 0.6, 0.8].map((x) => (
            <circle key={x} cx={x} cy="0.74" r="0.035" fill="var(--mask-cutout)" />
          ))}
        </mask>
      </defs>
      <path d={`M0 6 Q ${width / 2} 16 ${width} 6`} stroke="var(--ink-soft)" strokeWidth="1.5" fill="none" />
      {Array.from({ length: flags }, (_, i) => {
        const x = i * 64 + 4;
        const sag = Math.sin((i / (flags - 1)) * Math.PI) * 9;
        return (
          <g key={i} transform={`translate(${x} ${6 + sag})`}>
            <path
              className="sway"
              style={{ animationDelay: `${-i * 0.7}s` }}
              d="M0 0 H56 V64 L49 72 L42 64 L35 72 L28 64 L21 72 L14 64 L7 72 L0 64 Z"
              fill={COLORS[i % COLORS.length]}
              mask={`url(#${maskId})`}
              opacity="0.95"
            />
          </g>
        );
      })}
    </svg>
  );
}
