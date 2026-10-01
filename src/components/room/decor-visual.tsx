"use client";

/** わんこのおへやに置いたもの1つの見た目（図鑑アイテム・額縁の写真・トロフィー・ペナント） */
import type { DecorEntry, FrameStyle } from "@/lib/room/types";

const FRAME_LOOK: Record<FrameStyle, { label: string; border: string; pad: string; bottom: string }> = {
  wood: { label: "木", border: "border-[6px] border-[#B98A57]", pad: "p-[3px] bg-[#FFFAF0]", bottom: "" },
  white: { label: "白", border: "border-[6px] border-white", pad: "p-0", bottom: "" },
  polaroid: { label: "ポラ", border: "border-[5px] border-white", pad: "p-0 bg-white", bottom: "pb-[18%]" },
  gold: { label: "金", border: "border-[6px] border-[#D9AE4A]", pad: "p-[3px] bg-[#FFF6DA]", bottom: "" },
};
export const FRAME_LABELS = Object.fromEntries(Object.entries(FRAME_LOOK).map(([k, v]) => [k, v.label])) as Record<FrameStyle, string>;

export function DecorVisual({ entry, frame = "wood", thumb = false }: { entry: DecorEntry; frame?: FrameStyle; thumb?: boolean }) {
  const label = thumb ? undefined : entry.name;
  if (entry.kind === "item") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={entry.image} alt={label ?? ""} draggable={false} className="pointer-events-none block h-auto w-full select-none object-contain drop-shadow-[0_5px_3px_rgba(68,50,33,.22)]" />;
  }
  if (entry.kind === "photo") {
    const look = FRAME_LOOK[frame];
    return (
      <span className={`pointer-events-none block w-full rounded-[3px] shadow-[0_6px_8px_rgba(50,35,20,.28)] ${look.border} ${look.pad} ${look.bottom}`}>
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
