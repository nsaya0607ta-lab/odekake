import Link from "next/link";
import { notFound } from "next/navigation";
import { IconMapPin, IconPlus, IconSliders } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { TimelineCard } from "@/components/timeline-card";
import { EmptyState } from "@/components/ui";
import { formatTripPeriod, getTripCoverUrl } from "@/lib/data/trips";
import { getTimeline } from "@/lib/data/visits";
import { parseTripDestinationAreas, tripDestinationAreaLabel } from "@/lib/trip-destinations";
import { requireUser } from "@/lib/supabase/server";
import type { TripRow } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const { supabase } = await requireUser();
  const { data } = await supabase.from("trips").select("title").eq("id", tripId).maybeSingle();
  return { title: data ? `${data.title} | おでかけ記録` : "おでかけ記録" };
}

export default async function TripDetailPage({ params }: { params: Promise<{ tripId: string }> }) {
  const [{ tripId }, { supabase, user }] = await Promise.all([params, requireUser()]);

  const { data: tripData } = await supabase.from("trips").select("*").eq("id", tripId).maybeSingle();
  // 自分の旅行でなければ RLS により取得できないため、存在しない扱いにする
  if (!tripData) notFound();
  const trip = tripData as TripRow;

  // 1画面の読み込み量を抑えるため上限を設け、超えた分は記録画面へ誘導する
  const VISIT_LIMIT = 50;
  const [loadedVisits, coverUrl] = await Promise.all([
    getTimeline(supabase, { journeyId: trip.id, limit: VISIT_LIMIT + 1 }),
    getTripCoverUrl(supabase, trip),
  ]);

  const hasMoreVisits = loadedVisits.length > VISIT_LIMIT;
  const visits = hasMoreVisits ? loadedVisits.slice(0, VISIT_LIMIT) : loadedVisits;

  const isOwner = trip.owner_id === user.id;
  const period = formatTripPeriod(trip);
  const destinationAreas = parseTripDestinationAreas(
    (trip as TripRow & { destination_areas?: unknown }).destination_areas,
  );

  return (
    <>
      <PageHeader
        title={trip.title}
        backHref="/records?tab=trips"
        action={
          isOwner ? (
            <Link
              href={`/trips/${trip.id}/settings`}
              aria-label="旅行の設定"
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink-soft active:bg-paper-deep"
            >
              <IconSliders />
            </Link>
          ) : undefined
        }
      />

      <PageBody>
        <section className="rough-card overflow-hidden">
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="" className="aspect-[16/9] w-full object-cover" />
          ) : null}
          <div className="space-y-2 p-5">
            <h2 className="text-lg font-bold">{trip.title}</h2>
            {period ? <p className="text-sm text-ink-soft tabular-nums">{period}</p> : null}
            {destinationAreas.length > 0 ? (
              <div className="flex items-start gap-2 text-sm text-ink-soft">
                <IconMapPin size={17} className="mt-0.5 shrink-0 text-leaf-deep" />
                <p>
                  <span className="mr-2 text-xs font-semibold text-ink-faint">行き先</span>
                  {destinationAreas.map(tripDestinationAreaLabel).join("・")}
                </p>
              </div>
            ) : null}
            {trip.description ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink-soft">{trip.description}</p>
            ) : null}
            <p className="text-sm text-ink-soft">
              訪問スポット{" "}
              <span className="font-bold text-ink tabular-nums">
                {visits.length}
                {hasMoreVisits ? "+" : ""}
              </span>{" "}
              件
            </p>
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-base font-bold">訪問スポット</h2>
            <Link href={trip.parent_trip_id ? `/spots/new?trip=${trip.parent_trip_id}&journey=${trip.id}` : "/add"} className="flex items-center gap-1 text-sm text-leaf-deep">
              <IconPlus size={15} />
              記録を追加
            </Link>
          </div>
          {visits.length === 0 ? (
            <EmptyState
              title="まだ記録がありません"
              description="訪れた場所を追加すると、ここに並びます。"
              actionHref={trip.parent_trip_id ? `/spots/new?trip=${trip.parent_trip_id}&journey=${trip.id}` : "/add"}
              actionLabel="記録を追加する"
            />
          ) : (
            <>
              <ul className="space-y-3">
                {visits.map((item) => (
                  <li key={item.id}>
                    <TimelineCard item={item} showTrip={false} />
                  </li>
                ))}
              </ul>
              {hasMoreVisits ? (
                <Link href="/records" className="btn btn-quiet mt-3 w-full">
                  すべての記録を見る
                </Link>
              ) : null}
            </>
          )}
        </section>

      </PageBody>
    </>
  );
}
