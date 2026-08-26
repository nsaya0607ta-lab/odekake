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
  const selectedBall = balls.find((ball) => ball.id === selectedId) ?? DEFAULT_BALL;

  return (
    <section className="overflow-hidden rounded-[24px] border border-[#26394d] bg-[#09131e] text-white shadow-[0_20px_55px_rgba(0,0,0,0.42)]">
      <div className="relative overflow-hidden border-b border-white/10 px-4 pb-4 pt-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgba(31,202,255,0.20),transparent_48%)]" />
        <div className="relative">
          <p className="text-[9px] font-black tracking-[0.16em] text-[#54d8ff]">プレイヤー装備</p>
          <h2 className="mt-1 text-xl font-black tracking-tight">ボールを選択</h2>
          <p className="mt-1.5 text-[11px] leading-relaxed text-white/55">
            ゴールドボールだけ少し違う球質。お気に入りのボールで挑戦しよう。
          </p>
        </div>
      </div>

      <div className="border-b border-white/10 bg-[#0c1926] px-4 py-3" aria-live="polite">
        <p className="text-[8px] font-black tracking-[0.12em] text-white/40">選択中のボール</p>
        <p className="mt-0.5 truncate text-sm font-black text-white">{selectedBall.name}</p>
      </div>

      <div className="grid grid-cols-3 gap-2.5 p-4">
        {balls.map((ball) => {
          const selected = ball.id === selectedId;
          return (
            <button
              key={ball.id}
              type="button"
              onClick={() => onSelect(ball.id)}
              aria-pressed={selected}
              className={`relative flex min-h-[116px] flex-col items-center gap-1.5 rounded-[16px] border p-2.5 pt-3 transition active:scale-[0.98] ${
                selected
                  ? "border-[#54d8ff] bg-[#153348] shadow-[0_0_22px_rgba(84,216,255,0.22)]"
                  : "border-white/10 bg-white/[0.035] hover:border-white/25"
              }`}
            >
              {selected ? (
                <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#54d8ff] text-[#06101a] shadow-[0_0_12px_rgba(84,216,255,0.7)]">
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
              <span className="line-clamp-2 text-center text-[10px] font-bold leading-tight text-white">
                {ball.name}
              </span>
              {ball.rarity ? (
                <span className="text-[8px] font-black tracking-wide text-white/45">
                  {ball.rarity}
                  <span className="ml-0.5 text-[#ffc95c]">{"★".repeat(RARITY_STARS[ball.rarity])}</span>
                </span>
              ) : (
                <span className="text-[8px] font-black tracking-wide text-white/45">標準</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="px-4 pb-4">
        <button
          type="button"
          onClick={onConfirm}
          className="pressable block w-full rounded-[14px] bg-gradient-to-r from-[#12aee0] to-[#54d8ff] py-3.5 text-center text-sm font-black text-[#04101a] shadow-[0_8px_24px_rgba(34,190,235,0.25)] active:scale-[0.98]"
        >
          このボールでゲームスタート
        </button>
      </div>
    </section>
  );
}
