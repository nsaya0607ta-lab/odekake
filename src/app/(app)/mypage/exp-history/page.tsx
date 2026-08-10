import Link from "next/link";
import { IconChevronRight, IconStar } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { getExpHistory } from "@/lib/data/exp";
import { getExpProgress, LEVEL_REWARDS } from "@/lib/exp";
import { getMunicipality } from "@/lib/geo/municipalities";
import { PREFECTURE_NAMES } from "@/lib/geo/prefecture-names";
import type { ExpEventRow, Json } from "@/lib/supabase/types";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "EXP履歴 | おでかけ記録" };
export const dynamic = "force-dynamic";

const REGION_NAMES: Record<string, string> = {
  hokkaido: "北海道地方",
  tohoku: "東北地方",
  kanto: "関東地方",
  chubu: "中部地方",
  kinki: "近畿地方",
  chugoku: "中国地方",
  shikoku: "四国地方",
  "kyushu-okinawa": "九州・沖縄地方",
};

export default async function ExpHistoryPage() {
  const { supabase, user } = await requireUser();
  const [{ data: savedExp }, history] = await Promise.all([
    supabase.from("user_exp").select("total_exp").eq("user_id", user.id).maybeSingle(),
    getExpHistory(supabase, user.id),
  ]);
  const progress = getExpProgress(savedExp?.total_exp ?? 0);
  const unlockedCount = LEVEL_REWARDS.filter((reward) => reward.level <= progress.level).length;

  return (
    <>
      <PageHeader title="EXP獲得履歴" backHref="/mypage" />
      <PageBody>
        <section className="rough-card overflow-hidden p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-[0.08em] text-ink-soft">おでかけレベル</p>
              <p className="mt-1 text-4xl leading-none font-bold tabular-nums">
                <span className="mr-1 text-sm text-ink-soft">Lv.</span>
                {progress.level}
              </p>
            </div>
            <p className="text-right text-xs text-ink-soft">
              <span className="block text-lg font-bold tabular-nums text-ink">
                {progress.totalExp.toLocaleString("ja-JP")} EXP
              </span>
              {unlockedCount}個の報酬を解放
            </p>
          </div>

          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-paper-deep">
            <div
              className="h-full rounded-full bg-gradient-to-r from-leaf to-leaf-deep"
              style={{ width: `${progress.progressPercent}%` }}
            />
          </div>
          <p className="mt-2 truncate text-xs text-ink-soft">
            {progress.nextReward
              ? `次に解放：${progress.nextReward.name}（Lv.${progress.nextReward.level}）`
              : "Lv.30の報酬まですべて解放済みです"}
          </p>
        </section>

        <Link
          href="/mypage/gear"
          className="rough-card flex items-center gap-3 p-4 active:scale-[0.99]"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-leaf-soft text-lg">
            🐾
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">おぼえたしぐさを見る</span>
            <span className="mt-0.5 block text-[11px] text-ink-soft">おさんぽ中のフレブルが自動で使います</span>
          </span>
          <IconChevronRight size={18} className="shrink-0 text-ink-faint" />
        </Link>

        <section>
          <h2 className="mb-2 px-1 text-sm font-bold">獲得したEXP</h2>
          {history.length === 0 ? (
            <div className="rough-card px-5 py-10 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sun-soft text-sun">
                <IconStar size={23} />
              </span>
              <p className="mt-3 text-sm font-bold">まだEXP履歴がありません</p>
              <p className="mt-1 text-xs text-ink-soft">訪問を記録すると、獲得理由がここに残ります。</p>
            </div>
          ) : (
            <ul className="rough-card divide-y divide-line overflow-hidden">
              {history.map((event) => (
                <li key={event.id} className="flex min-w-0 items-center gap-3 px-4 py-3.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sun-soft text-sun">
                    <IconStar size={17} filled />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{eventLabel(event)}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-ink-faint">
                      {[locationLabel(event), formatEventDate(event.created_at)].filter(Boolean).join("・")}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-leaf-deep">+{event.exp} EXP</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <details className="rough-card overflow-hidden">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-bold">
            <span>Lv.2〜30の解放報酬</span>
            <span className="shrink-0 text-xs font-normal text-ink-faint">{unlockedCount} / 29 解放</span>
          </summary>
          <ul className="max-h-80 divide-y divide-line overflow-y-auto border-t border-line">
            {LEVEL_REWARDS.map((reward) => {
              const unlocked = reward.level <= progress.level;
              return (
                <li key={reward.level} className="flex min-w-0 items-center gap-3 px-4 py-3">
                  <span
                    className={`flex h-8 w-12 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
                      unlocked ? "bg-leaf-soft text-leaf-deep" : "bg-paper-deep text-ink-faint"
                    }`}
                  >
                    Lv.{reward.level}
                  </span>
                  <span className={`min-w-0 flex-1 truncate text-sm ${unlocked ? "font-bold" : "text-ink-faint"}`}>
                    {reward.name}
                  </span>
                  <span className="shrink-0 text-[10px] text-ink-faint">{unlocked ? "解放済み" : "未解放"}</span>
                </li>
              );
            })}
          </ul>
        </details>
      </PageBody>
    </>
  );
}

function metadataObject(metadata: Json): { [key: string]: Json | undefined } {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};
}

function eventLabel(event: ExpEventRow): string {
  const metadata = metadataObject(event.metadata);
  const label = typeof metadata.label === "string" ? metadata.label : "EXPを獲得";
  const spotName = typeof metadata.spot_name === "string" ? metadata.spot_name : null;
  const steps = typeof metadata.steps === "number" ? metadata.steps : null;

  if (event.event_type === "steps" && steps !== null) return `${label}（${steps.toLocaleString("ja-JP")}歩）`;
  return spotName ? `${label}・${spotName}` : label;
}

function locationLabel(event: ExpEventRow): string | null {
  const metadata = metadataObject(event.metadata);
  if (event.event_type === "first_region" && typeof metadata.region === "string") {
    return REGION_NAMES[metadata.region] ?? metadata.region;
  }
  if (event.municipality_code) return getMunicipality(event.municipality_code)?.name ?? event.municipality_code;
  if (event.prefecture_code) {
    return PREFECTURE_NAMES.find((prefecture) => prefecture.code === event.prefecture_code)?.name ?? null;
  }
  return null;
}

function formatEventDate(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
