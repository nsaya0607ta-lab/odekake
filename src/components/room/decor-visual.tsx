"use client";

/** わんこのおへやに置いたもの1つの見た目（図鑑アイテム・額縁の写真・トロフィー・ペナント） */
import type { DecorEntry, FrameStyle } from "@/lib/room/types";
import { FurnitureArt } from "./furniture-art";

const FRAME_LOOK: Record<FrameStyle, { label: string; border: string; pad: string; bottom: string }> = {
  wood: { label: "木", border: "border-[6px] border-[#B98A57]", pad: "p-[3px] bg-[#FFFAF0]", bottom: "" },
  white: { label: "白", border: "border-[6px] border-white", pad: "p-0", bottom: "" },
  polaroid: { label: "ポラ", border: "border-[5px] border-white", pad: "p-0 bg-white", bottom: "pb-[18%]" },
  gold: { label: "金", border: "border-[6px] border-[#D9AE4A]", pad: "p-[3px] bg-[#FFF6DA]", bottom: "" },
};
export const FRAME_LABELS = Object.fromEntries(Object.entries(FRAME_LOOK).map(([k, v]) => [k, v.label])) as Record<FrameStyle, string>;

export function DecorVisual({ entry, frame = "wood", thumb = false, lit = false }: { entry: DecorEntry; frame?: FrameStyle; thumb?: boolean; lit?: boolean }) {
  const label = thumb ? undefined : entry.name;
  if (entry.kind === "furniture") return <FurnitureArt id={entry.furniture} label={label} lit={lit} />;
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
    const id = `cup-${entry.key.replace(/[^a-z0-9]/gi, "")}`;
    return (
      <svg viewBox="0 0 110 130" className="pointer-events-none block h-auto w-full drop-shadow-[0_5px_3px_rgba(68,50,33,.25)]" role={label ? "img" : undefined} aria-label={label ? `${entry.name} ランク${entry.rank}のトロフィー` : undefined}>
        <defs>
          <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={entry.color} />
            <stop offset="0.3" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="0.45" stopColor={entry.color} />
            <stop offset="1" stopColor={entry.color} />
          </linearGradient>
          <linearGradient id={`${id}-d`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.25" /></linearGradient>
          <linearGradient id={`${id}-b`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8A5A34" /><stop offset="1" stopColor="#4E3018" /></linearGradient>
        </defs>
        {/* 月桂樹 */}
        {[-1, 1].map((side) => (
          <g key={side} transform={`translate(55 40) scale(${side} 1)`}>
            {[0, 1, 2, 3].map((i) => <ellipse key={i} cx={-30 - i * 2} cy={-14 + i * 10} rx="4" ry="8" fill="#9CC46A" transform={`rotate(${-30 + i * 14} ${-30 - i * 2} ${-14 + i * 10})`} />)}
          </g>
        ))}
        <path d="M34 8h42v12c0 18-8 30-21 32-13-2-21-14-21-32z" fill={`url(#${id}-g)`} />
        <path d="M34 8h42v12c0 18-8 30-21 32-13-2-21-14-21-32z" fill={`url(#${id}-d)`} />
        <path d="M34 13h-10c0 12 6 19 14 21M76 13h10c0 12-6 19-14 21" fill="none" stroke={entry.color} strokeWidth="5" strokeLinecap="round" />
        <path d="M30 6h50" stroke="#FFFFFF" strokeOpacity="0.8" strokeWidth="4" strokeLinecap="round" />
        <path d="M52 52h6v12h-6z" fill={entry.color} />
        <path d="M42 64h26l3 8H39z" fill={entry.color} />
        <path d="M42 64h26l3 8H39z" fill={`url(#${id}-d)`} />
        <text x="55" y="34" textAnchor="middle" fontSize="18" fontWeight="900" fill="#FFFFFF" stroke="rgba(60,40,20,.55)" strokeWidth="1">{entry.rank}</text>
        <rect x="20" y="72" width="70" height="52" rx="5" fill={`url(#${id}-b)`} />
        <rect x="26" y="78" width="58" height="40" rx="3" fill="#D9B062" />
        <rect x="26" y="78" width="58" height="8" rx="3" fill="#FFFFFF" opacity="0.3" />
        <text x="55" y="96" textAnchor="middle" fontSize="13" fontWeight="900" fill="#4E3018">{entry.stage}</text>
        <text x="55" y="112" textAnchor="middle" fontSize="11" fontWeight="800" fill="#4E3018">{entry.score.toLocaleString("ja-JP")}</text>
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
