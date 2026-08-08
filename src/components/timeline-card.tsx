import Link from "next/link";
import { IconHeart, IconMapPin } from "./icons";
import type { TimelineItem } from "@/lib/data/visits";
import { TripBadge, formatDate } from "./ui";

export function TimelineCard({ item, showTrip = true }: { item: TimelineItem; showTrip?: boolean }) {
  return (
    <Link
      href={`/spots/${item.spotId}`}
      className="rough-card flex items-center gap-3 px-3 py-3 transition-transform active:scale-[0.99]"
    >
      <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-paper-deep">
        {item.photoUrls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.photoUrls[0]} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-ink-faint">
            <IconMapPin size={20} />
          </span>
        )}
        {item.photoCount > 1 ? (
          <span className="absolute right-0.5 bottom-0.5 rounded-full bg-ink/70 px-1.5 py-px text-[10px] font-semibold text-white">
            +{item.photoCount - 1}
          </span>
        ) : null}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-base font-bold">{item.spotName}</span>
          {item.favorite ? (
            <span className="shrink-0 text-blossom" aria-label="お気に入り">
              <IconHeart size={14} filled />
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-soft">
          <span className="inline-flex items-center gap-0.5">
            <IconMapPin size={12} />
            {item.municipalityName || "場所未設定"}
          </span>
          <span className="tabular-nums">{formatDate(item.visitedAt)}</span>
        </span>
      </span>

      {showTrip ? <TripBadge title={item.tripTitle} /> : null}
    </Link>
  );
}
