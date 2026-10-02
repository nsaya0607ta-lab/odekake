"use client";

/**
 * わんこのおへや：部屋の手前の床に立てた、イーゼルのホワイトボード。
 * きょうの空・歩数・フレンドのおへやなどを「ボードに映して」見せる。
 * スクロールはボードの面の中だけで動き、部屋と床は動かない。
 */
import type { ReactNode } from "react";

export function RoomBoard({ children, dark = 0 }: { children: ReactNode; /** 夜の暗さ（0〜1）。ボードの面を少し落とす */ dark?: number }) {
  return (
    <div className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+12px)] top-2.5 mx-auto w-[min(93%,460px)]">
      {/* 床に落ちる影 */}
      <div aria-hidden className="absolute -bottom-1 left-[-4%] right-[-4%] h-7 rounded-[50%] bg-[radial-gradient(closest-side,rgba(30,18,6,.38),rgba(30,18,6,0))]" />
      {/* イーゼルの脚（左右と、うしろの1本）。ボードのうしろから床へ */}
      <svg aria-hidden viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-12 w-full">
        <defs>
          <linearGradient id="board-leg" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#8A5A32" />
            <stop offset="0.45" stopColor="#C99462" />
            <stop offset="1" stopColor="#7A4C28" />
          </linearGradient>
        </defs>
        <path d="M47.5 0 L52.5 0 L51.6 30 L48.4 30 Z" fill="#6A4222" opacity="0.85" />
        <path d="M9 0 L14 0 L9.6 40 L4.6 40 Z" fill="url(#board-leg)" />
        <path d="M86 0 L91 0 L95.4 40 L90.4 40 Z" fill="url(#board-leg)" />
        <rect x="4.2" y="38.2" width="5.8" height="1.8" rx="0.6" fill="#4A2C14" />
        <rect x="90" y="38.2" width="5.8" height="1.8" rx="0.6" fill="#4A2C14" />
      </svg>

      {/* ボード本体（アルミのわく → 白い面） */}
      <div className="absolute inset-x-0 bottom-9 top-0 rounded-[16px] bg-[linear-gradient(160deg,#FDFDFD_0%,#C9CED6_38%,#EEF0F3_55%,#AEB4BE_100%)] p-[7px] shadow-[0_18px_30px_-16px_rgba(30,20,10,.65),0_3px_6px_-2px_rgba(30,20,10,.25)]">
        <div className="relative h-full overflow-hidden rounded-[10px] bg-[#FBFCFD] shadow-[inset_0_1px_3px_rgba(0,0,0,.25),inset_0_0_0_1px_rgba(0,0,0,.06)]">
          {/* ここだけスクロールする */}
          <div className="absolute inset-0 space-y-3 overflow-y-auto overscroll-contain p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {children}
          </div>
          {/* ボードの面のつや（ななめの光）と、夜の暗さ */}
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0)_30%,rgba(255,255,255,.28)_42%,rgba(255,255,255,0)_52%)]" />
          {dark > 0.05 ? <div aria-hidden className="pointer-events-none absolute inset-0 bg-[#0F1438]" style={{ opacity: Math.min(0.22, dark * 0.25) }} /> : null}
          {/* 上下のはしで、中身がふわっと消える */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-2 bg-gradient-to-b from-[#FBFCFD] to-transparent" />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-3 bg-gradient-to-t from-[#FBFCFD] to-transparent" />
        </div>
      </div>

      {/* ペン置きのトレー（マーカーとイレーサー） */}
      <div aria-hidden className="absolute inset-x-[3%] bottom-[26px] h-[12px] rounded-b-[6px] rounded-t-[2px] bg-[linear-gradient(180deg,#E8EBEF,#A9B0BA)] shadow-[0_4px_6px_-3px_rgba(30,20,10,.55)]">
        <span className="absolute bottom-[5px] left-[14%] h-[6px] w-[26px] rounded-full bg-[linear-gradient(90deg,#2F6FC2_0_30%,#F4F4F4_30%)] shadow-sm" />
        <span className="absolute bottom-[5px] left-[25%] h-[6px] w-[26px] rounded-full bg-[linear-gradient(90deg,#D9402E_0_30%,#F4F4F4_30%)] shadow-sm" />
        <span className="absolute bottom-[4px] right-[14%] h-[8px] w-[34px] rounded-[3px] bg-[linear-gradient(180deg,#3A3A44_0_45%,#E9E1D2_45%)] shadow-sm" />
      </div>
    </div>
  );
}
