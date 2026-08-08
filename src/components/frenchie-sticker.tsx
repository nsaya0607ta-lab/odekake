import { FRENCHIE_FRAME, frenchieSrc, type FrenchiePose } from "@/lib/frenchie";

/**
 * 動かないフレブル。空っぽの画面やちょっとした余白に置く。
 *
 * ホームのバンドを歩く子とは役割が違う。あちらは眺めるもの、こちらは
 * 「まだ何もありません」の角を丸くするためのもの。呼吸するようにゆっくり
 * 上下するだけで、視線は奪わない。
 */
export function FrenchieSticker({
  pose = "wonder",
  width = 108,
  className = "",
  breathe = true,
}: {
  pose?: FrenchiePose;
  /** 表示幅（px）。素材は 300px 幅なので、これより大きくしない */
  width?: number;
  className?: string;
  breathe?: boolean;
}) {
  return (
    <span className={`block ${className}`} style={{ width }} aria-hidden="true">
      <style>{`
        @keyframes frenchie-breathe {
          0%, 100% { transform: translateY(0) scale(1); }
          50%      { transform: translateY(-2px) scale(1.012); }
        }
        .frenchie-breathe { animation: frenchie-breathe 3.6s ease-in-out infinite; transform-origin: 50% 92%; }
        @media (prefers-reduced-motion: reduce) {
          .frenchie-breathe { animation: none; }
        }
      `}</style>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={frenchieSrc(pose)}
        alt=""
        width={FRENCHIE_FRAME.width}
        height={FRENCHIE_FRAME.height}
        decoding="async"
        loading="lazy"
        draggable={false}
        className={`h-auto w-full select-none ${breathe ? "frenchie-breathe" : ""}`}
      />
    </span>
  );
}
