import Link from "next/link";
import { IconBook } from "./icons";

/** ホーム右上（フレンドの左）に置く、ルールブックの入口 */
export function GuideBadge() {
  return (
    <Link
      href="/guide"
      aria-label="ルールブックを見る"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blossom bg-card text-ink shadow-sm transition-transform active:scale-[0.95]"
    >
      <IconBook size={18} className="text-ink-soft" />
    </Link>
  );
}
