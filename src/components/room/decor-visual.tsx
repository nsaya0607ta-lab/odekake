"use client";

/** わんこのおへやに置いたもの1つの見た目（図鑑アイテム・額縁の写真・トロフィー・ペナント） */
import type { DecorEntry, FrameStyle, FurnitureId } from "@/lib/room/types";

const FRAME_LOOK: Record<FrameStyle, { label: string; border: string; pad: string; bottom: string }> = {
  wood: { label: "木", border: "border-[6px] border-[#B98A57]", pad: "p-[3px] bg-[#FFFAF0]", bottom: "" },
  white: { label: "白", border: "border-[6px] border-white", pad: "p-0", bottom: "" },
  polaroid: { label: "ポラ", border: "border-[5px] border-white", pad: "p-0 bg-white", bottom: "pb-[18%]" },
  gold: { label: "金", border: "border-[6px] border-[#D9AE4A]", pad: "p-[3px] bg-[#FFF6DA]", bottom: "" },
};
export const FRAME_LABELS = Object.fromEntries(Object.entries(FRAME_LOOK).map(([k, v]) => [k, v.label])) as Record<FrameStyle, string>;

export function DecorVisual({ entry, frame = "wood", thumb = false, lit = false }: { entry: DecorEntry; frame?: FrameStyle; thumb?: boolean; lit?: boolean }) {
  const label = thumb ? undefined : entry.name;
  if (entry.kind === "furniture") return <Furniture id={entry.furniture} label={label} lit={lit} />;
  if (entry.kind === "item") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={entry.image} alt={label ?? ""} draggable={false} className="pointer-events-none block h-auto w-full select-none object-contain drop-shadow-[0_5px_3px_rgba(68,50,33,.22)]" />;
  }
  if (entry.kind === "photo") {
    const look = FRAME_LOOK[frame];
    return (
      <span data-frame className={`pointer-events-none block w-full rounded-[3px] shadow-[0_6px_8px_rgba(50,35,20,.28)] ${look.border} ${look.pad} ${look.bottom}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={entry.image} alt={label ?? ""} draggable={false} className="block aspect-[4/3] w-full select-none object-cover" />
      </span>
    );
  }
  if (entry.kind === "trophy") {
    return (
      <svg viewBox="0 0 96 110" className="pointer-events-none block h-auto w-full drop-shadow-[0_5px_3px_rgba(68,50,33,.25)]" role={label ? "img" : undefined} aria-label={label ? `${entry.name} ランク${entry.rank}のトロフィー` : undefined}>
        <defs>
          <linearGradient id={`cup-${entry.key}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={entry.color} />
            <stop offset="0.45" stopColor="#FFFFFF" stopOpacity="0.85" />
            <stop offset="0.6" stopColor={entry.color} />
            <stop offset="1" stopColor={entry.color} />
          </linearGradient>
        </defs>
        <path d="M30 10h36v10c0 16-7 27-18 29-11-2-18-13-18-29z" fill={`url(#cup-${entry.key})`} stroke="rgba(60,40,20,.35)" strokeWidth="1.4" />
        <path d="M30 15h-9c0 10 5 17 12 18M66 15h9c0 10-5 17-12 18" fill="none" stroke={entry.color} strokeWidth="4.5" strokeLinecap="round" />
        <rect x="44" y="48" width="8" height="12" fill={entry.color} stroke="rgba(60,40,20,.3)" strokeWidth="1" />
        <rect x="32" y="59" width="32" height="8" rx="2" fill="#8A5A34" />
        <rect x="24" y="67" width="48" height="34" rx="4" fill="#6A4426" />
        <rect x="28" y="71" width="40" height="26" rx="2" fill="#7E5432" />
        <text x="48" y="36" textAnchor="middle" fontSize="16" fontWeight="900" fill="#fff" stroke="rgba(60,40,20,.5)" strokeWidth=".8">{entry.rank}</text>
        <text x="48" y="82" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#FFE7B8">{entry.stage}</text>
        <text x="48" y="93" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#FFE7B8">{entry.score.toLocaleString("ja-JP")}点</text>
      </svg>
    );
  }
  const name = entry.name.replace(/(県|府|都)$/, "");
  return (
    <svg viewBox="0 0 120 70" className="pointer-events-none block h-auto w-full drop-shadow-[0_4px_3px_rgba(68,50,33,.22)]" role={label ? "img" : undefined} aria-label={label ? `${entry.name}のペナント` : undefined}>
      <rect x="4" y="4" width="5" height="62" rx="2.5" fill="#8A5A34" />
      <path d="M9 7 L116 35 L9 63 Z" fill={entry.color} />
      <path d="M9 7 L116 35 L9 63 Z" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M14 13 L104 35 L14 57" fill="none" stroke="#FFF3CF" strokeWidth="1.2" strokeDasharray="3 3" />
      <text x="28" y="41" textAnchor="middle" fontSize="17">{entry.emoji}</text>
      <text x="62" y="40" textAnchor="middle" fontSize={name.length > 3 ? 11 : 13} fontWeight="900" fill="#fff">{name}</text>
    </svg>
  );
}

const SVG_CLASS = "pointer-events-none block h-auto w-full drop-shadow-[0_6px_4px_rgba(68,50,33,.22)]";

/** 家具の絵。lit はランプの明かり（夕方・夜） */
function Furniture({ id, label, lit }: { id: FurnitureId; label?: string; lit: boolean }) {
  const a11y = label ? { role: "img" as const, "aria-label": label } : {};
  switch (id) {
    case "sofa":
      return (
        <svg viewBox="0 0 220 120" className={SVG_CLASS} {...a11y}>
          <rect x="18" y="20" width="184" height="62" rx="22" fill="#D9806B" />
          <rect x="30" y="28" width="78" height="46" rx="16" fill="#E8977F" />
          <rect x="112" y="28" width="78" height="46" rx="16" fill="#E8977F" />
          <rect x="22" y="66" width="176" height="34" rx="12" fill="#C96F5A" />
          <rect x="34" y="62" width="74" height="22" rx="10" fill="#F0A48C" />
          <rect x="112" y="62" width="74" height="22" rx="10" fill="#F0A48C" />
          <rect x="2" y="44" width="32" height="56" rx="14" fill="#C2644F" />
          <rect x="186" y="44" width="32" height="56" rx="14" fill="#C2644F" />
          <rect x="34" y="100" width="8" height="16" rx="2" fill="#7A4A2E" />
          <rect x="178" y="100" width="8" height="16" rx="2" fill="#7A4A2E" />
          <rect x="140" y="40" width="34" height="26" rx="8" fill="#FFF3D6" transform="rotate(-10 157 53)" />
          <circle cx="157" cy="53" r="5" fill="#F2B8C6" transform="rotate(-10 157 53)" />
        </svg>
      );
    case "dog-bed":
      return (
        <svg viewBox="0 0 160 80" className={SVG_CLASS} {...a11y}>
          <ellipse cx="80" cy="50" rx="76" ry="28" fill="#7FA6D6" />
          <ellipse cx="80" cy="46" rx="62" ry="20" fill="#F6EFE2" />
          <ellipse cx="80" cy="44" rx="50" ry="14" fill="#FFFAF0" />
          <path d="M8 46 Q80 86 152 46" fill="none" stroke="#6A93C6" strokeWidth="6" strokeLinecap="round" />
          {[30, 60, 100, 130].map((x) => <circle key={x} cx={x} cy={62} r="3" fill="#FFFFFF" opacity="0.7" />)}
        </svg>
      );
    case "plant":
      return (
        <svg viewBox="0 0 90 150" className={SVG_CLASS} {...a11y}>
          {[[-38, 0], [-12, -6], [14, -4], [36, 4], [-28, 20], [26, 22]].map(([r, dy], i) => (
            <g key={i} transform={`translate(45 ${84 + dy!}) rotate(${r})`}>
              <path d="M0 0 C -14 -24, -12 -54, 0 -66 C 12 -54, 14 -24, 0 0 Z" fill={i % 2 ? "#5E9C52" : "#73B062"} />
              <path d="M0 -4 L0 -60" stroke="#4A7E40" strokeWidth="1.6" />
            </g>
          ))}
          <path d="M22 96 L68 96 L62 146 L28 146 Z" fill="#C98F5A" />
          <rect x="18" y="90" width="54" height="12" rx="4" fill="#B57A48" />
        </svg>
      );
    case "bookshelf":
      return (
        <svg viewBox="0 0 120 170" className={SVG_CLASS} {...a11y}>
          <rect x="4" y="4" width="112" height="162" rx="5" fill="#A8723F" />
          <rect x="12" y="12" width="96" height="146" fill="#8A5A30" />
          {[56, 106].map((y) => <rect key={y} x="12" y={y} width="96" height="6" fill="#A8723F" />)}
          {[[14, 22, "#D9806B"], [26, 18, "#7FA6D6"], [38, 26, "#F2D16B"], [52, 20, "#8CBF7A"], [66, 24, "#B65A7A"], [80, 18, "#E8C99A"]].map(([x, h, c]) => <rect key={`a${x}`} x={x as number} y={56 - 26 - (h as number) + 22} width="11" height={h as number + 4} fill={c as string} />)}
          {[[16, "#8DBDE6"], [30, "#F2A7B8"], [44, "#C7B4D9"]].map(([x, c]) => <rect key={`b${x}`} x={x as number} y="76" width="12" height="30" fill={c as string} />)}
          <circle cx="88" cy="92" r="11" fill="#73B062" />
          <rect x="82" y="96" width="12" height="10" fill="#C98F5A" />
          {[[16, "#F2D16B"], [30, "#D9806B"], [64, "#7FA6D6"], [78, "#8CBF7A"], [92, "#E8977F"]].map(([x, c]) => <rect key={`c${x}`} x={x as number} y="128" width="12" height="30" fill={c as string} />)}
          <rect x="44" y="140" width="18" height="18" rx="3" fill="#FFF3D6" />
        </svg>
      );
    case "lamp":
      return (
        <svg viewBox="0 0 70 190" className={SVG_CLASS} style={{ overflow: "visible" }} {...a11y}>
          {lit ? <ellipse cx="35" cy="40" rx="70" ry="60" fill="#FFE3A3" opacity="0.35" /> : null}
          <path d="M12 52 L58 52 L48 12 L22 12 Z" fill={lit ? "#FFE9B0" : "#F2E2C2"} stroke="#C9A878" strokeWidth="2" />
          {lit ? <ellipse cx="35" cy="54" rx="20" ry="5" fill="#FFF6D0" /> : null}
          <rect x="33" y="52" width="4" height="122" fill="#6A5A4A" />
          <ellipse cx="35" cy="178" rx="22" ry="7" fill="#5A4A3A" />
        </svg>
      );
    case "table":
      return (
        <svg viewBox="0 0 170 90" className={SVG_CLASS} {...a11y}>
          <ellipse cx="85" cy="30" rx="80" ry="20" fill="#C98F5A" />
          <ellipse cx="85" cy="26" rx="80" ry="20" fill="#E3B888" />
          <rect x="30" y="34" width="8" height="50" rx="3" fill="#A8723F" />
          <rect x="132" y="34" width="8" height="50" rx="3" fill="#A8723F" />
          <rect x="80" y="40" width="10" height="46" rx="3" fill="#946234" />
          <path d="M62 8 L76 8 L74 24 L64 24 Z" fill="#FFFFFF" stroke="#D9CDB8" />
          <path d="M76 12 q8 2 0 8" fill="none" stroke="#D9CDB8" strokeWidth="2" />
          <ellipse cx="108" cy="20" rx="14" ry="5" fill="#F6EFE2" />
          {[100, 108, 116].map((x) => <circle key={x} cx={x} cy={17} r="3.2" fill="#D9A36A" />)}
        </svg>
      );
    case "dog-house":
      return (
        <svg viewBox="0 0 170 160" className={SVG_CLASS} {...a11y}>
          <rect x="22" y="62" width="126" height="92" fill="#E8B07A" />
          {[78, 96, 114, 132].map((y) => <rect key={y} x="22" y={y} width="126" height="2" fill="#C98F5A" opacity="0.6" />)}
          <path d="M6 70 L85 8 L164 70 L150 78 L85 26 L20 78 Z" fill="#C2453A" />
          <path d="M60 154 L60 112 Q85 84 110 112 L110 154 Z" fill="#4A3220" />
          <rect x="62" y="44" width="46" height="16" rx="4" fill="#FFF6E4" />
          <text x="85" y="56" textAnchor="middle" fontSize="11" fontWeight="900" fill="#7A4A2E">わんこ</text>
          <ellipse cx="85" cy="154" rx="70" ry="6" fill="#000" opacity="0.08" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 80 44" className={SVG_CLASS} {...a11y}>
          <path d="M6 14 L74 14 L64 40 L16 40 Z" fill="#7FA6D6" />
          <ellipse cx="40" cy="14" rx="34" ry="8" fill="#9DBDE6" />
          <ellipse cx="40" cy="14" rx="27" ry="5" fill="#C98F5A" />
          {[28, 36, 44, 52, 32, 48].map((x, i) => <circle key={i} cx={x} cy={i > 3 ? 11 : 14} r="3.4" fill="#A86A3A" />)}
          <text x="40" y="34" textAnchor="middle" fontSize="9" fontWeight="900" fill="#FFFFFF">DOG</text>
        </svg>
      );
  }
}
