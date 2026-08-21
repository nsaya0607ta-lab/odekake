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
import { SnsPrimaryNav } from "@/components/sns/sns-primary-nav";
import { SnsViewTabs } from "@/components/sns/sns-view-tabs";
import { signThumbOrOriginalPaths } from "@/lib/data/photos";
import { getFriendGroupMessages, getMyFriendGroups, getSnsGroupFeed, signGroupIconUrls } from "@/lib/data/sns";
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
        subtitle={`${group.member_count}人で共有中`}
        backHref="/sns/groups"
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
      <PageBody className="space-y-3">
        <SnsPrimaryNav active="group" userHref={`/sns/users/${user.id}`} groupHref="/sns/groups" />
        <Suspense fallback={<SnsSwitcherSkeleton />}>
          <GroupSwitcherSection groups={groups} groupId={groupId} />
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
          className="sns-floating-compose fixed right-4 z-30 flex h-14 items-center justify-center gap-1.5 rounded-full px-4 text-white shadow-lg active:opacity-80"
          style={{ bottom: "calc(var(--nav-height) + var(--safe-bottom) + 1rem)" }}
        >
          <IconPlus size={21} />
          <span className="text-sm font-bold">写真</span>
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
}: {
  groups: FriendGroupRow[];
  groupId: string;
}) {
  const { supabase } = await requireUser();
  const groupIconUrls = await signGroupIconUrls(supabase, groups);

  return (
    <SnsGroupSwitcher
      groups={groups}
      activeGroupId={groupId}
      iconUrls={Object.fromEntries(groupIconUrls)}
    />
  );
}

function SnsSwitcherSkeleton() {
  return (
    <div className="sns-rail-panel sns-group-switcher-panel" aria-hidden="true">
      <div className="mb-2 h-5 w-24 animate-pulse rounded-full bg-paper-deep motion-reduce:animate-none" />
      <div className="flex gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-14 w-14 shrink-0 animate-pulse rounded-full bg-paper-deep motion-reduce:animate-none" />
        ))}
      </div>
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
