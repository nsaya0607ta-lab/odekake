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

const TEN_PULL_RESULTS: DrawResult[] = [
  { id: "preview-10-1", name: "カラフルボール", rarity: "N", type: "item", image: "/collection/items/colorful-ball.webp", isNew: true, previousLevel: 0, newLevel: 1 },
  { id: "preview-10-2", name: "あひるのぬいぐるみ", rarity: "R", type: "item", image: "/collection/items/duck-plush.webp", isNew: true, previousLevel: 0, newLevel: 1 },
  { id: "preview-10-3", name: "ロープおもちゃ", rarity: "N", type: "item", image: "/collection/items/rope-toy.webp", isNew: false, previousLevel: 1, newLevel: 1 },
  { id: "preview-10-4", name: "にんじんトイ", rarity: "R", type: "item", image: "/collection/items/carrot-toy.webp", isNew: false, previousLevel: 1, newLevel: 1 },
  { id: "preview-10-5", name: "ほねのおもちゃ", rarity: "N", type: "item", image: "/collection/items/bone-toy.webp", isNew: true, previousLevel: 0, newLevel: 1 },
  { ...PREVIEW_RESULTS.SSR, id: "preview-10-6", isNew: false },
  { id: "preview-10-7", name: "フリスビー", rarity: "R", type: "item", image: "/collection/items/frisbee.webp", isNew: false, previousLevel: 1, newLevel: 1 },
  { id: "preview-10-8", name: "ぴこぴこボール", rarity: "N", type: "item", image: "/collection/items/squeaky-ball.webp", isNew: false, previousLevel: 1, newLevel: 1 },
  { ...PREVIEW_RESULTS.UR, id: "preview-10-9", isNew: false },
  { id: "preview-10-10", name: "宝箱おやつパズル", rarity: "SR", type: "item", image: "/collection/items/treasure-puzzle.webp", isNew: true, previousLevel: 0, newLevel: 1 },
];

const PROMOTION_RATE = 0.01;
const LR_PROMOTION_RATE = 0.7;

const HUNDRED_PULL_POOL: Record<"N" | "R" | "SR" | "SSR" | "UR" | "LR" | "MR", DrawResult> = {
  N: { id: "preview-100-n", name: "カラフルボール", rarity: "N", type: "item", image: "/collection/items/colorful-ball.webp", isNew: false, previousLevel: 1, newLevel: 1 },
  R: { id: "preview-100-r", name: "あひるのぬいぐるみ", rarity: "R", type: "item", image: "/collection/items/duck-plush.webp", isNew: false, previousLevel: 1, newLevel: 1 },
  SR: { id: "preview-100-sr", name: "宝箱おやつパズル", rarity: "SR", type: "item", image: "/collection/items/treasure-puzzle.webp", isNew: false, previousLevel: 1, newLevel: 1 },
  SSR: { ...PREVIEW_RESULTS.SSR, id: "preview-100-ssr", isNew: false },
  UR: { ...PREVIEW_RESULTS.UR, id: "preview-100-ur", isNew: false },
  LR: { ...PREVIEW_RESULTS.LR, id: "preview-100-lr", isNew: false },
  MR: { ...PREVIEW_RESULTS.MR, id: "preview-100-mr", isNew: false },
};

// プレビュー用に、本番の100連専用排出率（N48.4/R24.9/SR16/SSR6.6/UR3.3/LR0.6/MR0.2）をなぞる。
function rollHundredRarity(): keyof typeof HUNDRED_PULL_POOL {
  const roll = Math.random() * 100;
  if (roll < 48.4) return "N";
  if (roll < 73.3) return "R";
  if (roll < 89.3) return "SR";
  if (roll < 95.9) return "SSR";
  if (roll < 99.2) return "UR";
  if (roll < 99.8) return "LR";
  return "MR";
}

function createHundredPull(): AnimationDraw {
  const results: DrawResult[] = Array.from({ length: 100 }, (_, index) => {
    const rarity = rollHundredRarity();
    const base = HUNDRED_PULL_POOL[rarity];
    return { ...base, id: `${base.id}-${index}`, isNew: index % 7 === 0 };
  });
  // 予兆演出（LR以上の大揺れ・MRの発光）を毎回確認できるよう、1セット目にMR・2セット目にLRを仕込む。
  const mrTemplate = HUNDRED_PULL_POOL.MR;
  const lrTemplate = HUNDRED_PULL_POOL.LR;
  results[3] = { ...mrTemplate, id: `${mrTemplate.id}-forced`, isNew: true };
  results[13] = { ...lrTemplate, id: `${lrTemplate.id}-forced`, isNew: true };
  return { plan: "hundred", results };
}

function createTenPull(forcePromotion: boolean): AnimationDraw {
  const results = TEN_PULL_RESULTS.map((result) => ({ ...result }));
  if (!forcePromotion && Math.random() >= PROMOTION_RATE) return { plan: "multi", results };

  const eligibleIndexes = results.flatMap((result, index) => result.rarity === "N" || result.rarity === "R" ? [index] : []);
  const index = eligibleIndexes[Math.floor(Math.random() * eligibleIndexes.length)];
  if (index === undefined) return { plan: "multi", results };

  const original = results[index];
  if (!original) return { plan: "multi", results };
  const fromRarity = original.rarity as "N" | "R";
  const toRarity = Math.random() < LR_PROMOTION_RATE ? "LR" : "MR";
  results[index] = {
    ...PREVIEW_RESULTS[toRarity],
    id: `${PREVIEW_RESULTS[toRarity].id}-promotion-${index}`,
    isNew: original.isNew,
    previousLevel: original.previousLevel,
    newLevel: original.newLevel,
  };

  return { plan: "multi", results, promotion: { index, fromRarity, toRarity } };
}

export default function GachaPreviewPage() {
  const [active, setActive] = useState<AnimationDraw | null>(null);

  const play = (rarity: keyof typeof PREVIEW_RESULTS) => {
    primeGachaAudio();
    setActive({ plan: "single", results: [PREVIEW_RESULTS[rarity]] });
  };

  const playTen = (forcePromotion = false) => {
    primeGachaAudio();
    setActive(createTenPull(forcePromotion));
  };

  const playHundred = () => {
    primeGachaAudio();
    setActive(createHundredPull());
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

        <button
          type="button"
          onClick={() => playTen()}
          className="mt-4 min-h-24 w-full rounded-[28px] bg-gradient-to-r from-[#222034] via-[#7848c9] to-[#2ba8c7] p-5 text-left text-white shadow-[0_14px_28px_rgba(73,59,43,.2)] active:scale-[.98]"
        >
          <span className="block text-2xl font-black tracking-[0.08em]">10連を再生</span>
          <span className="mt-2 block text-[11px] font-black text-white/80">1 / 10から順番に、全10個の演出を確認</span>
        </button>

        <button
          type="button"
          onClick={() => playTen(true)}
          className="mt-3 min-h-20 w-full rounded-[24px] border-2 border-[#6947b8] bg-[#29203d] p-4 text-left text-white shadow-[0_12px_24px_rgba(67,43,116,.22)] active:scale-[.98]"
        >
          <span className="block text-lg font-black">確変を強制再生</span>
          <span className="mt-1 block text-[10px] font-bold text-white/75">プレビュー確認用：N/Rの1個がLR 70%・MR 30%で昇格</span>
        </button>

        <button
          type="button"
          onClick={playHundred}
          className="mt-3 min-h-24 w-full rounded-[28px] bg-gradient-to-r from-[#0f4d2e] via-[#1c8f52] to-[#e3b74e] p-5 text-left text-white shadow-[0_14px_28px_rgba(73,59,43,.2)] active:scale-[.98]"
        >
          <span className="block text-2xl font-black tracking-[0.08em]">100連を再生</span>
          <span className="mt-2 block text-[11px] font-black text-white/80">100個のカプセル排出 → SR以上だけ個別演出</span>
        </button>

        <div className="mt-7 rounded-[24px] border border-[#dfd1b9] bg-white/70 p-4 text-xs font-semibold leading-6 text-[#7d6d58]">
          通常の10連では、全カプセル着地後に10連1回につき1%で確変します。対象はN/Rの1個だけで、LR 70%・MR 30%に昇格します。保存やコイン消費は行いません。
        </div>
      </div>

      {active ? <GachaCinematic draw={active} onComplete={() => setActive(null)} /> : null}
    </main>
  );
}
