import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { IconChevronRight, IconLock, IconMapPin, IconUser } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { removeFriendAction } from "@/app/(app)/mypage/friends/actions";
import { COLLECTION_ITEMS } from "@/lib/collection/items";
import {
  FriendsUnavailableError,
  getFriendCollection,
  getFriendOverview,
  getFriendPrefectures,
  getFriendRecentVisits,
} from "@/lib/data/friends";
import { signPhotoPath, signPhotoPaths } from "@/lib/data/photos";
import { getExpProgress } from "@/lib/exp";
import { getMunicipality } from "@/lib/geo/municipalities";
import { PREFECTURE_NAMES } from "@/lib/geo/prefecture-names";
import { requireUser } from "@/lib/supabase/server";
import type {
  FriendCollectionRow,
  FriendPrefectureRow,
  FriendRecentVisitRow,
} from "@/lib/supabase/types";

export const metadata = { title: "フレンド詳細 | おでかけ記録" };
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PREFECTURE_BY_CODE = new Map(PREFECTURE_NAMES.map((item) => [item.code, item.name]));

export default async function FriendDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ friendId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ supabase }, { friendId }, query] = await Promise.all([
    requireUser(),
    params,
    searchParams,
  ]);
  if (!UUID_PATTERN.test(friendId)) notFound();

  try {
    const overview = await getFriendOverview(supabase, friendId);
    if (!overview) notFound();

    const [prefectures, collection, recentVisits] = await Promise.all([
      overview.show_prefectures ? getFriendPrefectures(supabase, friendId) : Promise.resolve([]),
      overview.show_collection ? getFriendCollection(supabase, friendId) : Promise.resolve([]),
      overview.show_recent_visits ? getFriendRecentVisits(supabase, friendId, 5) : Promise.resolve([]),
    ]);
    const [avatarUrl, visitPhotoUrls] = await Promise.all([
      signPhotoPath(supabase, overview.profile_image_url),
      signPhotoPaths(
        supabase,
        recentVisits.flatMap((visit) => (visit.photo_path ? [visit.photo_path] : [])),
      ),
    ]);
    const level = getExpProgress(overview.total_exp).level;

    return (
      <>
        <PageHeader title="フレンド" backHref="/mypage/friends" />
        <PageBody>
          {query.error === "remove" ? (
            <p role="alert" className="rounded-2xl border border-blossom bg-blossom-soft px-4 py-3 text-sm text-[#8f4c59]">
              フレンドから削除できませんでした。もう一度お試しください
            </p>
          ) : null}

          <section className="rough-card px-5 py-6 text-center">
            <span className="mx-auto block h-20 w-20 overflow-hidden rounded-full bg-paper-deep">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-ink-faint">
                  <IconUser size={34} />
                </span>
              )}
            </span>
            <h1 className="mt-3 text-xl font-black">{overview.display_name}</h1>
            <p className="mt-1 font-bold text-leaf-deep">Lv.{level}</p>
            {overview.introduction ? (
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{overview.introduction}</p>
            ) : null}
          </section>

          <section className="rough-card flex items-center justify-around px-3 py-5 text-center">
            <Stat value={overview.visited_prefecture_count} label="都道府県" />
            <span className="h-10 w-px bg-line" />
            <Stat value={overview.visited_municipality_count} label="市区町村" />
            <span className="h-10 w-px bg-line" />
            <Stat value={overview.visit_count} label="訪問" />
          </section>

          <PrefectureSection visible={overview.show_prefectures} prefectures={prefectures} />
          <CollectionSection visible={overview.show_collection} collection={collection} friendId={friendId} />
          <RecentVisitsSection
            visible={overview.show_recent_visits}
            visits={recentVisits}
            photoUrls={visitPhotoUrls}
          />

          <form action={removeFriendAction}>
            <input type="hidden" name="friendUserId" value={friendId} />
            <ConfirmSubmitButton
              message={`${overview.display_name}さんをフレンドから削除しますか？`}
              pendingLabel="削除中…"
            >
              フレンドから削除
            </ConfirmSubmitButton>
          </form>
        </PageBody>
      </>
    );
  } catch (error) {
    if (!(error instanceof FriendsUnavailableError)) throw error;
    return (
      <>
        <PageHeader title="フレンド" backHref="/mypage/friends" />
        <PageBody>
          <div className="rough-card px-6 py-10 text-center">
            <IconLock size={30} className="mx-auto text-ink-faint" />
            <p className="mt-3 font-bold">フレンド機能を準備中です</p>
          </div>
        </PageBody>
      </>
    );
  }
}
function Stat({ value, label }: { value: number; label: string }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block text-2xl font-black tabular-nums">{value}</span>
      <span className="mt-1 block text-xs text-ink-soft">{label}</span>
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="px-1 text-base font-bold">{children}</h2>;
}

function PrivateCard() {
  return (
    <div className="rough-card flex items-center justify-center gap-2 px-5 py-6 text-sm text-ink-faint">
      <IconLock size={17} />
      非公開に設定されています
    </div>
  );
}

function PrefectureSection({
  visible,
  prefectures,
}: {
  visible: boolean;
  prefectures: FriendPrefectureRow[];
}) {
  return (
    <section className="space-y-3">
      <SectionTitle>行った都道府県</SectionTitle>
      {!visible ? (
        <PrivateCard />
      ) : prefectures.length === 0 ? (
        <div className="rough-card px-5 py-6 text-center text-sm text-ink-faint">まだ記録がありません</div>
      ) : (
        <ul className="rough-card grid grid-cols-2 gap-px overflow-hidden bg-line">
          {prefectures.map((prefecture) => (
            <li key={prefecture.prefecture_code} className="bg-card px-4 py-3">
              <span className="font-semibold">
                {PREFECTURE_BY_CODE.get(prefecture.prefecture_code) ?? prefecture.prefecture_code}
              </span>
              <span className="ml-2 text-xs text-ink-faint tabular-nums">{prefecture.visit_count}回</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CollectionSection({
  visible,
  collection,
  friendId,
}: {
  visible: boolean;
  collection: FriendCollectionRow[];
  friendId: string;
}) {
  const owned = new Set(collection.map((item) => item.item_id));
  const rarities = ["N", "R", "SR", "SSR"] as const;

  return (
    <section className="space-y-3">
      <SectionTitle>図鑑</SectionTitle>
      {!visible ? (
        <PrivateCard />
      ) : (
        <div className="rough-card space-y-4 p-5">
          <p className="text-center tabular-nums">
            <span className="text-2xl font-black">{owned.size}</span>
            <span className="text-sm text-ink-faint"> / {COLLECTION_ITEMS.length}</span>
          </p>
          <div className="grid grid-cols-4 gap-2 text-center">
            {rarities.map((rarity) => {
              const items = COLLECTION_ITEMS.filter((item) => item.rarity === rarity);
              const count = items.filter((item) => owned.has(item.id)).length;
              return (
                <span key={rarity} className="rounded-2xl bg-paper-deep px-1 py-2">
                  <span className="block text-xs font-black text-leaf-deep">{rarity}</span>
                  <span className="mt-0.5 block text-xs tabular-nums text-ink-soft">{count} / {items.length}</span>
                </span>
              );
            })}
          </div>
          <Link
            href={`/mypage/friends/${friendId}/collection`}
            className="btn btn-primary w-full"
          >
            図鑑を見る
            <IconChevronRight size={17} />
          </Link>
        </div>
      )}
    </section>
  );
}

function RecentVisitsSection({
  visible,
  visits,
  photoUrls,
}: {
  visible: boolean;
  visits: FriendRecentVisitRow[];
  photoUrls: Map<string, string>;
}) {
  return (
    <section className="space-y-3">
      <SectionTitle>最近のおでかけ</SectionTitle>
      {!visible ? (
        <PrivateCard />
      ) : visits.length === 0 ? (
        <div className="rough-card px-5 py-6 text-center text-sm text-ink-faint">まだ記録がありません</div>
      ) : (
        <ul className="rough-card divide-y divide-line overflow-hidden">
          {visits.map((visit, index) => {
            const prefecture = PREFECTURE_BY_CODE.get(visit.prefecture_code) ?? visit.prefecture_code;
            const municipality = getMunicipality(visit.municipality_code)?.name ?? visit.municipality_code;
            const photoUrl = visit.photo_path ? photoUrls.get(visit.photo_path) ?? null : null;
            return (
              <li key={`${visit.spot_id}-${visit.visited_at}-${index}`} className="flex gap-3 px-4 py-4">
                <span className="w-11 shrink-0 text-sm font-bold text-leaf-deep tabular-nums">
                  {formatVisitDate(visit.visited_at)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{visit.spot_name}</span>
                  <span className="mt-1 flex items-center gap-1 truncate text-xs text-ink-faint">
                    <IconMapPin size={13} className="shrink-0" />
                    {prefecture} {municipality}
                  </span>
                </span>
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoUrl}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-2xl border border-line object-cover"
                    loading="lazy"
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function formatVisitDate(value: string): string {
  const [, month = "", day = ""] = value.split("-");
  return `${Number(month)}/${Number(day)}`;
}
