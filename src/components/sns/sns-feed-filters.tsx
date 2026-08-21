import Link from "next/link";
import { IconGlobe, IconImage, IconNotebook } from "@/components/icons";

export type SnsFeedFilter = "all" | "photos" | "notes";

const FILTERS = [
  { key: "all", label: "ぜんぶ", icon: IconGlobe },
  { key: "photos", label: "写真", icon: IconImage },
  { key: "notes", label: "ひとこと", icon: IconNotebook },
] as const;

/** 投稿の種類を1タップで絞り込む、ホームと個人ページ共通のフィルター。 */
export function SnsFeedFilters({ active, baseHref }: { active: SnsFeedFilter; baseHref: string }) {
  return (
    <nav aria-label="投稿の種類で絞り込む" className="sns-feed-filters">
      {FILTERS.map(({ key, label, icon: Icon }) => {
        const selected = active === key;
        const href = key === "all" ? baseHref : `${baseHref}?filter=${key}`;

        return (
          <Link
            key={key}
            href={href}
            scroll={false}
            data-haptic="light"
            aria-current={selected ? "page" : undefined}
            className={`sns-feed-filter pressable is-${key} ${selected ? "is-active" : ""}`}
          >
            <Icon size={15} />
            <span>{label}</span>
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
