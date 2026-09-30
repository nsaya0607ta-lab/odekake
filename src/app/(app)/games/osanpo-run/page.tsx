import type { Metadata } from "next";
import { getImageProps } from "next/image";
import { OsanpoRunGame } from "@/components/games/osanpo-run/osanpo-run-game";
import type { RunItem } from "@/components/games/osanpo-run/engine";
import { CATEGORY_LABELS, COLLECTION_ITEMS, REGULAR_ITEMS, type CollectionItem } from "@/lib/collection/items";
import { getOwnedItemCounts } from "@/lib/data/collection";
import { getExpDashboard } from "@/lib/data/exp";
import { getOsanpoRunMemoryPhotos, getOsanpoRunOdekake } from "@/lib/data/osanpo-run";
import { todayInJapan } from "@/lib/date";
import { getSkillLevel } from "@/lib/gacha/skill-levels";
import { getDogSkin, isSkinUnlocked } from "@/lib/dog-skins";
import { OSANPO_RUN_STAGE_IDS, OSANPO_RUN_STAGES } from "@/lib/games/osanpo-run/config";
import { getDailyMissions } from "@/lib/games/osanpo-run/missions";
import { SERIES } from "@/lib/series";
import { requireUser } from "@/lib/supabase/server";
import "./osanpo-run.css";

export const metadata: Metadata = {
  title: "おさんぽフレンチー | おでかけ記録",
  description: "フレブルと散歩しながら、持っている図鑑アイテムを拾っていくミニゲーム。スコアでコインがもらえて、フレンドと競えます。",
};
export const dynamic = "force-dynamic";

/** 持っているアイテムがこれより少ないと道がさみしいので、通常図鑑のNアイテムを見本として混ぜる */
const MIN_OWNED_ITEMS = 5;
const SAMPLE_ITEM_COUNT = 12;

/**
 * キャンバスに描く大きさ(最大34px)の2倍程度に縮めた画像URLと、スキルLv。
 * スキルLvはアイテムキャッチと同じ図鑑のLv（Nと見本のアイテムはLv1）。
 */
function toRunItem(item: CollectionItem & { image: string }, count: number): RunItem {
  const { props } = getImageProps({ src: item.image, alt: "", width: 48, height: 48 });
  const level = Math.max(1, getSkillLevel(item.rarity, count));
  return { id: item.id, name: item.name, category: item.category, series: item.series, rarity: item.rarity, src: props.src, level };
}

type MissionQuery = {
  from: (table: "osanpo_run_missions") => {
    select: (columns: "mission_id") => {
      eq: (column: "user_id", value: string) => {
        eq: (column: "mission_date", value: string) => Promise<{ data: { mission_id: string }[] | null; error: { code?: string; message: string } | null }>;
      };
    };
  };
};

/** 今日もう達成したミッション。テーブルがまだ無い環境では空（ミッションは遊べるが記録されない） */
async function getMissionsDone(supabase: unknown, userId: string, date: string): Promise<string[]> {
  const { data, error } = await (supabase as MissionQuery).from("osanpo_run_missions").select("mission_id").eq("user_id", userId).eq("mission_date", date);
  if (error) {
    console.warn("Osanpo run missions are unavailable", { code: error.code, message: error.message });
    return [];
  }
  return (data ?? []).map((row) => row.mission_id);
}

export default async function OsanpoRunPage() {
  const { supabase, user } = await requireUser();
  const today = todayInJapan();
  const [ownedCounts, { todaySteps }, missionsDone, memoryPhotos, odekake] = await Promise.all([
    getOwnedItemCounts(supabase, user.id),
    getExpDashboard(supabase, user.id),
    getMissionsDone(supabase, user.id, today),
    getOsanpoRunMemoryPhotos(supabase, user.id),
    getOsanpoRunOdekake(supabase, user.id),
  ]);
  const ownedIds = new Set([...ownedCounts].filter(([, count]) => count > 0).map(([id]) => id));

  const hasImage = (item: CollectionItem): item is CollectionItem & { image: string } => Boolean(item.image);
  const owned = COLLECTION_ITEMS.filter(hasImage).filter((item) => ownedIds.has(item.id));
  const usesSampleItems = owned.length < MIN_OWNED_ITEMS;
  const samples = usesSampleItems
    ? REGULAR_ITEMS.filter(hasImage).filter((item) => item.rarity === "N" && !ownedIds.has(item.id)).slice(0, SAMPLE_ITEM_COUNT)
    : [];
  const items = [...owned, ...samples].map((item) => toRunItem(item, ownedCounts.get(item.id) ?? 0));

  const unlockedStages = OSANPO_RUN_STAGE_IDS.filter((id) => isSkinUnlocked(getDogSkin(OSANPO_RUN_STAGES[id].skin), ownedIds));
  const seriesTabs = SERIES.map((series) => ({ id: series.id, name: series.name.replace(/シリーズ$/, "") }));

  return (
    <OsanpoRunGame
      items={items}
      usesSampleItems={usesSampleItems}
      unlockedStages={unlockedStages}
      seriesTabs={seriesTabs}
      categoryLabels={CATEGORY_LABELS}
      todaySteps={todaySteps}
      missions={getDailyMissions(today)}
      missionsDone={missionsDone}
      memoryPhotos={memoryPhotos}
      odekake={odekake}
    />
  );
}
