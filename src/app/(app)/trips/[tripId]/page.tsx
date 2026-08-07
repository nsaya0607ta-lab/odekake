import Link from "next/link";
import { notFound } from "next/navigation";
import { IconPlus, IconSliders, IconUsers } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { TimelineCard } from "@/components/timeline-card";
import { TripActivityList } from "@/components/trip-activity-list";
import { EmptyState, TripTypeBadge, formatDate } from "@/components/ui";
import { formatTripPeriod, getTripActivities, getTripCoverUrl, getTripMembers } from "@/lib/data/trips";
import { getTimeline } from "@/lib/data/visits";
import { loadDisplayNames } from "@/lib/data/spots";
import { requireUser } from "@/lib/supabase/server";
import type { TripCommentRow, TripRow } from "@/lib/supabase/types";
import { TripCommentForm } from "./trip-comment-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const { supabase } = await requireUser();
  const { data } = await supabase.from("trips").select("title").eq("id", tripId).maybeSingle();
  return { title: data ? `${data.title} | おでかけ記録` : "おでかけ記録" };
}

export default async function TripDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ tripId }, { error }, { supabase, user }] = await Promise.all([
    params,
    searchParams,
    requireUser(),
  ]);

  const { data: tripData } = await supabase.from("trips").select("*").eq("id", tripId).maybeSingle();
  // 参加していない旅行は RLS により取得できないため、存在しない扱いにする
  if (!tripData) notFound();
  const trip = tripData as TripRow;

  // 1画面の読み込み量を抑えるため上限を設け、超えた分は記録画面へ誘導する
  const VISIT_LIMIT = 50;
  const [members, loadedVisits, coverUrl, activities, { data: commentRows }] = await Promise.all([
    getTripMembers(supabase, trip.id),
    getTimeline(supabase, { tripId: trip.id, limit: VISIT_LIMIT + 1 }),
    getTripCoverUrl(supabase, trip),
    trip.trip_type === "shared" ? getTripActivities(supabase, trip.id, 30) : Promise.resolve([]),
    supabase.from("trip_comments").select("*").eq("trip_id", trip.id).order("created_at", { ascending: false }),
  ]);

  const hasMoreVisits = loadedVisits.length > VISIT_LIMIT;
  const visits = hasMoreVisits ? loadedVisits.slice(0, VISIT_LIMIT) : loadedVisits;

  const comments = (commentRows ?? []) as TripCommentRow[];
  const commentAuthors = await loadDisplayNames(
    supabase,
    comments.map((c) => c.user_id),
  );

  const isOwner = trip.owner_id === user.id;
  const isShared = trip.trip_type === "shared";
  const period = formatTripPeriod(trip);

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
        {error === "leave" ? (
          <p className="rounded-2xl border border-blossom bg-blossom-soft px-4 py-3 text-sm text-[#8f4c59]">
            この旅行から退出できませんでした。旅行の所有者は退出できません。
          </p>
        ) : null}

        <section className="rough-card overflow-hidden">
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="" className="aspect-[16/9] w-full object-cover" />
          ) : null}
          <div className="space-y-2 p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="min-w-0 flex-1 text-lg font-bold">{trip.title}</h2>
              <TripTypeBadge type={trip.trip_type} memberCount={isShared ? members.length : undefined} />
            </div>
            {period ? <p className="text-sm text-ink-soft tabular-nums">{period}</p> : null}
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

        {isShared ? (
          <section>
            <h2 className="mb-2 px-1 text-base font-bold">参加メンバー</h2>
            <ul className="rough-card divide-y divide-line">
              {members.map((member) => (
                <li key={member.userId} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper-deep text-ink-faint">
                    <IconUsers size={18} />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{member.displayName}</span>
                  <span className="rough-pill shrink-0 bg-paper-deep px-2.5 py-0.5 text-[11px] text-ink-soft">
                    {member.role === "owner" ? "オーナー" : member.role === "member" ? "メンバー" : "閲覧のみ"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {isShared ? (
          <section>
            <h2 className="mb-2 px-1 text-base font-bold">みんなの動き</h2>
            <TripActivityList entries={activities} />
          </section>
        ) : null}

        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-base font-bold">訪問スポット</h2>
            <Link href="/add" className="flex items-center gap-1 text-sm text-leaf-deep">
              <IconPlus size={15} />
              記録を追加
            </Link>
          </div>
          {visits.length === 0 ? (
            <EmptyState
              title="まだ記録がありません"
              description="訪れた場所を追加すると、ここに並びます。"
              actionHref="/add"
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

        {isShared ? (
          <section>
            <h2 className="mb-2 px-1 text-base font-bold">コメント</h2>
            <TripCommentForm tripId={trip.id} />
            {comments.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {comments.map((comment) => (
                  <li key={comment.id} className="rough-card px-4 py-3">
                    <p className="text-xs text-ink-faint">
                      {commentAuthors.get(comment.user_id) ?? "メンバー"}さん・
                      {formatDate(comment.created_at)}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">{comment.comment}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-center text-sm text-ink-faint">まだコメントはありません。</p>
            )}
          </section>
        ) : null}
      </PageBody>
    </>
  );
}
