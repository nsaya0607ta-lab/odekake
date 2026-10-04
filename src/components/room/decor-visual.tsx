"use client";

/** わんこのおへやに置いたもの1つの見た目（図鑑アイテム・額縁の写真・トロフィー・ペナント） */
import { useEffect, useState } from "react";
import type { DecorEntry, FrameStyle } from "@/lib/room/types";
import { FurnitureArt, type FurnitureFx } from "./furniture-art";
import { SouvenirArt } from "./souvenir-art";

const FRAME_LOOK: Record<FrameStyle, { label: string; border: string; pad: string; bottom: string; bw: number; depth: number }> = {
  wood: { label: "木", border: "border-[6px] border-[#B98A57]", pad: "p-[3px] bg-[#FFFAF0]", bottom: "", bw: 6, depth: 1 },
  white: { label: "白", border: "border-[6px] border-white", pad: "p-0", bottom: "", bw: 6, depth: 0.8 },
  polaroid: { label: "ポラ", border: "border-[5px] border-white", pad: "p-0 bg-white", bottom: "pb-[18%]", bw: 5, depth: 0.25 },
  gold: { label: "金", border: "border-[6px] border-[#D9AE4A]", pad: "p-[3px] bg-[#FFF6DA]", bottom: "", bw: 6, depth: 1 },
};
export const FRAME_LABELS = Object.fromEntries(Object.entries(FRAME_LOOK).map(([k, v]) => [k, v.label])) as Record<FrameStyle, string>;

export function DecorVisual({ entry, frame = "wood", thumb = false, lit = false, fx, mode }: { entry: DecorEntry; frame?: FrameStyle; thumb?: boolean; lit?: boolean; fx?: FurnitureFx; mode?: string }) {
  const label = thumb ? undefined : entry.name;
  if (entry.kind === "furniture") return <FurnitureArt id={entry.furniture} label={label} lit={lit} fx={fx} mode={mode} />;
  if (entry.kind === "souvenir") return <SouvenirArt id={entry.souvenir} shiny={entry.shiny} label={label} />;
  if (entry.kind === "item") return <GroundedImage src={entry.image} alt={label ?? ""} grounded={!thumb} />;
  if (entry.kind === "photo") {
    const look = FRAME_LOOK[frame];
    return (
      <span data-frame className={`pointer-events-none relative block w-full rounded-[3px] shadow-[3px_7px_9px_rgba(50,35,20,.3),0_1px_2px_rgba(50,35,20,.25)] ${look.border} ${look.pad} ${look.bottom}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={entry.image} alt={label ?? ""} draggable={false} className="block aspect-[4/3] w-full select-none object-cover" />
        {/* 額の面取り（左上が光り、右下がかげる） */}
        <span aria-hidden className="absolute rounded-[3px]" style={{ inset: -look.bw, boxShadow: `inset 1.5px 1.5px 0 rgba(255,255,255,${0.5 * look.depth}), inset -1.5px -1.5px 0 rgba(0,0,0,${0.22 * look.depth})` }} />
        {/* 額のふちが中の写真に落とすかげ */}
        <span aria-hidden className="absolute inset-0" style={{ boxShadow: `inset 0 0 0 1px rgba(0,0,0,${0.12 * look.depth}), inset 2px 3px 5px rgba(0,0,0,${0.3 * look.depth})` }} />
        {/* ガラスの映りこみ */}
        {frame !== "polaroid" ? <span aria-hidden className="absolute inset-0 bg-[linear-gradient(125deg,rgba(255,255,255,0)_38%,rgba(255,255,255,.22)_46%,rgba(255,255,255,0)_58%)]" /> : null}
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
        <path d="M22 72 L28 66 H82 L88 72 Z" fill="#A87444" />
        <path d="M28 66 H82" stroke="#C99A66" strokeWidth="1.2" />
        <rect x="20" y="72" width="70" height="52" rx="5" fill={`url(#${id}-b)`} />
        <rect x="26" y="78" width="58" height="40" rx="3" fill="#D9B062" />
        <rect x="26" y="78" width="58" height="8" rx="3" fill="#FFFFFF" opacity="0.3" />
        <text x="55" y="96" textAnchor="middle" fontSize="13" fontWeight="900" fill="#4E3018">{entry.stage}</text>
        <text x="55" y="112" textAnchor="middle" fontSize="11" fontWeight="800" fill="#4E3018">{entry.score.toLocaleString("ja-JP")}</text>
      </svg>
    );
  }
  // 窓・棚・時計は FixtureVisual で描く
  if (entry.kind === "fixture") return null;
  const name = entry.name.replace(/(県|府|都)$/, "");
  return (
    <svg viewBox="0 0 120 70" className="pointer-events-none block h-auto w-full drop-shadow-[0_4px_3px_rgba(68,50,33,.22)]" role={label ? "img" : undefined} aria-label={label ? `${entry.name}のペナント` : undefined}>
      <rect x="4" y="4" width="5" height="62" rx="2.5" fill="#8A5A34" />
      <rect x="4" y="4" width="1.6" height="62" rx="0.8" fill="#B88458" />
      <path d="M9 7 L116 35 L9 63 Z" fill={entry.color} />
      <path d="M9 7 L116 35 L9 63 Z" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M14 13 L104 35 L14 57" fill="none" stroke="#FFF3CF" strokeWidth="1.2" strokeDasharray="3 3" />
      <text x="28" y="41" textAnchor="middle" fontSize="17">{entry.emoji}</text>
      <text x="62" y="40" textAnchor="middle" fontSize={name.length > 3 ? 11 : 13} fontWeight="900" fill="#fff">{name}</text>
      {/* 布のたわみ（上が明るく、下がかげる） */}
      <path d="M9 7 L116 35 L9 63 Z" fill={`url(#pn-${entry.key.replace(/[^a-z0-9]/gi, "")})`} />
      <defs>
        <linearGradient id={`pn-${entry.key.replace(/[^a-z0-9]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.18" />
          <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.18" />
        </linearGradient>
      </defs>
      {/* 壁にとめた画びょう */}
      <circle cx="6.5" cy="7" r="4.2" fill="#E4572E" />
      <circle cx="5.3" cy="5.8" r="1.4" fill="#FFFFFF" opacity="0.8" />
    </svg>
  );
}

/** 画像ごとの「下の透明な余白」の割合（一度はかったら覚えておく） */
const bottomPad = new Map<string, number>();

/** 画像の下のはしから、絵があるいちばん下の行までの割合をはかる */
function measureBottomPad(img: HTMLImageElement): number {
  const w = 64, h = Math.max(1, Math.round((64 * img.naturalHeight) / Math.max(1, img.naturalWidth)));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return 0;
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  for (let y = h - 1; y >= 0; y--) {
    for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3]! > 40) return (h - 1 - y) / h;
  }
  return 0;
}

/**
 * 図鑑アイテムの絵。画像の下に透明な余白があると棚や床から浮いて見えるので、
 * 余白のぶんだけ下げて、絵の足もとを置いた場所（棚の板・床）にそろえる
 */
function GroundedImage({ src, alt, grounded }: { src: string; alt: string; grounded: boolean }) {
  const [pad, setPad] = useState(() => bottomPad.get(src) ?? 0);
  useEffect(() => { setPad(bottomPad.get(src) ?? 0); }, [src]);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      draggable={false}
      className="pointer-events-none block h-auto w-full select-none object-contain drop-shadow-[0_5px_3px_rgba(68,50,33,.22)]"
      style={grounded && pad ? { transform: `translateY(${(pad * 100).toFixed(1)}%)` } : undefined}
      onLoad={(e) => {
        if (!grounded || bottomPad.has(src)) return;
        try {
          const p = Math.min(0.35, measureBottomPad(e.currentTarget));
          bottomPad.set(src, p);
          setPad(p);
        } catch { bottomPad.set(src, 0); }
      }}
    />
  );
}
