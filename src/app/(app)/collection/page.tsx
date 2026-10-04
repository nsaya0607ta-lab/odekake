import Link from "next/link";
import { CollectionProgress, ItemGrid } from "@/components/collection/collection-ui";
import { DambourleSeriesGrid } from "@/components/collection/dambourle-series-grid";
import { IconChevronRight } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import {
  CATEGORY_LABELS,
  COLLECTION_CATEGORIES,
  COLLECTION_SERIES,
  PREF_CODES_WITH_ITEMS,
  PREF_ITEMS,
  RARITY_STARS,
  REGULAR_ITEMS,
  countOwned,
  getPrefItems,
  getSeriesItems,
  isCollectionCategory,
  type CollectionCategory,
  type CollectionItem,
} from "@/lib/collection/items";
import { DAMBOURLE_PRIZES } from "@/lib/dambourle/prizes";
import { getOwnedItemCounts } from "@/lib/data/collection";
import { getOwnedDambourleCounts } from "@/lib/data/dambourle";
import { PREFECTURE_NAMES } from "@/lib/geo/prefecture-names";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "図鑑 | おでかけ記録" };
export const dynamic = "force-dynamic";

type Tab = "regular" | "series" | "pref";
type SortKey = "default" | "rarity" | "name" | "count";

function isSortKey(value: string | undefined): value is SortKey {
  return value === "default" || value === "rarity" || value === "name" || value === "count";
}

function regularHref(category: CollectionCategory | null, sort: SortKey) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (sort !== "default") params.set("sort", sort);
  const query = params.toString();
  return query ? `/collection?${query}` : "/collection";
}

function sortItems(
  items: readonly CollectionItem[],
  owned: ReadonlySet<string>,
  counts: ReadonlyMap<string, number>,
  sort: SortKey,
): CollectionItem[] {
  if (sort === "default") return [...items];

  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const aOwned = owned.has(a.item.id);
      const bOwned = owned.has(b.item.id);

      // 未取得アイテムの名前・レアリティを並び順から推測しにくいよう、
      // 並べ替えは取得済みを先に行い、未取得同士は元の順番を維持する。
      if (aOwned !== bOwned) return aOwned ? -1 : 1;
      if (!aOwned && !bOwned) return a.index - b.index;

      if (sort === "rarity") {
        const rarityDiff = RARITY_STARS[b.item.rarity] - RARITY_STARS[a.item.rarity];
        if (rarityDiff !== 0) return rarityDiff;
      } else if (sort === "name") {
        const nameDiff = a.item.name.localeCompare(b.item.name, "ja");
        if (nameDiff !== 0) return nameDiff;
      } else if (sort === "count") {
        const countDiff = (counts.get(b.item.id) ?? 0) - (counts.get(a.item.id) ?? 0);
        if (countDiff !== 0) return countDiff;
      }

      return a.index - b.index;
    })
    .map(({ item }) => item);
}

export default async function CollectionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; category?: string; sort?: string }>;
}) {
  const [{ supabase, user }, params] = await Promise.all([requireUser(), searchParams]);
  const [counts, dambourleCounts] = await Promise.all([
    getOwnedItemCounts(supabase, user.id),
    // ダンボールの取得に失敗しても図鑑ページ全体を落とさない
    getOwnedDambourleCounts(supabase, user.id).catch((error) => {
      console.warn("Failed to load dambourle counts for collection page", error);
      return new Map<string, number>();
    }),
  ]);
  const owned = new Set(counts.keys());

  const tab: Tab = params.tab === "series" || params.tab === "pref" ? params.tab : "regular";
  const category = isCollectionCategory(params.category) ? params.category : null;
  const sort: SortKey = isSortKey(params.sort) ? params.sort : "default";

  return (
    <>
      <PageHeader title="図鑑" backHref="/home" />

      <PageBody>
        {/* 画面全体の余白は PageBody（space-y-6）より詰めたいので、内側で持つ */}
        <div className="space-y-4">
          <CollectionTabs current={tab} />
          <p className="rough-pill border border-line-strong bg-card px-3 py-2 text-center text-[10px] font-semibold leading-relaxed text-ink-soft">
            同じアイテムが出ると、カードの「出た回数」が増えます
          </p>
          {tab === "regular" ? (
            <RegularTab owned={owned} counts={counts} category={category} sort={sort} />
          ) : tab === "series" ? (
            <SeriesTab owned={owned} counts={counts} dambourleCounts={dambourleCounts} />
          ) : (
            <PrefTab owned={owned} counts={counts} />
          )}
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
    { key: "pref", label: "都道府県図鑑", href: "/collection?tab=pref", active: "bg-[#E6EFFC] text-[#1F4F8F]" },
  ];

  return (
    <div role="tablist" aria-label="図鑑の種類" className="rough-pill flex gap-1 bg-paper-deep p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          role="tab"
          aria-selected={current === tab.key}
          className={`rough-pill min-w-0 flex-1 whitespace-nowrap py-2.5 text-center text-[13px] font-bold transition-colors ${
            current === tab.key ? `${tab.active} shadow-sm` : "text-ink-soft"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

/** 通常の図鑑。カテゴリのチップで絞り込み、取得済みカードを任意の順で並べ替える。 */
function RegularTab({
  owned,
  counts,
  category,
  sort,
}: {
  owned: ReadonlySet<string>;
  counts: ReadonlyMap<string, number>;
  category: CollectionCategory | null;
  sort: SortKey;
}) {
  const filtered = category ? REGULAR_ITEMS.filter((item) => item.category === category) : REGULAR_ITEMS;
  const shown = sortItems(filtered, owned, counts, sort);

  const chips: Array<{ key: string; label: string; href: string; active: boolean }> = [
    { key: "all", label: "すべて", href: regularHref(null, sort), active: category === null },
    ...COLLECTION_CATEGORIES.map((key) => ({
      key,
      label: CATEGORY_LABELS[key],
      href: regularHref(key, sort),
      active: category === key,
    })),
  ];

  const sorts: Array<{ key: SortKey; label: string }> = [
    { key: "default", label: "標準" },
    { key: "rarity", label: "レア順" },
    { key: "name", label: "名前順" },
    { key: "count", label: "出た回数順" },
  ];

  return (
    <div className="space-y-4">
      <p className="px-1 text-center text-xs text-ink-soft">シリーズに関係ないアイテムなどを集められるよ</p>

      <CollectionProgress owned={countOwned(REGULAR_ITEMS, owned)} total={REGULAR_ITEMS.length} />

      {/* アイテムが1つも無いうちは、押しても何も起きないチップを並べない */}
      {REGULAR_ITEMS.length > 0 ? (
        <>
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

          <div className="space-y-1.5">
            <p className="px-1 text-[10px] font-semibold text-ink-faint">並べ替え</p>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="図鑑の並べ替え">
              {sorts.map((option) => (
                <Link
                  key={option.key}
                  href={regularHref(category, option.key)}
                  aria-current={sort === option.key ? "true" : undefined}
                  className={`rough-pill shrink-0 border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                    sort === option.key
                      ? "border-[#b9a36e] bg-[#fff5d9] text-[#765f2e] shadow-sm"
                      : "border-line-strong bg-card text-ink-soft"
                  }`}
                >
                  {option.label}
                </Link>
              ))}
            </div>
          </div>
        </>
      ) : null}

      <ItemGrid items={shown} owned={owned} counts={counts} />
    </div>
  );
}

/** シリーズ図鑑。シリーズごとにまとめて並べ、見出しから詳細へ行ける */
function SeriesTab({
  owned,
  counts,
  dambourleCounts,
}: {
  owned: ReadonlySet<string>;
  counts: ReadonlyMap<string, number>;
  dambourleCounts: ReadonlyMap<string, number>;
}) {
  const allSeriesItems = COLLECTION_SERIES.flatMap((series) => getSeriesItems(series.id));
  const dambourleOwnedCount = DAMBOURLE_PRIZES.filter((prize) => (dambourleCounts.get(prize.id) ?? 0) > 0).length;

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
            <ItemGrid items={items} owned={owned} counts={counts} />
          </section>
        );
      })}

      <section className="space-y-2.5">
        <Link
          href="/games/item-catch/dambourle"
          className="rough-pill pressable flex items-center gap-2 border border-[#d8c79a] bg-[#fff6e0] px-3.5 py-2 text-[#7a5c1e]"
        >
          <span className="min-w-0 flex-1 truncate text-sm font-bold">ダンボール</span>
          <span className="shrink-0 text-xs font-semibold tabular-nums">
            {dambourleOwnedCount} / {DAMBOURLE_PRIZES.length}
          </span>
          <IconChevronRight size={16} className="shrink-0" />
        </Link>
        <DambourleSeriesGrid ownedCounts={dambourleCounts} />
      </section>
    </div>
  );
}

/** 都道府県図鑑。都道府県ガチャ（青コイン）で出るアイテムを、県ごとにまとめて並べる */
function PrefTab({ owned, counts }: { owned: ReadonlySet<string>; counts: ReadonlyMap<string, number> }) {
  return (
    <div className="space-y-4">
      <p className="px-1 text-center text-xs text-ink-soft">
        都道府県ガチャ（青コイン）で出る、ご当地アイテムを集められるよ
      </p>

      <CollectionProgress owned={countOwned(PREF_ITEMS, owned)} total={PREF_ITEMS.length} barClass="bg-[#3D7FD9]" />

      {PREF_CODES_WITH_ITEMS.map((code) => {
        const items = getPrefItems(code);
        return (
          <section key={code} className="space-y-2.5">
            <div className="rough-pill flex items-center gap-2 border border-[#BFD7F5] bg-[#EEF5FF] px-3.5 py-2 text-[#1F4F8F]">
              <span className="min-w-0 flex-1 truncate text-sm font-bold">{PREFECTURE_NAMES.find((p) => p.code === code)?.name ?? code}</span>
              <span className="shrink-0 text-xs font-semibold tabular-nums">
                {countOwned(items, owned)} / {items.length}
              </span>
            </div>
            <ItemGrid items={items} owned={owned} counts={counts} />
          </section>
        );
      })}

      <Link
        href="/mypage/coins#pref-gacha"
        className="rough-pill pressable flex items-center gap-2 border border-[#BFD7F5] bg-card px-3.5 py-2 text-[#1F4F8F]"
      >
        <span className="min-w-0 flex-1 truncate text-xs font-bold">都道府県ガチャをまわす</span>
        <IconChevronRight size={16} className="shrink-0" />
      </Link>
      <p className="px-1 text-center text-[10px] text-ink-faint">ほかの都道府県のアイテムも、これから増えていきます</p>
    </div>
  );
}
