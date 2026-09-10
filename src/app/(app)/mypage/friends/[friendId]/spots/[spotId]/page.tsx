import { notFound } from "next/navigation";
import { IconClock, IconLock, IconMapPin, IconUsers, IconYen } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { PhotoGallery } from "@/components/photo-gallery";
import { StarRating, TripBadge, formatDate } from "@/components/ui";
import { VisitPhotoStrip } from "@/components/visit-photo-strip";
import { FriendsUnavailableError, getFriendOverview, getFriendSpotDetail } from "@/lib/data/friends";
import { getMunicipality, getPrefecture } from "@/lib/geo";
import { requireUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CONGESTION_LABELS: Record<number, string> = { 1: "空いていた", 2: "ふつう", 3: "混んでいた" };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ friendId: string; spotId: string }>;
}) {
  const { friendId, spotId } = await params;
  if (!UUID_PATTERN.test(friendId) || !UUID_PATTERN.test(spotId)) return { title: "おでかけ記録" };

  const { supabase } = await requireUser();
  try {
    const overview = await getFriendOverview(supabase, friendId);
    if (!overview?.show_recent_visits) return { title: "おでかけ記録" };
    const detail = await getFriendSpotDetail(supabase, friendId, spotId);
    return { title: detail ? `${detail.spotName} | おでかけ記録` : "おでかけ記録" };
  } catch {
    return { title: "おでかけ記録" };
  }
}

/** フレンドが訪れたスポットの記録を閲覧専用で表示する（追加・編集・削除は不可） */
export default async function FriendSpotDetailPage({
  params,
}: {
  params: Promise<{ friendId: string; spotId: string }>;
}) {
  const [{ supabase }, { friendId, spotId }] = await Promise.all([requireUser(), params]);
  if (!UUID_PATTERN.test(friendId) || !UUID_PATTERN.test(spotId)) notFound();

  try {
    const overview = await getFriendOverview(supabase, friendId);
    if (!overview) notFound();

    if (!overview.show_recent_visits) {
      return (
        <>
          <PageHeader title="訪問先の記録" backHref={`/mypage/friends/${friendId}`} />
          <PageBody>
            <div className="rough-card flex items-center justify-center gap-2 px-5 py-10 text-sm text-ink-faint">
              <IconLock size={18} />
              おでかけ記録は非公開に設定されています
            </div>
          </PageBody>
        </>
      );
    }

    const detail = await getFriendSpotDetail(supabase, friendId, spotId);
    if (!detail) notFound();

    const municipality = getMunicipality(detail.municipalityCode);
    const prefecture = getPrefecture(municipality?.prefectureCode ?? detail.prefectureCode);

    return (
      <>
        <PageHeader
          title={detail.spotName}
          subtitle={`${overview.display_name}さんの記録${
            municipality ? `・${prefecture?.name ?? ""}${municipality.name}` : ""
          }`}
          backHref={`/mypage/friends/${friendId}`}
        />

        <PageBody>
          <PhotoGallery urls={detail.galleryUrls} />

          {/* 基本情報 */}
          <section className="rough-card space-y-3 p-5">
            <div>
              <h2 className="truncate text-lg font-bold">{detail.spotName}</h2>
              <p className="mt-0.5 text-sm text-ink-soft">{detail.categoryName ?? "カテゴリー未設定"}</p>
            </div>

            <StarRating value={detail.summary.averageRating} size={18} />

            {detail.address ? (
              <p className="flex items-start gap-2 text-sm text-ink-soft">
                <IconMapPin size={17} className="mt-0.5 shrink-0" />
                {detail.address}
              </p>
            ) : null}

            <div className="flex items-center justify-around border-t border-line pt-3 text-center">
              <div>
                <p className="text-xl leading-none font-bold tabular-nums">{detail.summary.visitCount}</p>
                <p className="mt-1 text-xs text-ink-soft">訪問回数</p>
              </div>
              <div className="h-7 w-px bg-line" />
              <div>
                <p className="text-sm font-bold">{formatDate(detail.summary.lastVisitedAt)}</p>
                <p className="mt-1 text-xs text-ink-soft">最終訪問日</p>
              </div>
            </div>
          </section>

          {/* 訪問履歴 */}
          <section>
            <h2 className="mb-2 px-1 text-base font-bold">訪問履歴</h2>
            <ul className="space-y-3">
              {detail.visits.map((visit) => (
                <li key={visit.id} className="rough-card space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold tabular-nums">{formatDate(visit.visitedAt)}</p>
                    {visit.tripTitle ? <TripBadge title={visit.tripTitle} /> : null}
                  </div>

                  {visit.rating ? <StarRating value={visit.rating} /> : null}

                  {visit.photos.length > 0 ? (
                    <VisitPhotoStrip
                      photos={visit.photos
                        .filter((photo): photo is typeof photo & { url: string } => Boolean(photo.url))
                        .map((photo) => ({ id: photo.id, url: photo.url, caption: photo.caption }))}
                    />
                  ) : null}

                  {visit.comment ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{visit.comment}</p>
                  ) : null}

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
                    {visit.companions ? (
                      <span className="inline-flex items-center gap-1">
                        <IconUsers size={14} />
                        {visit.companions}
                      </span>
                    ) : null}
                    {visit.amount !== null ? (
                      <span className="inline-flex items-center gap-1">
                        <IconYen size={14} />
                        {visit.amount.toLocaleString("ja-JP")}円
                      </span>
                    ) : null}
                    {visit.stayMinutes !== null ? (
                      <span className="inline-flex items-center gap-1">
                        <IconClock size={14} />
                        {visit.stayMinutes}分
                      </span>
                    ) : null}
                    {visit.congestionLevel ? <span>{CONGESTION_LABELS[visit.congestionLevel]}</span> : null}
                    {visit.revisitWanted ? <span className="text-leaf-deep">また行きたい</span> : null}
                  </div>

                  {visit.note ? (
                    <p className="rounded-xl bg-paper-deep px-3 py-2 text-xs whitespace-pre-wrap text-ink-soft">
                      {visit.note}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        </PageBody>
      </>
    );
  } catch (error) {
    if (!(error instanceof FriendsUnavailableError)) throw error;
    return (
      <>
        <PageHeader title="訪問先の記録" backHref={`/mypage/friends/${friendId}`} />
        <PageBody>
          <div className="rough-card px-6 py-10 text-center font-bold">フレンド機能を準備中です</div>
        </PageBody>
      </>
    );
  }
}
