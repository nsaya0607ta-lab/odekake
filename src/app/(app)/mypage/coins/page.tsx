import { CoinPill } from "@/components/coin-badge";
import { CoinHero } from "@/components/coin-hero";
import { CoinShopPreview } from "@/components/coin-shop-preview";
import { CoinUseCards } from "@/components/coin-use-cards";
import { IconCoin, IconHome, IconLock, IconMapPin, IconPaw } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { TopHeader } from "@/components/page-header";
import {
  LEVEL_UP_COIN_BANDS,
  MAX_DAILY_STEP_COINS,
  STEP_COIN_TIERS,
  formatCoins,
  getStepCoins,
  getUnlockCost,
} from "@/lib/coins";
import { loadAreaIndex } from "@/lib/data/areas";
import { getCoinHistory, getCoinSummary } from "@/lib/data/coins";
import { getExpDashboard } from "@/lib/data/exp";
import { getRecordSpace } from "@/lib/data/space";
import { getExpProgress, LEVEL_REWARDS } from "@/lib/exp";
import { MUNICIPALITIES, PREFECTURES } from "@/lib/geo";
import type { CoinEventRow, Json } from "@/lib/supabase/types";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "おでかけコイン | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function CoinsPage() {
  const { supabase, user } = await requireUser();
  const space = await getRecordSpace(supabase, user.id);

  const [summary, history, expDashboard, areas] = await Promise.all([
    getCoinSummary(supabase, user.id),
    getCoinHistory(supabase, user.id),
    getExpDashboard(supabase, user.id),
    loadAreaIndex(supabase, space.tripIds),
  ]);

  const progress = getExpProgress(expDashboard.totalExp);
  const nextReward = progress.nextReward;
  const nextRewardCost = getUnlockCost(nextReward);
  const stepCoinTotals = STEP_COIN_TIERS.map((tier, index) => ({
    ...tier,
    total: STEP_COIN_TIERS.slice(0, index + 1).reduce((sum, current) => sum + current.coins, 0),
  }));

  return (
    <>
      <TopHeader
        title={
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="min-w-0 truncate">{space.name}</span>
            <IconPaw size={15} className="shrink-0 text-ink-faint" />
          </span>
        }
        subtitle="おでかけも、思い出も、いっしょに。"
        action={<CoinPill balance={summary.balance} />}
      />

      <PageBody>
        {/* 画面全体の余白は PageBody（space-y-6）より詰めたいので、内側で持つ */}
        <div className="space-y-4">
        <CoinHero balance={summary.balance} todayCoins={getStepCoins(expDashboard.todaySteps)} />

        <CoinUseCards />

        <CoinShopPreview />

        <section className="rough-card grid grid-cols-3 gap-1 px-2.5 py-3.5">
          <RecordStat
            icon={<IconMapPin size={16} />}
            label="おでかけした場所"
            value={areas.totals.visitedPrefectures}
            unit={`/ ${PREFECTURES.length}`}
            note="都道府県"
            tone="blossom"
          />
          <RecordStat
            icon={<IconHome size={16} />}
            label="訪れたエリア"
            value={areas.totals.visitedMunicipalities}
            unit={`/ ${MUNICIPALITIES.length}`}
            note="市区町村など"
            tone="sky"
          />
          <RecordStat
            icon={<IconPaw size={16} />}
            label="訪問数"
            value={areas.totals.visits}
            unit="回"
            note="記録したおでかけ"
            tone="leaf"
          />
        </section>

        <section className="rough-card overflow-hidden p-5">
          <p className="flex items-center gap-1.5 text-sm font-bold">
            <IconLock size={16} className="text-ink-faint" />
            次に解放できるもの
          </p>
          {nextReward ? (
            <>
              <p className="mt-2 text-lg font-bold">{nextReward.name}</p>
              <p className="mt-1 text-xs text-ink-soft">
                Lv.{nextReward.level}で解放・必要コイン {formatCoins(nextRewardCost)}枚
              </p>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-paper-deep">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sun to-[#d3a044]"
                  style={{
                    width: `${Math.min(100, (summary.balance / Math.max(1, nextRewardCost)) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-ink-soft">
                {summary.balance >= nextRewardCost
                  ? "コインは足りています。"
                  : `あと ${formatCoins(nextRewardCost - summary.balance)}枚です。`}
                Lv.{nextReward.level}に上がると解放されます。
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">Lv.30の報酬まですべて解放済みです。</p>
          )}
        </section>

        <section id="coin-how-to-get" className="rough-card overflow-hidden scroll-mt-20">
          <p className="border-b border-line px-4 py-3 font-bold">コインのもらい方</p>

          <div className="px-4 py-4">
            <p className="text-sm font-bold">レベルアップ報酬</p>
            <p className="mt-1 text-xs text-ink-soft">到達したレベルごとに1回もらえます。</p>
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {LEVEL_UP_COIN_BANDS.map((band, index) => {
                const from = index === 0 ? 2 : LEVEL_UP_COIN_BANDS[index - 1]!.maxLevel + 1;
                const label = from === band.maxLevel ? `Lv.${from}` : `Lv.${from}〜${band.maxLevel}`;
                return (
                  <li key={band.maxLevel} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className={progress.level >= from ? "font-bold" : "text-ink-soft"}>{label}</span>
                    <span className="flex items-center gap-1 tabular-nums">
                      <IconCoin size={14} />
                      {formatCoins(band.coins)}枚
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="border-t border-line px-4 py-4">
            <p className="text-sm font-bold">歩数報酬</p>
            <p className="mt-1 text-xs text-ink-soft">
              1日の歩数で段階的にもらえます（1日 最大{MAX_DAILY_STEP_COINS}枚）。
            </p>
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {stepCoinTotals.map((tier) => (
                <li key={tier.steps} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span>{tier.steps.toLocaleString("ja-JP")}歩</span>
                  <span className="flex items-center gap-1 tabular-nums text-ink-soft">
                    <IconCoin size={14} />+{tier.coins}枚
                    <span className="ml-1 text-xs text-ink-faint">（合計{tier.total}枚）</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-faint">
              歩数は同じ日のうちに増えた分だけ足されます。歩数の連携はマイページの「iPhone歩数連携」から設定できます。
            </p>
          </div>
        </section>

        <section>
          <h2 className="mb-2 px-1 text-sm font-bold">コインの履歴</h2>
          {history.length === 0 ? (
            <div className="rough-card px-5 py-10 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sun-soft">
                <IconCoin size={24} />
              </span>
              <p className="mt-3 text-sm font-bold">まだコインの履歴がありません</p>
              <p className="mt-1 text-xs text-ink-soft">
                レベルアップと歩数でコインがたまると、ここに残ります。
              </p>
            </div>
          ) : (
            <ul className="rough-card divide-y divide-line overflow-hidden">
              {history.map((event) => (
                <li key={event.id} className="flex min-w-0 items-center gap-3 px-4 py-3.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sun-soft">
                    <IconCoin size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{eventLabel(event)}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-ink-faint">
                      {formatEventDate(event.created_at)}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-sm font-bold tabular-nums ${
                      event.amount < 0 ? "text-ink-soft" : "text-[#b8862f]"
                    }`}
                  >
                    {event.amount < 0 ? "" : "+"}
                    {formatCoins(event.amount)}枚
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <details className="rough-card overflow-hidden">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-bold">
            <span>解放に必要なコイン</span>
            <span className="shrink-0 text-xs font-normal text-ink-faint">Lv.2〜30</span>
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
                  <span className="flex shrink-0 items-center gap-1 text-xs tabular-nums text-ink-soft">
                    <IconCoin size={13} />
                    {formatCoins(getUnlockCost(reward))}
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
        </div>
      </PageBody>
    </>
  );
}

function RecordStat({
  icon,
  label,
  value,
  unit,
  note,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  unit: string;
  note: string;
  tone: "blossom" | "sky" | "leaf";
}) {
  const toneClass = {
    blossom: "bg-blossom-soft text-[#95505e]",
    sky: "bg-sky-soft text-[#42718f]",
    leaf: "bg-leaf-soft text-leaf-deep",
  }[tone];

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${toneClass}`}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[9px] leading-tight text-ink-soft">{label}</span>
        <span className="flex items-baseline gap-0.5">
          <span className="text-lg leading-none font-bold tabular-nums">{value}</span>
          <span className="text-[9px] text-ink-faint tabular-nums">{unit}</span>
        </span>
        <span className="block truncate text-[9px] leading-tight text-ink-faint">{note}</span>
      </span>
    </div>
  );
}

function metadataObject(metadata: Json): { [key: string]: Json | undefined } {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};
}

function eventLabel(event: CoinEventRow): string {
  const metadata = metadataObject(event.metadata);
  const label = typeof metadata.label === "string" ? metadata.label : "コインを獲得";
  const steps = typeof metadata.steps === "number" ? metadata.steps : null;
  const level = typeof metadata.level === "number" ? metadata.level : event.level;

  if (event.event_type === "steps" && steps !== null) {
    return `${label}（${steps.toLocaleString("ja-JP")}歩）`;
  }
  if (event.event_type === "level_up" && level !== null) return `${label}（Lv.${level}）`;
  return label;
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
