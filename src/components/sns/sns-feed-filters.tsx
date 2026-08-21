import Image from "next/image";
import Link from "next/link";

export type SnsFeedFilter = "all" | "photos" | "notes";

const FILTERS = [
  { key: "all", label: "ぜんぶ", artSrc: "/illustrations/sns/filter-all-v2.webp" },
  { key: "photos", label: "写真", artSrc: "/illustrations/sns/filter-photos-v2.webp" },
  { key: "notes", label: "ひとこと", artSrc: "/illustrations/sns/filter-notes-v2.webp" },
] as const;

/** 投稿の種類を1タップで絞り込む、ホームと個人ページ共通のフィルター。 */
export function SnsFeedFilters({ active, baseHref }: { active: SnsFeedFilter; baseHref: string }) {
  return (
    <nav aria-label="投稿の種類で絞り込む" className="sns-feed-filters">
      {FILTERS.map(({ key, label, artSrc }) => {
        const selected = active === key;
        const href = key === "all" ? baseHref : `${baseHref}?filter=${key}`;

        return (
          <Link
            key={key}
            href={href}
            prefetch={false}
            scroll={false}
            data-haptic="light"
            aria-current={selected ? "page" : undefined}
            className={`sns-feed-filter pressable is-${key} ${selected ? "is-active" : ""}`}
          >
            <span className="sns-feed-filter-art" aria-hidden="true">
              <Image src={artSrc} alt="" width={40} height={40} sizes="40px" />
              <span className="sns-feed-filter-sparkle">✦</span>
            </span>
            <span className="sns-feed-filter-label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function parseSnsFeedFilter(value: string | undefined): SnsFeedFilter {
  if (value === "photos" || value === "notes") return value;
  return "all";
}

export function matchesSnsFeedFilter(
  post: { body: string | null; photo_paths: string[] },
  filter: SnsFeedFilter,
): boolean {
  if (filter === "photos") return post.photo_paths.length > 0;
  if (filter === "notes") return Boolean(post.body?.trim()) && post.photo_paths.length === 0;
  return true;
}
