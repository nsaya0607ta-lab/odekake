import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteMySpotRecordsAction } from "@/app/actions/spot-records";
import { deleteVisitAction, toggleSpotFavoriteAction } from "@/app/actions/visits";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
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
import { VisitPhotoStrip } from "@/components/visit-photo-strip";
import { getSpotDetail } from "@/lib/data/spots";
import { getMapScope, mapScopeHref } from "@/lib/data/map-scope";
import { getMunicipality, getPrefecture, municipalityFromAddress } from "@/lib/geo";
import { requireUser } from "@/lib/supabase/server";
import type { LocationSource } from "@/lib/supabase/types";
import { FavoriteButton } from "./favorite-button";
import { SpotLocationRepair } from "./spot-location-repair";

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
  searchParams: Promise<{ saved?: string; error?: string; trip?: string; recordTrip?: string; recordJourney?: string }>;
}) {
  const [{ spotId }, { saved, error, trip, recordTrip, recordJourney }, { supabase, user }] = await Promise.all([
    params,
    searchParams,
    requireUser(),
  ]);

  const scope = await getMapScope(supabase, user.id, trip);
  const detail = await getSpotDetail(supabase, spotId, scope.tripIds);
  if (!detail) notFound();

  const { spot, categoryName, summary, visits, galleryUrls } = detail;
  // 既存データの行政区分が誤っていても、修復SQLの適用前から正しい住所を表示する。
  const municipality = municipalityFromAddress(spot.address) ?? getMunicipality(spot.municipality_code);
  const prefecture = getPrefecture(municipality?.prefectureCode ?? spot.prefecture_code);
  const validLocationAccuracy =
    spot.location_accuracy_m !== null &&
    Number.isFinite(spot.location_accuracy_m) &&
    spot.location_accuracy_m >= 0
      ? spot.location_accuracy_m
      : null;
  const locationRepairNeeded =
    spot.created_by === user.id &&
    (Boolean(
      municipality &&
      (municipality.prefectureCode !== spot.prefecture_code || municipality.code !== spot.municipality_code),
    ) || (spot.location_accuracy_m !== null && validLocationAccuracy === null));
  // お気に入りは自分の訪問履歴に付くので、自分の記録がないと切り替えられない
  const myVisits = visits.filter((visit) => visit.record.user_id === user.id);
  const myFavorite = myVisits.some((visit) => visit.record.favorite);

  const backHref =
    prefecture && municipality
      ? mapScopeHref(`/map/${prefecture.region.slug}/${prefecture.code}/${municipality.code}`, scope)
      : "/records?tab=spots";

  return (
    <>
      <SpotLocationRepair spotId={spot.id} needed={locationRepairNeeded} />
      <PageHeader
        title={spot.name}
        subtitle={`${scope.kind === "shared" ? "共有旅" : "個人の旅"}・${scope.name}${
          municipality ? `・${prefecture?.name ?? ""}${municipality.name}` : ""
        }`}
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

        {error === "delete" ? (
          <p className="rounded-2xl border border-blossom bg-blossom-soft px-4 py-3 text-sm text-[#8f4c59]">
            記録を削除できませんでした。もう一度お試しください。
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
              <input type="hidden" name="scopeTrip" value={scope.value} />
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
                  {validLocationAccuracy !== null
                    ? `・およそ ±${
                        validLocationAccuracy < 1000
                          ? `${Math.round(validLocationAccuracy)}m`
                          : `${(validLocationAccuracy / 1000).toFixed(1)}km`
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
              href={mapScopeHref(
                `/map/${prefecture.region.slug}/${prefecture.code}/${municipality.code}`,
                scope,
              )}
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
                    <VisitPhotoStrip
                      photos={photos
                        .filter((photo): photo is typeof photo & { url: string } => Boolean(photo.url))
                        .map((photo) => ({ id: photo.id, url: photo.url, caption: photo.caption }))}
                    />
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
                    <div className="flex items-center gap-4 border-t border-line pt-2">
                      <Link
                        href={`/visits/${record.id}/edit`}
                        className="text-sm text-leaf-deep underline underline-offset-4"
                      >
                        編集する
                      </Link>
                      <form action={deleteVisitAction}>
                        <input type="hidden" name="visitId" value={record.id} />
                        <input type="hidden" name="spotId" value={spot.id} />
                        <ConfirmSubmitButton
                          message={`${formatDate(record.visited_at)}の訪問記録を削除します。写真も削除されます。よろしいですか？`}
                          pendingLabel="削除中…"
                          className="text-sm font-semibold text-[#a85858] underline underline-offset-4 disabled:opacity-50"
                        >
                          削除する
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <Link
          href={recordTrip
            ? `/visits/new?${new URLSearchParams({ spot: spot.id, trip: recordTrip, ...(recordJourney ? { journey: recordJourney } : {}) })}`
            : mapScopeHref("/visits/new", scope, { spot: spot.id })}
          className="btn btn-primary w-full"
        >
          訪問履歴を追加する
        </Link>

        {myVisits.length > 0 ? (
          <section className="rough-card space-y-3 border-blossom p-5">
            <div>
              <h2 className="font-bold">この場所を自分の記録から消す</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
                この場所にある自分の訪問履歴を{myVisits.length}件すべて削除します。地図やスポット一覧からも自分の訪問として表示されなくなります。
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">
                場所そのものは他のユーザーも使うため削除しません。
              </p>
            </div>
            <form action={deleteMySpotRecordsAction}>
              <input type="hidden" name="spotId" value={spot.id} />
              <ConfirmSubmitButton
                message={`「${spot.name}」にある自分の訪問記録${myVisits.length}件をすべて削除します。写真も削除され、元に戻せません。よろしいですか？`}
                pendingLabel="削除中…"
              >
                この場所の自分の記録をすべて削除
              </ConfirmSubmitButton>
            </form>
          </section>
        ) : null}
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
