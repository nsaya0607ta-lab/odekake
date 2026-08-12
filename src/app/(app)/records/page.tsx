import Link from "next/link";
import { IconChevronRight, IconNotebook } from "@/components/icons";
import { JourneyScopeSwitcher, type JourneyScopeOption } from "@/components/journey-scope-switcher";
import { PageBody } from "@/components/page-body";
import { TopHeader } from "@/components/page-header";
import { SpotBrowser } from "@/components/spot-browser";
import { TimelineCard } from "@/components/timeline-card";
import { EmptyState } from "@/components/ui";
import { loadCategoryNames, getSpotPage } from "@/lib/data/spots";
import { formatTripPeriod, getRecordDestinationHierarchy, getTripSummaries } from "@/lib/data/trips";
import { getCalendarVisits, getTimeline } from "@/lib/data/visits";
import { getRecordSpace, type RecordSpace } from "@/lib/data/space";
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
  return Math.min(parsed, PAGE_SIZE * 20);
}

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    shown?: string;
    q?: string;
    recordTrip?: string;
    recordJourney?: string;
    scopeTrip?: string;
  }>;
}) {
  const [
    { tab: tabParam, shown: shownParam, q, recordTrip, recordJourney, scopeTrip },
    { supabase, user },
  ] = await Promise.all([searchParams, requireUser()]);

  const tab: RecordTab = TABS.some((t) => t.key === tabParam) ? (tabParam as RecordTab) : "timeline";
  const shown = parseShown(shownParam);
  const keyword = (q ?? "").slice(0, 100);
  const personalSpace = await getRecordSpace(supabase, user.id);
  const destinations = await getRecordDestinationHierarchy(supabase, user.id, personalSpace.name);
  const roots = [...(destinations.personal ? [destinations.personal] : []), ...destinations.shared];
  const selectedRoot = roots.find((root) => root.kind === "shared" && root.id === scopeTrip) ?? destinations.personal ?? roots[0] ?? null;

  const scopeOptions: JourneyScopeOption[] = roots.map((root) => ({
    value: root.kind === "personal" ? "personal" : root.id,
    name: root.title,
    kind: root.kind,
  }));
  const selectedScopeValue = selectedRoot?.kind === "shared" ? selectedRoot.id : "personal";
  const scopeSpace: RecordSpace = selectedRoot
    ? { name: selectedRoot.title, tripIds: [selectedRoot.id] }
    : personalSpace;

  let spotSpace = scopeSpace;
  if (recordTrip) {
    const { data: accessibleRoot } = await supabase
      .from("trips")
      .select("id")
      .eq("id", recordTrip)
      .is("parent_trip_id", null)
      .maybeSingle();
    if (accessibleRoot) spotSpace = { ...scopeSpace, tripIds: [accessibleRoot.id] };
  }

  return (
    <>
      <TopHeader
        title="記録"
        subtitle={scopeSpace.name}
        action={
          scopeOptions.length > 1 ? (
            <JourneyScopeSwitcher
              options={scopeOptions}
              selectedValue={selectedScopeValue}
              basePath="/records"
              queryKey="scopeTrip"
              triggerLabel="旅を切り替え"
              preserveParams={{ tab }}
            />
          ) : undefined
        }
      />
      <PageBody>
        <RecordTabs tabs={TABS} current={tab} scopeTrip={selectedRoot?.kind === "shared" ? selectedRoot.id : undefined} />

        {tab === "timeline" ? (
          <TimelineTab
            supabase={supabase}
            space={scopeSpace}
            shown={shown}
            scopeTrip={selectedRoot?.kind === "shared" ? selectedRoot.id : undefined}
          />
        ) : null}
        {tab === "trips" ? <TripsTab supabase={supabase} rootId={selectedRoot?.id} /> : null}
        {tab === "spots" ? (
          <SpotsTab
            supabase={supabase}
            space={spotSpace}
            shown={shown}
            keyword={keyword}
            recordTrip={recordTrip}
            recordJourney={recordJourney}
            scopeTrip={selectedRoot?.kind === "shared" ? selectedRoot.id : undefined}
          />
        ) : null}
        {tab === "calendar" ? <CalendarTab supabase={supabase} space={scopeSpace} /> : null}
      </PageBody>
    </>
  );
}

type SupabaseArg = Awaited<ReturnType<typeof requireUser>>["supabase"];

function MoreButton({
  tab,
  shown,
  keyword,
  scopeTrip,
}: {
  tab: RecordTab;
  shown: number;
  keyword?: string;
  scopeTrip?: string;
}) {
  const params = new URLSearchParams({ tab, shown: String(shown + PAGE_SIZE) });
  if (keyword) params.set("q", keyword);
  if (scopeTrip) params.set("scopeTrip", scopeTrip);

  return (
    <Link href={`/records?${params.toString()}`} scroll={false} className="btn btn-quiet w-full">
      もっと見る
    </Link>
  );
}

async function TimelineTab({
  supabase,
  space,
  shown,
  scopeTrip,
}: {
  supabase: SupabaseArg;
  space: RecordSpace;
  shown: number;
  scopeTrip?: string;
}) {
  const items = await getTimeline(supabase, { tripIds: space.tripIds, limit: shown + 1 });
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
      {hasMore ? <MoreButton tab="timeline" shown={shown} scopeTrip={scopeTrip} /> : null}
    </div>
  );
}

async function TripsTab({ supabase, rootId }: { supabase: SupabaseArg; rootId?: string }) {
  const all = await getTripSummaries(supabase);
  const trips = all.filter(
    (t) =>
      (t.trip.start_date || t.trip.end_date) &&
      (!rootId || t.trip.parent_trip_id === rootId),
  );

  if (trips.length === 0) {
    return (
      <EmptyState
        title="旅行計画がありません"
        description="日程のある旅行を作ると、ここに予定や過去の旅行が並びます。"
        actionHref={rootId ? `/trips/new?parent=${encodeURIComponent(rootId)}` : "/trips/new"}
        actionLabel="旅行の計画を立てる"
      />
    );
  }

  return (
    <ul className="space-y-2">
      {trips.map(({ trip, visitCount }) => (
        <li key={trip.id}>
          <Link
            href={`/trips/${trip.id}`}
            className="rough-card flex items-center gap-3 px-4 py-3 transition-transform active:scale-[0.99]"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{trip.title}</span>
              <span className="mt-1 block text-xs text-ink-faint">
                {formatTripPeriod(trip) ?? "日程未設定"}・{visitCount}件
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
  space,
  shown,
  keyword,
  recordTrip,
  recordJourney,
  scopeTrip,
}: {
  supabase: SupabaseArg;
  space: RecordSpace;
  shown: number;
  keyword: string;
  recordTrip?: string;
  recordJourney?: string;
  scopeTrip?: string;
}) {
  const [{ spots, hasMore }, categoryNames] = await Promise.all([
    getSpotPage(supabase, space.tripIds, {
      includeUnvisited: true,
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
        actionHref={`/records?tab=spots${scopeTrip ? `&scopeTrip=${encodeURIComponent(scopeTrip)}` : ""}`}
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
        search={{
          action: "/records",
          keyword,
          hiddenFields: {
            tab: "spots",
            ...(scopeTrip ? { scopeTrip } : {}),
            ...(recordTrip ? { recordTrip } : {}),
            ...(recordJourney ? { recordJourney } : {}),
          },
        }}
        detailHrefSuffix={recordTrip ? `?recordTrip=${encodeURIComponent(recordTrip)}${recordJourney ? `&recordJourney=${encodeURIComponent(recordJourney)}` : ""}` : ""}
      />
      {hasMore ? <MoreButton tab="spots" shown={shown} keyword={keyword} scopeTrip={scopeTrip} /> : null}
    </div>
  );
}

async function CalendarTab({ supabase, space }: { supabase: SupabaseArg; space: RecordSpace }) {
  const items = await getCalendarVisits(supabase, space.tripIds);

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
