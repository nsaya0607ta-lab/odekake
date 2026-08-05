import Link from "next/link";
import { IconChevronRight, IconNotebook } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { TopHeader } from "@/components/page-header";
import { SpotCard } from "@/components/spot-browser";
import { TimelineCard } from "@/components/timeline-card";
import { EmptyState, TripTypeBadge } from "@/components/ui";
import { getAllSpots } from "@/lib/data/spots";
import { formatTripPeriod, getTripSummaries } from "@/lib/data/trips";
import { getTimeline } from "@/lib/data/visits";
import { requireUser } from "@/lib/supabase/server";
import { RecordCalendar } from "./record-calendar";
import { RecordTabs } from "./record-tabs";

export const metadata = { title: "記録 | おでかけ記録" };
export const dynamic = "force-dynamic";

type Tab = "timeline" | "trips" | "spots" | "calendar";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "timeline", label: "タイムライン" },
  { key: "trips", label: "旅行" },
  { key: "spots", label: "スポット" },
  { key: "calendar", label: "カレンダー" },
];

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; type?: string }>;
}) {
  const [{ tab: tabParam, type: typeParam }, { supabase, user }] = await Promise.all([
    searchParams,
    requireUser(),
  ]);

  const tab: Tab = TABS.some((t) => t.key === tabParam) ? (tabParam as Tab) : "timeline";
  const tripType = typeParam === "solo" || typeParam === "shared" ? typeParam : "all";

  return (
    <>
      <TopHeader title="記録" />
      <PageBody>
        <RecordTabs tabs={TABS} current={tab} tripType={tripType} />

        {tab === "timeline" ? <TimelineTab supabase={supabase} tripType={tripType} /> : null}
        {tab === "trips" ? <TripsTab supabase={supabase} userId={user.id} tripType={tripType} /> : null}
        {tab === "spots" ? <SpotsTab supabase={supabase} /> : null}
        {tab === "calendar" ? <CalendarTab supabase={supabase} tripType={tripType} /> : null}
      </PageBody>
    </>
  );
}

type SupabaseArg = Awaited<ReturnType<typeof requireUser>>["supabase"];

async function TimelineTab({ supabase, tripType }: { supabase: SupabaseArg; tripType: "all" | "solo" | "shared" }) {
  const items = await getTimeline(supabase, { tripType });

  if (items.length === 0) {
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
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id}>
          <TimelineCard item={item} />
        </li>
      ))}
    </ul>
  );
}

async function TripsTab({
  supabase,
  userId,
  tripType,
}: {
  supabase: SupabaseArg;
  userId: string;
  tripType: "all" | "solo" | "shared";
}) {
  const all = await getTripSummaries(supabase, userId);
  const trips = tripType === "all" ? all : all.filter((t) => t.trip.trip_type === tripType);

  if (trips.length === 0) {
    return (
      <EmptyState
        title="旅行がありません"
        description="一人旅または共有旅をつくって記録を始めましょう。"
        actionHref="/trips/new"
        actionLabel="旅行をつくる"
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

async function SpotsTab({ supabase }: { supabase: SupabaseArg }) {
  const spots = await getAllSpots(supabase);

  if (spots.length === 0) {
    return (
      <EmptyState
        title="スポットがありません"
        description="訪れた場所を登録すると、ここに並びます。"
        actionHref="/spots/new"
        actionLabel="スポットを登録する"
      />
    );
  }

  return (
    <ul className="space-y-2">
      {spots.map((spot) => (
        <li key={spot.id}>
          <SpotCard spot={spot} />
        </li>
      ))}
    </ul>
  );
}

async function CalendarTab({ supabase, tripType }: { supabase: SupabaseArg; tripType: "all" | "solo" | "shared" }) {
  const items = await getTimeline(supabase, { tripType });

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
