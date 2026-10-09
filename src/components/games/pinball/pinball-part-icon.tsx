import type { PinballPartId } from "@/lib/games/pinball/stage";

/** 部品の小さな絵（ショップとエディターの部品えらびに出す） */
export function PinballPartIcon({ part, className, accent = "#ff8a80" }: { part: PinballPartId; className?: string; accent?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      {part === "bumper" ? (
        <>
          <circle cx="20" cy="20" r="15" fill={accent} stroke="#ffffff" strokeWidth="3" />
          <circle cx="20" cy="20" r="7" fill="#ffffff" fillOpacity="0.85" />
        </>
      ) : part === "pinwheel" ? (
        <g stroke="#ffd166" strokeWidth="4.5" strokeLinecap="round">
          <line x1="6" y1="20" x2="34" y2="20" />
          <line x1="20" y1="6" x2="20" y2="34" />
          <circle cx="20" cy="20" r="4" fill="#ffd166" />
        </g>
      ) : part === "post" ? (
        <>
          <circle cx="13" cy="20" r="6" fill="#cfd8e3" stroke="#3a4250" strokeWidth="2" />
          <circle cx="28" cy="20" r="6" fill="#cfd8e3" stroke="#3a4250" strokeWidth="2" />
        </>
      ) : part === "peg" ? (
        <g fill={accent}>
          {[
            [10, 12],
            [20, 12],
            [30, 12],
            [15, 21],
            [25, 21],
            [10, 30],
            [20, 30],
            [30, 30],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="2.6" />
          ))}
        </g>
      ) : part === "sling" ? (
        <>
          <path d="M14 6 L8 20 L14 34 Z" fill={accent} fillOpacity="0.7" stroke="#ffffff" strokeWidth="2" strokeLinejoin="round" />
          <path d="M14 6 L14 34" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M20 20 L32 20 M27 15 L32 20 L27 25" stroke="#ffd166" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : part === "ramp_top" ? (
        <>
          <path d="M9 36 L9 18 Q9 6 22 6 L30 6" stroke={accent} strokeOpacity="0.55" strokeWidth="7" fill="none" strokeLinecap="round" />
          <path d="M28 2 L34 6 L28 10" stroke="#ffffff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="31" cy="20" r="4" fill="#ffffff" />
        </>
      ) : (
        <>
          <path d="M8 36 L8 26 L32 6" stroke={accent} strokeOpacity="0.55" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M32 36 L32 26 L8 6" stroke="#ffd166" strokeOpacity="0.7" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}
