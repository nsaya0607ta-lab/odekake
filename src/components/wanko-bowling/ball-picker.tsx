"use client";

import Image from "next/image";
import { IconCheck } from "@/components/icons";
import { RARITY_STARS } from "@/lib/collection/items";
import { DEFAULT_BOWLING_BALL_ID, type OwnedBowlingBall } from "@/lib/games/wanko-bowling-balls";

const DEFAULT_BALL: OwnedBowlingBall = {
  id: DEFAULT_BOWLING_BALL_ID,
  name: "いつものボール",
  image: null,
  rarity: null,
};

export function BallPicker({
  ownedBalls,
  selectedId,
  onSelect,
  onConfirm,
}: {
  ownedBalls: OwnedBowlingBall[];
  selectedId: string;
  onSelect: (id: string) => void;
  onConfirm: () => void;
}) {
  const balls = [DEFAULT_BALL, ...ownedBalls];

  return (
    <section className="rough-card overflow-hidden">
      <div className="border-b border-line px-4 py-4">
        <p className="text-[9px] font-black tracking-[0.16em] text-ink-faint">TODAY&apos;S BALL</p>
        <h2 className="mt-0.5 text-base font-black text-ink">今日のボールを選ぼう</h2>
        <p className="mt-1 text-[10px] leading-relaxed text-ink-faint">
          どのボールでも性能は同じ。見た目や演出だけが変わります。
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2.5 p-4">
        {balls.map((ball) => {
          const selected = ball.id === selectedId;
          return (
            <button
              key={ball.id}
              type="button"
              onClick={() => onSelect(ball.id)}
              className={`relative flex flex-col items-center gap-1.5 rounded-[18px] border p-2.5 pt-3 transition-colors active:scale-[0.98] ${
                selected ? "border-leaf-deep bg-leaf-soft" : "border-line bg-paper-deep"
              }`}
            >
              {selected ? (
                <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-leaf-deep text-white">
                  <IconCheck size={12} />
                </span>
              ) : null}
              <span className="relative flex h-14 w-14 items-center justify-center">
                {ball.image ? (
                  <Image src={ball.image} alt="" fill sizes="56px" className="object-contain" />
                ) : (
                  <span
                    className="h-10 w-10 rounded-full"
                    style={{ background: "radial-gradient(circle at 32% 28%, #fbeed7, #c9a06a)" }}
                    aria-hidden="true"
                  />
                )}
              </span>
              <span className="line-clamp-2 text-center text-[10px] font-bold leading-tight text-ink">
                {ball.name}
              </span>
              {ball.rarity ? (
                <span className="text-[8px] font-black tracking-wide text-ink-faint">
                  {ball.rarity}
                  <span className="ml-0.5 text-[#e0b862]">{"★".repeat(RARITY_STARS[ball.rarity])}</span>
                </span>
              ) : (
                <span className="text-[8px] font-black tracking-wide text-ink-faint">はじめから</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="px-4 pb-4">
        <button
          type="button"
          onClick={onConfirm}
          className="btn pressable block w-full rounded-full bg-leaf-deep py-3 text-center text-sm font-black text-white active:scale-[0.98]"
        >
          このボールで遊ぶ
        </button>
      </div>
    </section>
  );
}
