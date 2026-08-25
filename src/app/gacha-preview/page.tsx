"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { GachaRarity } from "@/lib/gacha/config";
import { primeGachaAudio } from "@/components/gacha/audio";
import type { AnimationDraw, DrawResult } from "@/components/gacha/types";

const GachaCinematic = dynamic(
  () => import("@/components/gacha/gacha-cinematic").then((module) => module.GachaCinematic),
  { ssr: false },
);

const PREVIEW_RESULTS: Record<Extract<GachaRarity, "SSR" | "UR" | "LR" | "MR">, DrawResult> = {
  SSR: {
    id: "preview-ssr",
    name: "虹色わんこボール",
    rarity: "SSR",
    type: "item",
    image: "/collection/items/rainbow-ball.webp",
    isNew: true,
    previousLevel: 0,
    newLevel: 1,
  },
  UR: {
    id: "preview-ur",
    name: "あずびー",
    rarity: "UR",
    type: "item",
    image: "/collection/items/two-dogs-icon-transparent.webp",
    isNew: true,
    previousLevel: 0,
    newLevel: 1,
  },
  LR: {
    id: "preview-lr",
    name: "漆黒のアー",
    rarity: "LR",
    type: "item",
    image: "/collection/items/shikkoku-no-ar.webp",
    isNew: true,
    previousLevel: 0,
    newLevel: 1,
  },
  MR: {
    id: "preview-mr",
    name: "ブレブル",
    rarity: "MR",
    type: "item",
    image: "/collection/items/burebur.webp",
    isNew: true,
    previousLevel: 0,
    newLevel: 1,
  },
};

const BUTTON_STYLES = {
  SSR: "from-fuchsia-500 via-amber-300 to-cyan-400 text-slate-950",
  UR: "from-red-700 via-red-500 to-amber-400 text-white",
  LR: "from-black via-zinc-900 to-amber-500 text-amber-100",
  MR: "from-indigo-950 via-violet-700 to-cyan-400 text-white",
} as const;

export default function GachaPreviewPage() {
  const [active, setActive] = useState<AnimationDraw | null>(null);

  const play = (rarity: keyof typeof PREVIEW_RESULTS) => {
    primeGachaAudio();
    setActive({ plan: "single", results: [PREVIEW_RESULTS[rarity]] });
  };

  return (
    <main className="min-h-dvh bg-[#f6f0e5] px-5 py-10 text-[#493b2b]">
      <div className="mx-auto max-w-md">
        <p className="text-[10px] font-black tracking-[0.22em] text-[#9a876e]">PREVIEW ONLY</p>
        <h1 className="mt-2 text-3xl font-black">ガチャ演出プレビュー</h1>
        <p className="mt-3 text-sm font-semibold leading-7 text-[#75644e]">
          レアリティを選ぶと、保存やコイン消費を行わずに演出だけ再生します。
        </p>

        <div className="mt-8 grid grid-cols-2 gap-3">
          {(Object.keys(PREVIEW_RESULTS) as Array<keyof typeof PREVIEW_RESULTS>).map((rarity) => (
            <button
              key={rarity}
              type="button"
              onClick={() => play(rarity)}
              className={`min-h-28 rounded-[28px] bg-gradient-to-br p-4 text-left shadow-[0_14px_28px_rgba(73,59,43,.16)] active:scale-[.98] ${BUTTON_STYLES[rarity]}`}
            >
              <span className="block text-2xl font-black tracking-[0.12em]">{rarity}</span>
              <span className="mt-3 block text-[11px] font-black opacity-80">
                {rarity === "SSR" ? "虹色の光" : rarity === "UR" ? "赤雷・2段爆発" : rarity === "LR" ? "黒金・大爆発" : "停止・亀裂・昇格"}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-7 rounded-[24px] border border-[#dfd1b9] bg-white/70 p-4 text-xs font-semibold leading-6 text-[#7d6d58]">
          実際のガチャ画面では、既存APIが返した結果のうち最高レアリティに合わせて同じ演出を再生し、その後に従来の結果カードを表示します。
        </div>
      </div>

      {active ? <GachaCinematic draw={active} onComplete={() => setActive(null)} /> : null}
    </main>
  );
}

