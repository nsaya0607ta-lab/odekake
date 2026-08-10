import Link from "next/link";
import { CollectionProgress, ItemGrid } from "@/components/collection/collection-ui";
import { IconChevronRight } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import {
  CATEGORY_LABELS,
  COLLECTION_CATEGORIES,
  COLLECTION_SERIES,
  REGULAR_ITEMS,
  countOwned,
  getSeriesItems,
  isCollectionCategory,
  type CollectionCategory,
} from "@/lib/collection/items";
import { getOwnedItemIds } from "@/lib/data/collection";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "図鑑 | おでかけ記録" };
export const dynamic = "force-dynamic";

type Tab = "regular" | "series";

export default async function CollectionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; category?: string }>;
}) {
  const [{ supabase, user }, params] = await Promise.all([requireUser(), searchParams]);
  const owned = await getOwnedItemIds(supabase, user.id);

  const tab: Tab = params.tab === "series" ? "series" : "regular";
  const category = isCollectionCategory(params.category) ? params.category : null;

  return (
    <>
      <PageHeader title="図鑑" backHref="/home" />

      <PageBody>
        {/* 画面全体の余白は PageBody（space-y-6）より詰めたいので、内側で持つ */}
        <div className="space-y-4">
          <CollectionTabs current={tab} />
          {tab === "regular" ? <RegularTab owned={owned} category={category} /> : <SeriesTab owned={owned} />}
          <p className="pb-2 text-center text-xs text-ink-faint">
            持っていないアイテムはシルエットで表示されます
          </p>
        </div>
      </PageBody>
    </>
  );
}

function CollectionTabs({ current }: { current: Tab }) {
  const tabs: Array<{ key: Tab; label: string; href: string; active: string }> = [
    { key: "regular", label: "通常の図鑑", href: "/collection", active: "bg-leaf-soft text-leaf-deep" },
    { key: "series", label: "シリーズ図鑑", href: "/collection?tab=series", active: "bg-sky-soft text-[#42718f]" },
  ];

  return (
    <div role="tablist" aria-label="図鑑の種類" className="rough-pill flex gap-1 bg-paper-deep p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          role="tab"
          aria-selected={current === tab.key}
          className={`rough-pill flex-1 py-2.5 text-center text-sm font-bold transition-colors ${
            current === tab.key ? `${tab.active} shadow-sm` : "text-ink-soft"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

/** 通常の図鑑。カテゴリのチップで絞り込む */
function RegularTab({
  owned,
  category,
}: {
  owned: ReadonlySet<string>;
  category: CollectionCategory | null;
}) {
  const shown = category ? REGULAR_ITEMS.filter((item) => item.category === category) : REGULAR_ITEMS;

  const chips: Array<{ key: string; label: string; href: string; active: boolean }> = [
    { key: "all", label: "すべて", href: "/collection", active: category === null },
    ...COLLECTION_CATEGORIES.map((key) => ({
      key,
      label: CATEGORY_LABELS[key],
      href: `/collection?category=${key}`,
      active: category === key,
    })),
  ];

  return (
    <div className="space-y-4">
      <p className="px-1 text-center text-xs text-ink-soft">シリーズに関係ないアイテムなどを集められるよ</p>

      <CollectionProgress owned={countOwned(REGULAR_ITEMS, owned)} total={REGULAR_ITEMS.length} />

      {/* アイテムが1つも無いうちは、押しても何も起きないチップを並べない */}
      {REGULAR_ITEMS.length > 0 ? (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {chips.map((chip) => (
            <Link
              key={chip.key}
              href={chip.href}
              className={`rough-pill shrink-0 border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                chip.active
                  ? "border-leaf bg-leaf-soft text-leaf-deep"
                  : "border-line-strong bg-card text-ink-soft"
              }`}
            >
              {chip.label}
            </Link>
          ))}
        </div>
      ) : null}

      <ItemGrid items={shown} owned={owned} />
    </div>
  );
}

/** シリーズ図鑑。シリーズごとにまとめて並べ、見出しから詳細へ行ける */
function SeriesTab({ owned }: { owned: ReadonlySet<string> }) {
  const allSeriesItems = COLLECTION_SERIES.flatMap((series) => getSeriesItems(series.id));

  return (
    <div className="space-y-4">
      <p className="px-1 text-center text-xs text-ink-soft">
        登山、雪国などのシリーズに関係するアイテムを集められるよ
      </p>

      <CollectionProgress
        owned={countOwned(allSeriesItems, owned)}
        total={allSeriesItems.length}
        barClass="bg-sky"
      />

      {COLLECTION_SERIES.map((series) => {
        const items = getSeriesItems(series.id);

        return (
          <section key={series.id} className="space-y-2.5">
            <Link
              href={`/collection/series/${series.id}`}
              className={`rough-pill pressable flex items-center gap-2 border px-3.5 py-2 ${series.tone.header}`}
            >
              <span className="min-w-0 flex-1 truncate text-sm font-bold">{series.name}</span>
              <span className="shrink-0 text-xs font-semibold tabular-nums">
                {countOwned(items, owned)} / {items.length}
              </span>
              <IconChevronRight size={16} className="shrink-0" />
            </Link>
            <ItemGrid items={items} owned={owned} />
          </section>
        );
      })}
    </div>
  );
}
