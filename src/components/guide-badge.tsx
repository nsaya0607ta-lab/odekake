import Image from "next/image";
import Link from "next/link";

/** ホーム右上（フレンドの左）に置く、ルールブックの入口 */
export function GuideBadge() {
  return (
    <Link
      href="/guide"
      aria-label="ルールブックを見る"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blossom bg-card shadow-sm transition-transform active:scale-[0.95]"
    >
      <Image src="/icons/header/guide.webp" alt="" width={28} height={28} className="h-7 w-7 object-contain" />
    </Link>
  );
}
