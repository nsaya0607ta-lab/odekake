import Image from "next/image";
import Link from "next/link";

/** ホーム右上に置く、フレンド一覧への入口（名前が切れないよう、絵だけ） */
export function SharedTripBadge() {
  return (
    <Link
      href="/mypage/friends"
      aria-label="フレンドを見る"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blossom bg-card shadow-sm transition-transform active:scale-[0.95]"
    >
      <Image src="/icons/header/friends.webp" alt="" width={30} height={30} className="h-[30px] w-[30px] object-contain" />
    </Link>
  );
}
