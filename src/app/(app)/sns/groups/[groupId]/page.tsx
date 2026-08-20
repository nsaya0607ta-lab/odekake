import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { Suspense } from "react";
import {
  createFriendGroupMessageAction,
  deleteFriendGroupMessageAction,
  markFriendGroupReadAction,
} from "@/app/actions/sns";
import { IconPlus, IconSettings } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { PostedToast } from "@/components/sns/posted-toast";
import { SnsBackgroundBand } from "@/components/sns/sns-background-band";
import { SnsChatForm } from "@/components/sns/sns-chat-form";
import { SnsChatList } from "@/components/sns/sns-chat-list";
import { SnsGroupSwitcher } from "@/components/sns/sns-group-switcher";
import { SnsPhotoGrid } from "@/components/sns/sns-photo-grid";
import { SnsViewTabs } from "@/components/sns/sns-view-tabs";
import { signThumbOrOriginalPaths } from "@/lib/data/photos";
import { getFriendGroupMessages, getMyFriendGroups, getOwnSnsProfile, getSnsGroupFeed, signGroupIconUrls } from "@/lib/data/sns";
import { requireUser } from "@/lib/supabase/server";
import type { FriendGroupRow } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function SnsGroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const [{ groupId }, sp, { supabase, user }] = await Promise.all([params, searchParams, requireUser()]);

  const groups = await getMyFriendGroups(supabase, user.id);
  const group = groups.find((g) => g.id === groupId);
  if (!group) notFound();

  // 画面を開いたタイミングで既読にする。表示をブロックしないようレスポンス送信後に実行する
  after(async () => {
    try {
      await markFriendGroupReadAction(groupId);
    } catch (error) {
      console.error("Failed to mark friend group as read", error);
    }
  });

  const view = sp.view === "chat" ? "chat" : "photos";
  const baseHref = `/sns/groups/${groupId}`;

  return (
    <>
      <PageHeader
        title={group.name}
        showBack={false}
        action={
          <Link
            href={`${baseHref}/settings`}
            aria-label="グループの設定"
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft active:bg-paper-deep"
          >
            <IconSettings size={20} />
          </Link>
        }
      />
      <PostedToast />
      <SnsBackgroundBand />
      <PageBody>
        <Suspense fallback={<SnsSwitcherSkeleton />}>
          <GroupSwitcherSection groups={groups} groupId={groupId} userId={user.id} />
        </Suspense>

        {view === "photos" ? (
          <Suspense fallback={<SnsGridSkeleton />}>
            <GroupPhotos groupId={groupId} baseHref={baseHref} />
          </Suspense>
        ) : (
          <>
            <SnsViewTabs baseHref={baseHref} view={view} />
            <Suspense fallback={<SnsChatSkeleton />}>
              <GroupChat groupId={groupId} currentUserId={user.id} />
            </Suspense>
          </>
        )}
      </PageBody>
      {/* PageBody の fade-in アニメーションが transform を animate するせいで、
          position:fixed の子が画面基準ではなくPageBody基準になってしまう。
          さらに sticky はコンテンツが短いと画面下に届かないので、
          FABとチャット入力欄はどちらもPageBodyの外に fixed で置く */}
      {view === "photos" ? (
        <Link
          href={`${baseHref}/new`}
          aria-label="写真を投稿"
          className="fixed right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-leaf text-white shadow-lg active:opacity-80"
          style={{ bottom: "calc(var(--nav-height) + var(--safe-bottom) + 1rem)" }}
        >
          <IconPlus size={24} />
        </Link>
      ) : (
        <SnsChatForm
          action={createFriendGroupMessageAction}
          hiddenFields={{ groupId }}
          postHref={`${baseHref}/new`}
        />
      )}
    </>
  );
}

async function GroupSwitcherSection({
  groups,
  groupId,
  userId,
}: {
  groups: FriendGroupRow[];
  groupId: string;
  userId: string;
}) {
  const { supabase } = await requireUser();
  const [groupIconUrls, ownProfile] = await Promise.all([
    signGroupIconUrls(supabase, groups),
    getOwnSnsProfile(supabase, userId),
  ]);

  return (
    <SnsGroupSwitcher
      groups={groups}
      activeGroupId={groupId}
      iconUrls={Object.fromEntries(groupIconUrls)}
      personalIconUrl={ownProfile.iconUrl}
      personalLabel={ownProfile.displayName}
    />
  );
}

function SnsSwitcherSkeleton() {
  return (
    <div className="-mx-4 -mt-5 flex items-center gap-3 bg-white px-4 py-1.5" aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="h-14 w-14 shrink-0 animate-pulse rounded-full bg-paper-deep motion-reduce:animate-none" />
      ))}
    </div>
  );
}

async function GroupPhotos({ groupId, baseHref }: { groupId: string; baseHref: string }) {
  const { supabase } = await requireUser();
  const photos = await getSnsGroupFeed(supabase, groupId);
  // グリッドはサムネイル表示なので、原寸ではなく縮小版の署名URLを使う。互いに独立しているので並列で取得する
  const [avatarUrls, photoUrls] = await Promise.all([
    signThumbOrOriginalPaths(
      supabase,
      photos.flatMap((p) => (p.profile_image_url ? [p.profile_image_url] : [])),
    ),
    signThumbOrOriginalPaths(supabase, photos.map((p) => p.storage_path)),
  ]);

  return <SnsPhotoGrid photos={photos} photoUrls={photoUrls} avatarUrls={avatarUrls} baseHref={baseHref} />;
}

function SnsGridSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-1" aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} className="aspect-square animate-pulse bg-paper-deep motion-reduce:animate-none" />
      ))}
    </div>
  );
}

function SnsChatSkeleton() {
  return (
    <div className="space-y-3 px-4 py-4" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={`h-12 w-2/3 animate-pulse rounded-2xl bg-paper-deep motion-reduce:animate-none ${i % 2 === 1 ? "ml-auto" : ""}`}
        />
      ))}
    </div>
  );
}

async function GroupChat({ groupId, currentUserId }: { groupId: string; currentUserId: string }) {
  const { supabase } = await requireUser();
  const messages = await getFriendGroupMessages(supabase, groupId);
  const avatarUrls = await signThumbOrOriginalPaths(
    supabase,
    messages.flatMap((m) => (m.profile_image_url ? [m.profile_image_url] : [])),
  );

  return (
    // 下は固定表示のチャット入力欄と重ならないよう余白を空けておく
    <div style={{ paddingBottom: "calc(var(--nav-height) + var(--safe-bottom) + 4.5rem)" }}>
      <SnsChatList
        messages={messages}
        avatarUrls={avatarUrls}
        currentUserId={currentUserId}
        deleteAction={deleteFriendGroupMessageAction}
        groupId={groupId}
      />
    </div>
  );
}
