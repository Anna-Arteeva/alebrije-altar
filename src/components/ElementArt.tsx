import Image from "next/image";
import art from "@/content/element-art.json";
import type { ElementKey } from "@/lib/types";

// Painted art for each traditional element when it has been generated
// (scripts/generate-element-art.ts), otherwise a simple drawn glyph.

const painted = art as Partial<Record<ElementKey, string>>;

export function ElementArt({ element, size = 64 }: { element: ElementKey; size?: number }) {
  const src = painted[element];
  if (src) {
    return <Image src={src} alt="" width={size} height={size} className="object-contain" style={{ width: size, height: size }} />;
  }
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
      {GLYPHS[element]}
    </svg>
  );
}

const stroke = { stroke: "var(--ink)", strokeWidth: 1.5, strokeLinejoin: "round" as const };

const marigold = (cx: number, cy: number, r: number) => (
  <g key={`${cx}-${cy}`}>
    <circle cx={cx} cy={cy} r={r} fill="var(--marigold)" {...stroke} />
    <circle cx={cx} cy={cy} r={r * 0.62} fill="var(--marigold-deep)" />
    <circle cx={cx} cy={cy} r={r * 0.25} fill="var(--marigold)" />
  </g>
);

const GLYPHS: Record<ElementKey, React.ReactNode> = {
  cempasuchil: (
    <>
      <path d="M32 58 V40 M22 58 L28 42 M42 58 L36 42" stroke="var(--leaf)" strokeWidth="2.5" strokeLinecap="round" />
      {marigold(22, 30, 11)}
      {marigold(42, 30, 11)}
      {marigold(32, 18, 12)}
    </>
  ),
  candles: (
    <>
      {[
        [16, 30],
        [32, 22],
        [48, 34],
      ].map(([x, top]) => (
        <g key={x}>
          <rect x={x - 6} y={top} width="12" height={60 - top} rx="2" fill="var(--paper-raised)" {...stroke} />
          <path
            className="flicker"
            d={`M${x} ${top - 14} C ${x + 5} ${top - 8}, ${x + 4} ${top - 2}, ${x} ${top - 2} C ${x - 4} ${top - 2}, ${x - 5} ${top - 8}, ${x} ${top - 14} Z`}
            fill="var(--marigold)"
          />
        </g>
      ))}
    </>
  ),
  water: (
    <>
      <path d="M18 12 H46 L42 56 H22 Z" fill="var(--paper-raised)" {...stroke} />
      <path d="M19.5 26 H44.5 L42 54 H22 Z" fill="var(--turquesa)" opacity="0.55" />
      <path d="M24 30 L25 48" stroke="var(--paper-raised)" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  salt: (
    <>
      <path d="M14 40 Q32 30 50 40" fill="var(--paper-raised)" {...stroke} />
      <path d="M8 40 H56 Q52 54 32 54 Q12 54 8 40 Z" fill="var(--rosa)" {...stroke} />
      <path d="M16 44 H48" stroke="var(--marigold)" strokeWidth="2" strokeDasharray="2 4" />
    </>
  ),
  copal: (
    <>
      <path d="M26 30 C 22 24, 34 20, 30 14 M36 30 C 32 22, 42 18, 38 10" stroke="var(--ink-faint)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M14 34 H50 Q48 50 32 50 Q16 50 14 34 Z" fill="var(--marigold-deep)" {...stroke} />
      <rect x="28" y="50" width="8" height="8" fill="var(--marigold-deep)" {...stroke} />
      <path d="M18 40 H46" stroke="var(--paper-raised)" strokeWidth="1.5" strokeDasharray="3 3" />
    </>
  ),
  papel_picado: (
    <>
      <path d="M6 10 H58" {...stroke} />
      <path d="M12 10 H52 V48 L47 54 L42 48 L37 54 L32 48 L27 54 L22 48 L17 54 L12 48 Z" fill="var(--rosa)" />
      <circle cx="32" cy="27" r="6" fill="var(--paper)" />
      {[20, 44].map((x) => (
        <rect key={x} x={x - 3} y="38" width="6" height="6" fill="var(--paper)" transform={`rotate(45 ${x} 41)`} />
      ))}
    </>
  ),
  pan_de_muerto: (
    <>
      <path d="M8 46 Q8 22 32 20 Q56 22 56 46 Z" fill="var(--marigold-deep)" {...stroke} />
      <path d="M14 34 Q32 26 50 34 M32 20 V44" stroke="var(--bread-mark)" strokeWidth="4" strokeLinecap="round" fill="none" />
      <circle cx="32" cy="19" r="4" fill="var(--bread-mark)" />
      <path d="M6 46 H58" {...stroke} />
    </>
  ),
  calaveritas: (
    <>
      <path d="M14 30 Q14 12 32 12 Q50 12 50 30 Q50 38 44 42 V50 H20 V42 Q14 38 14 30 Z" fill="var(--paper-raised)" {...stroke} />
      <circle cx="25" cy="30" r="5" fill="var(--turquesa)" />
      <circle cx="39" cy="30" r="5" fill="var(--rosa)" />
      <path d="M32 36 L30 40 H34 Z" fill="var(--ink)" />
      <path d="M24 46 V50 M28 46 V50 M32 46 V50 M36 46 V50 M40 46 V50" stroke="var(--ink)" strokeWidth="1.2" />
      <circle cx="32" cy="19" r="2.5" fill="var(--marigold)" />
    </>
  ),
};
