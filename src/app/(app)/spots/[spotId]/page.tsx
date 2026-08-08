import Link from "next/link";
import { notFound } from "next/navigation";
import { toggleSpotFavoriteAction } from "@/app/actions/visits";
import {
  IconCalendar,
  IconSliders,
  IconClock,
  IconGlobe,
  IconHeart,
  IconLayers,
  IconMapPin,
  IconUsers,
  IconYen,
} from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { PhotoGallery } from "@/components/photo-gallery";
import { StarRating, TripBadge, formatDate } from "@/components/ui";
import { getSpotDetail } from "@/lib/data/spots";
import { getMunicipality, getPrefecture } from "@/lib/geo";
import { getRecordSpace } from "@/lib/data/space";
import { requireUser } from "@/lib/supabase/server";
import type { LocationSource } from "@/lib/supabase/types";
import { FavoriteButton } from "./favorite-button";

export const dynamic = "force-dynamic";

const CONGESTION_LABELS: Record<number, string> = { 1: "空いていた", 2: "ふつう", 3: "混んでいた" };

const LOCATION_SOURCE_LABELS: Record<LocationSource, string> = {
  municipality: "市区町村の代表地点",
  address: "住所から推定",
  map: "地図で選んだ地点",
  device: "現在地",
  place_search: "店舗検索の結果",
};

export async function generateMetadata({ params }: { params: Promise<{ spotId: string }> }) {
  const { spotId } = await params;
  const { supabase } = await requireUser();
  const { data } = await supabase.from("spots").select("name").eq("id", spotId).maybeSingle();
  return { title: data ? `${data.name} | おでかけ記録` : "おでかけ記録" };
}

export default async function SpotDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ spotId: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const [{ spotId }, { saved, error }, { supabase, user }] = await Promise.all([
    params,
    searchParams,
    requireUser(),
  ]);

  const space = await getRecordSpace(supabase, user.id);
  const detail = await getSpotDetail(supabase, spotId, space.tripIds);
  if (!detail) notFound();

  const { spot, categoryName, summary, visits, galleryUrls } = detail;
  const municipality = getMunicipality(spot.municipality_code);
  const prefecture = getPrefecture(spot.prefecture_code);
  // お気に入りは自分の訪問履歴に付くので、自分の記録がないと切り替えられない
  const myVisits = visits.filter((visit) => visit.record.user_id === user.id);
  const myFavorite = myVisits.some((visit) => visit.record.favorite);

  const backHref =
    prefecture && municipality
      ? `/map/${prefecture.region.slug}/${prefecture.code}/${municipality.code}`
      : "/records?tab=spots";

  return (
    <>
      <PageHeader
        title={spot.name}
        subtitle={municipality ? `${prefecture?.name ?? ""}${municipality.name}` : undefined}
        backHref={backHref}
        action={
          spot.created_by === user.id ? (
            <Link
              href={`/spots/${spot.id}/edit`}
              aria-label="スポットを編集"
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink-soft active:bg-paper-deep"
            >
              <IconSliders />
            </Link>
          ) : undefined
        }
      />

      <PageBody>
        {saved === "1" ? (
          <p className="rounded-2xl border border-leaf bg-leaf-soft px-4 py-3 text-sm text-leaf-deep">
            保存しました。
          </p>
        ) : null}

        {error === "favorite" ? (
          <p className="rounded-2xl border border-blossom bg-blossom-soft px-4 py-3 text-sm text-[#8f4c59]">
            お気に入りは訪問の記録に付きます。先に訪問履歴を追加してください。
          </p>
        ) : null}

        <PhotoGallery urls={galleryUrls} />

        {/* 基本情報 */}
        <section className="rough-card space-y-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold">{spot.name}</h2>
              <p className="mt-0.5 text-sm text-ink-soft">{categoryName ?? "カテゴリー未設定"}</p>
            </div>
            <form action={toggleSpotFavoriteAction} className="shrink-0">
              <input type="hidden" name="spotId" value={spot.id} />
              <input type="hidden" name="favorite" value={myFavorite ? "" : "on"} />
              <FavoriteButton favorite={myFavorite} disabled={myVisits.length === 0} />
            </form>
          </div>

          {myVisits.length === 0 ? (
            <p className="text-xs text-ink-faint">
              お気に入りは訪問の記録に付きます。下の「訪問履歴を追加する」から記録すると押せるようになります。
            </p>
          ) : summary.favorite && !myFavorite ? (
            <p className="text-xs text-ink-faint">
              <IconHeart size={12} filled className="mr-1 inline align-[-1px] text-blossom" />
              他のメンバーがお気に入りに入れています。
            </p>
          ) : null}

          <StarRating value={summary.averageRating} size={18} />

          <dl className="space-y-2 text-sm">
            {spot.address ? (
              <InfoRow icon={<IconMapPin size={17} />} label="住所">
                {spot.address}
              </InfoRow>
            ) : null}
            {spot.opening_hours ? (
              <InfoRow icon={<IconClock size={17} />} label="営業時間">
                {spot.opening_hours}
              </InfoRow>
            ) : null}
            {spot.closed_days ? (
              <InfoRow icon={<IconCalendar size={17} />} label="定休日">
                {spot.closed_days}
              </InfoRow>
            ) : null}
            {spot.website_url ? (
              <InfoRow icon={<IconGlobe size={17} />} label="公式サイト">
                <a
                  href={spot.website_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="break-all text-leaf-deep underline underline-offset-4"
                >
                  {spot.website_url}
                </a>
              </InfoRow>
            ) : null}
            {spot.memo ? (
              <InfoRow icon={<IconLayers size={17} />} label="メモ">
                <span className="whitespace-pre-wrap">{spot.memo}</span>
              </InfoRow>
            ) : null}
            {spot.latitude !== null && spot.longitude !== null ? (
              <InfoRow icon={<IconMapPin size={17} />} label="場所">
                <span className="tabular-nums">
                  {spot.latitude.toFixed(5)}, {spot.longitude.toFixed(5)}
                </span>
                <span className="mt-0.5 block text-xs text-ink-faint">
                  {LOCATION_SOURCE_LABELS[spot.location_source]}
                  {spot.location_accuracy_m !== null
                    ? `・およそ ±${
                        spot.location_accuracy_m < 1000
                          ? `${Math.round(spot.location_accuracy_m)}m`
                          : `${(spot.location_accuracy_m / 1000).toFixed(1)}km`
                      }`
                    : ""}
                </span>
              </InfoRow>
            ) : null}
          </dl>

          <div className="flex items-center justify-around border-t border-line pt-3 text-center">
            <div>
              <p className="text-xl leading-none font-bold tabular-nums">{summary.visitCount}</p>
              <p className="mt-1 text-xs text-ink-soft">訪問回数</p>
            </div>
            <div className="h-7 w-px bg-line" />
            <div>
              <p className="text-sm font-bold">{formatDate(summary.lastVisitedAt)}</p>
              <p className="mt-1 text-xs text-ink-soft">最終訪問日</p>
            </div>
          </div>

          {municipality && prefecture ? (
            <Link
              href={`/map/${prefecture.region.slug}/${prefecture.code}/${municipality.code}`}
              className="block text-center text-sm text-leaf-deep underline underline-offset-4"
            >
              {municipality.name}のスポット一覧を見る
            </Link>
          ) : null}
        </section>

        {/* 訪問履歴 */}
        <section>
          <h2 className="mb-2 px-1 text-base font-bold">訪問履歴</h2>
          {visits.length === 0 ? (
            <p className="rough-card px-4 py-6 text-center text-sm text-ink-soft">
              まだ訪問履歴がありません。
            </p>
          ) : (
            <ul className="space-y-3">
              {visits.map(({ record, photos, tripTitle }) => (
                <li key={record.id} className="rough-card space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold tabular-nums">{formatDate(record.visited_at)}</p>
                    {tripTitle ? <TripBadge title={tripTitle} /> : null}
                  </div>

                  {record.rating ? <StarRating value={record.rating} /> : null}

                  {photos.length > 0 ? (
                    <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                      {photos.map((photo) =>
                        photo.url ? (
                          <li key={photo.id} className="shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={photo.url}
                              alt={photo.caption ?? ""}
                              className="h-24 w-24 rounded-2xl object-cover"
                            />
                          </li>
                        ) : null,
                      )}
                    </ul>
                  ) : null}

                  {record.comment ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{record.comment}</p>
                  ) : null}

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
                    {record.companions ? (
                      <span className="inline-flex items-center gap-1">
                        <IconUsers size={14} />
                        {record.companions}
                      </span>
                    ) : null}
                    {record.amount !== null ? (
                      <span className="inline-flex items-center gap-1">
                        <IconYen size={14} />
                        {record.amount.toLocaleString("ja-JP")}円
                      </span>
                    ) : null}
                    {record.stay_minutes !== null ? (
                      <span className="inline-flex items-center gap-1">
                        <IconClock size={14} />
                        {record.stay_minutes}分
                      </span>
                    ) : null}
                    {record.congestion_level ? (
                      <span>{CONGESTION_LABELS[record.congestion_level]}</span>
                    ) : null}
                    {record.revisit_wanted ? <span className="text-leaf-deep">また行きたい</span> : null}
                  </div>

                  {record.note ? (
                    <p className="rounded-xl bg-paper-deep px-3 py-2 text-xs whitespace-pre-wrap text-ink-soft">
                      {record.note}
                    </p>
                  ) : null}

                  {record.user_id === user.id ? (
                    <Link
                      href={`/visits/${record.id}/edit`}
                      className="inline-block text-sm text-leaf-deep underline underline-offset-4"
                    >
                      この記録を編集する
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <Link href={`/visits/new?spot=${spot.id}`} className="btn btn-primary w-full">
          訪問履歴を追加する
        </Link>
      </PageBody>
    </>
  );
}

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2">
      <dt className="mt-0.5 shrink-0 text-ink-faint" aria-label={label}>
        {icon}
      </dt>
      <dd className="min-w-0 flex-1 text-ink-soft">{children}</dd>
    </div>
  );
}
