"use client";

import { memo } from "react";

const ART: Record<string, { icon: string; roof: string; wall: string; trim: string; sign: string }> = {
  "town-hall": { icon: "🐾", roof: "#d98773", wall: "#fff1cf", trim: "#8d604e", sign: "TOWN" },
  "dog-cafe": { icon: "☕", roof: "#80a986", wall: "#fff7df", trim: "#5d8049", sign: "CAFE" },
  bakery: { icon: "🥐", roof: "#dda66d", wall: "#fff0d2", trim: "#a66f3f", sign: "BAKE" },
  "dog-run": { icon: "🎾", roof: "#79a76d", wall: "#dfeacf", trim: "#6f875d", sign: "RUN" },
  "hot-spring": { icon: "♨", roof: "#849fbd", wall: "#f1eadc", trim: "#647b91", sign: "ONSEN" },
};

export const BuildingArtwork = memo(function BuildingArtwork({
  itemId,
  compact = false,
}: {
  itemId: string;
  compact?: boolean;
}) {
  const art = ART[itemId] ?? ART["town-hall"]!;
  const scale = compact ? 0.72 : 1;

  if (itemId === "dog-run") {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none relative h-[102px] w-[138px] origin-bottom select-none"
        style={{ transform: "scale(" + scale + ")" }}
      >
        <span className="absolute bottom-0 left-1/2 h-7 w-32 -translate-x-1/2 rounded-[50%] bg-[#55734b]/20 blur-[2px]" />
        <span
          className="absolute bottom-4 left-1/2 h-[62px] w-[116px] -translate-x-1/2 rounded-[50%] border-[5px] border-[#9b7955] bg-[#a9cc86]"
          style={{ transform: "translateX(-50%) rotateX(56deg)" }}
        />
        {[8, 30, 52, 74, 96].map((left) => (
          <span key={left} className="absolute bottom-[22px] h-12 w-1.5 rounded-full bg-[#8c6948]" style={{ left }} />
        ))}
        <span className="absolute bottom-[28px] left-[50px] text-[25px] drop-shadow-sm">{art.icon}</span>
        <span className="absolute bottom-[55px] left-1/2 -translate-x-1/2 rounded-full border-2 border-white bg-[#6e945f] px-3 py-1 text-[9px] font-black tracking-wider text-white shadow-sm">
          {art.sign}
        </span>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none relative h-[118px] w-[138px] origin-bottom select-none"
      style={{ transform: "scale(" + scale + ")" }}
    >
      <span className="absolute bottom-0 left-1/2 h-7 w-32 -translate-x-1/2 rounded-[50%] bg-[#4b453a]/20 blur-[3px]" />
      {itemId === "hot-spring" ? (
        <>
          <span className="absolute bottom-2 left-2 h-7 w-12 rounded-[50%] border-2 border-[#8aa6bd] bg-[#c9e6ed] opacity-90" />
          <span className="absolute bottom-8 left-7 text-sm text-white/90">〰</span>
        </>
      ) : null}
      <span
        className="absolute bottom-3 left-1/2 h-[65px] w-[104px] -translate-x-1/2 rounded-b-[13px] border-[3px] shadow-[inset_-10px_0_rgba(74,58,42,0.07)]"
        style={{ backgroundColor: art.wall, borderColor: art.trim }}
      />
      <span
        className="absolute bottom-[62px] left-1/2 h-[58px] w-[108px] -translate-x-1/2 border-[3px] shadow-[0_5px_8px_rgba(74,58,42,0.14)]"
        style={{
          backgroundColor: art.roof,
          borderColor: art.trim,
          clipPath: "polygon(50% 0, 100% 73%, 86% 100%, 14% 100%, 0 73%)",
        }}
      />
      <span className="absolute bottom-[15px] left-1/2 h-[48px] w-[31px] -translate-x-1/2 rounded-t-[15px] border-[3px] bg-[#8bb5c1]" style={{ borderColor: art.trim }} />
      <span className="absolute bottom-[36px] left-[24px] h-[24px] w-[25px] rounded-md border-[3px] bg-[#cfe8ef]" style={{ borderColor: art.trim }} />
      <span className="absolute bottom-[36px] right-[24px] h-[24px] w-[25px] rounded-md border-[3px] bg-[#cfe8ef]" style={{ borderColor: art.trim }} />
      <span className="absolute bottom-[73px] left-1/2 -translate-x-1/2 text-[28px] drop-shadow-sm">{art.icon}</span>
      <span
        className="absolute bottom-[48px] left-1/2 -translate-x-1/2 rounded-full border-2 border-white px-2 py-0.5 text-[8px] font-black tracking-[0.08em] text-white shadow-sm"
        style={{ backgroundColor: art.trim }}
      >
        {art.sign}
      </span>
      {itemId === "dog-cafe" ? (
        <span className="absolute bottom-[31px] right-[5px] h-8 w-8 rounded-full border-2 border-white bg-[#eac08a] text-center text-[18px] leading-7 shadow-sm">🦴</span>
      ) : null}
      {itemId === "bakery" ? (
        <span className="absolute bottom-[64px] left-[13px] h-4 w-[42px] rounded-t-md bg-[repeating-linear-gradient(90deg,#fff_0_7px,#dd8d79_7px_14px)] shadow-sm" />
      ) : null}
    </div>
  );
});
