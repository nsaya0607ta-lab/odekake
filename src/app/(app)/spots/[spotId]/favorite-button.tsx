"use client";

import { useFormStatus } from "react-dom";
import { IconHeart, IconSpinner } from "@/components/icons";

/**
 * スポットのお気に入り切り替え。
 * お気に入りは訪問履歴側に付くので、自分の記録がないと切り替えられない。
 */
export function FavoriteButton({ favorite, disabled }: { favorite: boolean; disabled?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-pressed={favorite}
      aria-label={favorite ? "お気に入りから外す" : "お気に入りに追加する"}
      className={`pressable flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
        favorite ? "border-blossom bg-blossom-soft text-[#95505e]" : "border-line-strong bg-card text-ink-soft"
      }`}
    >
      {pending ? <IconSpinner size={16} /> : <IconHeart size={16} filled={favorite} />}
      お気に入り
    </button>
  );
}
