import Link from "next/link";
import { IconHeart, IconMapPin } from "./icons";
import type { TimelineItem } from "@/lib/data/visits";
import { StarRating, TripTypeBadge, formatDate } from "./ui";

export function TimelineCard({ item, showTrip = true }: { item: TimelineItem; showTrip?: boolean }) {
  return (
    <Link href={`/spots/${item.spotId}`} className="rough-card block space-y-2 p-4 transition-transform active:scale-[0.99]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold tabular-nums text-ink-soft">{formatDate(item.visitedAt)}</p>
        {showTrip ? <TripTypeBadge type={item.tripType} /> : null}
      </div>

      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 truncate text-base font-bold">{item.spotName}</h3>
        {item.favorite ? (
          <span className="shrink-0 text-blossom" aria-label="お気に入り">
            <IconHeart size={17} filled />
          </span>
        ) : null}
      </div>

      <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink-soft">
        <span className="inline-flex items-center gap-0.5">
          <IconMapPin size={13} />
          {item.municipalityName || "場所未設定"}
        </span>
        {showTrip ? <span>・{item.tripTitle}</span> : null}
        <span>・{item.authorName}さん</span>
      </p>

      {item.rating ? <StarRating value={item.rating} /> : null}

      {item.photoUrls.length > 0 ? (
        <div className="flex gap-2">
          {item.photoUrls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={`${url}-${i}`} src={url} alt="" className="h-20 w-20 rounded-2xl object-cover" />
          ))}
          {item.photoCount > item.photoUrls.length ? (
            <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-paper-deep text-xs text-ink-soft">
              +{item.photoCount - item.photoUrls.length}
            </span>
          ) : null}
        </div>
      ) : null}

      {item.comment ? <p className="line-clamp-2 text-sm leading-relaxed text-ink-soft">{item.comment}</p> : null}
    </Link>
  );
}
