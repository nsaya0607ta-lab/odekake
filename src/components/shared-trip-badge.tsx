import Link from "next/link";
import { IconUsers } from "./icons";

/** ホーム右上に置く、フレンド一覧への入口（名前が切れないよう、アイコンだけ） */
export function SharedTripBadge() {
  return (
    <Link
      href="/mypage/friends"
      aria-label="フレンドを見る"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blossom bg-card text-ink shadow-sm transition-transform active:scale-[0.95]"
    >
      <IconUsers size={18} className="text-ink-soft" />
    </Link>
  );
}
