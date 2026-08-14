import { IconCoin } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { formatCoins } from "@/lib/coins";
import { getCoinHistory, getCoinSummary } from "@/lib/data/coins";
import type { CoinEventRow, Json } from "@/lib/supabase/types";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "コイン履歴 | おでかけ記録" };
export const dynamic = "force-dynamic";

const EVENT_LABELS: Record<CoinEventRow["event_type"], string> = {
  level_up: "レベルアップ報酬",
  steps: "歩数コイン",
  unlock: "アンロック",
  gacha: "ガチャ",
  login: "ログインボーナス",
  item_catch: "アイテムキャッチ",
};

export default async function CoinHistoryPage() {
  const { supabase, user } = await requireUser();
  const [summary, history] = await Promise.all([
    getCoinSummary(supabase, user.id),
    getCoinHistory(supabase, user.id),
  ]);

  return (
    <>
      <PageHeader title="コイン獲得履歴" backHref="/mypage/coins" />
      <PageBody>
        <section className="rough-card overflow-hidden p-5">
          <p className="text-xs font-bold tracking-[0.08em] text-ink-soft">いま使えるコイン</p>
          <p className="mt-1 flex items-center gap-1.5 text-4xl leading-none font-bold tabular-nums">
            <IconCoin size={28} />
            {formatCoins(summary.balance)}
          </p>
          <p className="mt-2 text-xs text-ink-soft">
            これまでに獲得した合計：{formatCoins(summary.totalEarned)} コイン
          </p>
        </section>

        <section>
          <h2 className="mb-2 px-1 text-sm font-bold">コインの履歴</h2>
          {history.length === 0 ? (
            <div className="rough-card px-5 py-10 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sun-soft text-sun">
                <IconCoin size={23} />
              </span>
              <p className="mt-3 text-sm font-bold">まだコイン履歴がありません</p>
              <p className="mt-1 text-xs text-ink-soft">ログインや歩数記録などで、獲得・利用の理由がここに残ります。</p>
            </div>
          ) : (
            <ul className="rough-card divide-y divide-line overflow-hidden">
              {history.map((event) => {
                const positive = event.amount >= 0;
                return (
                  <li key={event.id} className="flex min-w-0 items-center gap-3 px-4 py-3.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sun-soft text-sun">
                      <IconCoin size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{eventLabel(event)}</span>
                      <span className="mt-0.5 block truncate text-[10px] text-ink-faint">
                        {formatEventDate(event.created_at)}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 text-sm font-bold tabular-nums ${
                        positive ? "text-leaf-deep" : "text-ink-faint"
                      }`}
                    >
                      {positive ? "+" : ""}
                      {formatCoins(event.amount)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </PageBody>
    </>
  );
}

function metadataObject(metadata: Json): { [key: string]: Json | undefined } {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};
}

function eventLabel(event: CoinEventRow): string {
  const metadata = metadataObject(event.metadata);
  const label = typeof metadata.label === "string" ? metadata.label : EVENT_LABELS[event.event_type];
  const steps = typeof metadata.steps === "number" ? metadata.steps : null;
  const streakDay = typeof metadata.streak_day === "number" ? metadata.streak_day : null;
  const draws = typeof metadata.draws === "number" ? metadata.draws : null;

  if (event.event_type === "steps" && steps !== null) return `${label}（${steps.toLocaleString("ja-JP")}歩）`;
  if (event.event_type === "login" && streakDay !== null) return `${label}（${streakDay}日目）`;
  if (event.event_type === "gacha" && draws !== null) return `${label}（${draws}回）`;
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
