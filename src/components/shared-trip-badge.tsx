import Link from "next/link";
import { IconChevronRight, IconUsers } from "./icons";

/** ホーム右上に置く、共有旅一覧への入口 */
export function SharedTripBadge() {
  return (
    <Link
      href="/shared-trips"
      aria-label="共有旅を見る"
      className="flex shrink-0 items-center gap-1 rounded-full border border-blossom bg-card px-2.5 py-1.5 text-ink shadow-sm transition-transform active:scale-[0.98]"
    >
      <IconUsers size={17} className="text-ink-soft" />
      <span className="whitespace-nowrap text-xs font-bold">共有旅</span>
      <IconChevronRight size={14} className="text-ink-faint" />
    </Link>
  );
}
