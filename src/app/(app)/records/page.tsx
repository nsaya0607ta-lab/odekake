import Link from "next/link";
import { IconChevronRight, IconNotebook } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { TopHeader } from "@/components/page-header";
import { SpotBrowser } from "@/components/spot-browser";
import { TimelineCard } from "@/components/timeline-card";
import { EmptyState, TripTypeBadge } from "@/components/ui";
import { loadCategoryNames, getSpotPage } from "@/lib/data/spots";
import { formatTripPeriod, getTripSummaries } from "@/lib/data/trips";
import { getCalendarVisits, getTimeline } from "@/lib/data/visits";
import { resolveWorkspace, type Workspace } from "@/lib/data/workspace";
import { WorkspaceBar } from "@/components/workspace-bar";
import { requireUser } from "@/lib/supabase/server";
import { RecordCalendar } from "./record-calendar";
import { RecordTabs, type RecordTab } from "./record-tabs";

export const metadata = { title: "記録 | おでかけ記録" };
export const dynamic = "force-dynamic";

const TABS: Array<{ key: RecordTab; label: string }> = [
  { key: "timeline", label: "タイムライン" },
  { key: "trips", label: "旅行" },
  { key: "spots", label: "スポット" },
  { key: "calendar", label: "カレンダー" },
];

/** 1回に読み込む件数。「もっと見る」で増やす */
const PAGE_SIZE = 30;

function parseShown(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return PAGE_SIZE;
  // URL をいじって極端な値を入れられても、1画面の読み込み量を抑える
  return Math.min(parsed, PAGE_SIZE * 20);
}

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; shown?: string; q?: string }>;
}) {
  const [{ tab: tabParam, shown: shownParam, q }, { supabase, user }] = await Promise.all([
    searchParams,
    requireUser(),
  ]);

  const tab: RecordTab = TABS.some((t) => t.key === tabParam) ? (tabParam as RecordTab) : "timeline";
  const shown = parseShown(shownParam);
  const keyword = (q ?? "").slice(0, 100);
  const workspace = await resolveWorkspace(supabase, user.id);

  return (
    <>
      <TopHeader title="記録" />
      <PageBody>
        <WorkspaceBar workspace={workspace} />

        <RecordTabs tabs={TABS} current={tab} />

        {tab === "timeline" ? <TimelineTab supabase={supabase} workspace={workspace} shown={shown} /> : null}
        {tab === "trips" ? <TripsTab supabase={supabase} userId={user.id} workspace={workspace} /> : null}
        {tab === "spots" ? (
          <SpotsTab supabase={supabase} workspace={workspace} shown={shown} keyword={keyword} />
        ) : null}
        {tab === "calendar" ? <CalendarTab supabase={supabase} workspace={workspace} /> : null}
      </PageBody>
    </>
  );
}

type SupabaseArg = Awaited<ReturnType<typeof requireUser>>["supabase"];

function MoreButton({ tab, shown, keyword }: { tab: RecordTab; shown: number; keyword?: string }) {
  const params = new URLSearchParams({ tab, shown: String(shown + PAGE_SIZE) });
  if (keyword) params.set("q", keyword);

  return (
    <Link href={`/records?${params.toString()}`} scroll={false} className="btn btn-quiet w-full">
      もっと見る
    </Link>
  );
}

async function TimelineTab({
  supabase,
  workspace,
  shown,
}: {
  supabase: SupabaseArg;
  workspace: Workspace;
  shown: number;
}) {
  // 1件多く読んで、次のページがあるかを確かめる
  const items = await getTimeline(supabase, { tripIds: workspace.tripIds, limit: shown + 1 });
  const hasMore = items.length > shown;
  const page = hasMore ? items.slice(0, shown) : items;

  if (page.length === 0) {
    return (
      <EmptyState
        icon={<IconNotebook size={30} />}
        title="まだ記録がありません"
        description="訪れた場所を記録すると、日付順に並びます。"
        actionHref="/add"
        actionLabel="記録を追加する"
      />
    );
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {page.map((item) => (
          <li key={item.id}>
            <TimelineCard item={item} />
          </li>
        ))}
      </ul>
      {hasMore ? <MoreButton tab="timeline" shown={shown} /> : null}
    </div>
  );
}

async function TripsTab({
  supabase,
  userId,
  workspace,
}: {
  supabase: SupabaseArg;
  userId: string;
  workspace: Workspace;
}) {
  const all = await getTripSummaries(supabase, userId);
  const trips = all.filter(
    (t) =>
      workspace.tripIds.includes(t.trip.id) &&
      // 日程のない solo は「普段のおでかけ」の内部保存先なので旅行タブには出さない。
      !(t.trip.trip_type === "solo" && !t.trip.start_date && !t.trip.end_date),
  );

  if (trips.length === 0) {
    return (
      <EmptyState
        title="旅行計画がありません"
        description="日程のある旅行を作ると、ここに予定や過去の旅行が並びます。"
        actionHref="/trips/new"
        actionLabel="旅行の計画を立てる"
      />
    );
  }

  return (
    <ul className="space-y-2">
      {trips.map(({ trip, memberCount, visitCount }) => (
        <li key={trip.id}>
          <Link
            href={`/trips/${trip.id}`}
            className="rough-card flex items-center gap-3 px-4 py-3 transition-transform active:scale-[0.99]"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{trip.title}</span>
              <span className="mt-1 flex flex-wrap items-center gap-1.5">
                <TripTypeBadge
                  type={trip.trip_type}
                  memberCount={trip.trip_type === "shared" ? memberCount : undefined}
                />
                <span className="text-xs text-ink-faint">
                  {formatTripPeriod(trip) ?? "日程未設定"}・{visitCount}件
                </span>
              </span>
            </span>
            <IconChevronRight size={18} className="shrink-0 text-ink-faint" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function SpotsTab({
  supabase,
  workspace,
  shown,
  keyword,
}: {
  supabase: SupabaseArg;
  workspace: Workspace;
  shown: number;
  keyword: string;
}) {
  const [{ spots, hasMore }, categoryNames] = await Promise.all([
    getSpotPage(supabase, workspace.tripIds, {
      // 個人旅の空間では、スポット登録直後で訪問履歴がまだ無い場所も一覧に出す。
      // 共有旅は旅行との関連が訪問履歴で決まるため、従来どおりその旅行で訪問した場所だけに限定する。
      includeUnvisited: workspace.kind === "personal",
      limit: shown,
      keyword,
    }),
    loadCategoryNames(supabase),
  ]);

  if (spots.length === 0) {
    return keyword ? (
      <EmptyState
        title={`「${keyword}」に一致するスポットがありません`}
        description="別の言葉で探すか、検索欄を空にして一覧に戻してください。"
        actionHref="/records?tab=spots"
        actionLabel="検索を解除する"
      />
    ) : (
      <EmptyState
        title="スポットがありません"
        description="訪れた場所を登録すると、ここに並びます。"
        actionHref="/spots/new"
        actionLabel="スポットを登録する"
      />
    );
  }

  return (
    <div className="space-y-3">
      <SpotBrowser
        spots={spots}
        categories={[...categoryNames.entries()].map(([id, name]) => ({ id, name }))}
        search={{ action: "/records", keyword, hiddenFields: { tab: "spots" } }}
      />
      {hasMore ? <MoreButton tab="spots" shown={shown} keyword={keyword} /> : null}
    </div>
  );
}

async function CalendarTab({ supabase, workspace }: { supabase: SupabaseArg; workspace: Workspace }) {
  const items = await getCalendarVisits(supabase, workspace.tripIds);

  return (
    <RecordCalendar
      entries={items.map((item) => ({
        id: item.id,
        date: item.visitedAt,
        spotId: item.spotId,
        spotName: item.spotName,
        tripTitle: item.tripTitle,
      }))}
    />
  );
}
