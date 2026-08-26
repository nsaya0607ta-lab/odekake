"use client";

import { useCallback, useEffect, useState } from "react";

const GUIDE_SEEN_KEY = "odekake:wanko-bowling:play-guide-seen:v1";

export function BowlingPlayGuide() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(GUIDE_SEEN_KEY) !== "1") {
        window.localStorage.setItem(GUIDE_SEEN_KEY, "1");
        setOpen(true);
      }
    } catch {
      // ストレージを利用できない環境でも、常設ボタンからガイドは開ける。
    }
  }, []);

  const closeGuide = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pressable flex h-8 shrink-0 items-center gap-1 rounded-full border border-[#4b6a83] bg-[#102538] px-2.5 text-[9px] font-black leading-none text-[#cbeeff] active:scale-[0.97]"
        aria-label="投げ方のコツを見る"
      >
        <span className="flex h-4 w-4 items-center justify-center rounded-full border border-[#79e2ff]/60 text-[10px] text-[#79e2ff]">?</span>
        コツ
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bowling-guide-title"
          onClick={closeGuide}
        >
          <section
            className="w-full max-w-sm overflow-hidden rounded-[24px] border border-[#34516a] bg-[#09131e] text-white shadow-[0_24px_80px_rgba(0,0,0,0.65)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative overflow-hidden border-b border-white/10 px-5 pb-4 pt-5 text-center">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(84,216,255,0.24),transparent_62%)]" />
              <div className="relative">
                <p className="text-[9px] font-black tracking-[0.14em] text-[#54d8ff]">プレイガイド</p>
                <h2 id="bowling-guide-title" className="mt-1 text-xl font-black">投げ方のコツ</h2>
                <p className="mt-1 text-[11px] text-white/50">使う指でボールの軌道を調整できます</p>
              </div>
            </div>

            <div className="space-y-2.5 p-4">
              <div className="rounded-[18px] border border-[#b37bff]/30 bg-[#6d38a8]/15 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#a66fff]/20 text-2xl">👍</span>
                  <div>
                    <p className="text-sm font-black text-[#d7b9ff]">親指で投げる</p>
                    <p className="mt-0.5 text-[11px] font-bold text-white/75">カーブがかかりやすい</p>
                  </div>
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-white/45">親指は動きに弧がつきやすいため、曲げたい方向へなぞる投げ方に向いています。</p>
              </div>

              <div className="rounded-[18px] border border-[#54d8ff]/30 bg-[#1d87ac]/15 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#54d8ff]/15 text-2xl">☝️</span>
                  <div>
                    <p className="text-sm font-black text-[#8fe8ff]">人差し指で投げる</p>
                    <p className="mt-0.5 text-[11px] font-bold text-white/75">ストレートになりやすい</p>
                  </div>
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-white/45">人差し指は進行方向をまっすぐ保ちやすいため、中央を狙う投げ方に向いています。</p>
              </div>

              <div className="rounded-[16px] border border-[#ffc95c]/25 bg-[#ffc95c]/10 px-3 py-3 text-center">
                <p className="text-[10px] font-black text-[#ffc95c]">金色のピンは1本倒すごとに＋10コイン</p>
                <p className="mt-0.5 text-[9px] text-white/40">1ゲームで5回、ランダムなフレームに登場します</p>
              </div>
            </div>

            <div className="px-4 pb-4">
              <button
                type="button"
                onClick={closeGuide}
                className="pressable w-full rounded-[14px] bg-gradient-to-r from-[#12aee0] to-[#54d8ff] py-3.5 text-sm font-black text-[#04101a] active:scale-[0.98]"
              >
                わかった
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
