import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createFriendGroupMessageAction,
  deleteFriendGroupMessageAction,
  markFriendGroupReadAction,
} from "@/app/actions/sns";
import { IconPlus, IconSettings } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { PostedToast } from "@/components/sns/posted-toast";
import { SnsChatForm } from "@/components/sns/sns-chat-form";
import { SnsChatList } from "@/components/sns/sns-chat-list";
import { SnsGroupSwitcher } from "@/components/sns/sns-group-switcher";
import { SnsPhotoGrid } from "@/components/sns/sns-photo-grid";
import { SnsViewTabs } from "@/components/sns/sns-view-tabs";
import { signThumbOrOriginalPaths } from "@/lib/data/photos";
import { getFriendGroupMessages, getMyFriendGroups, getSnsGroupFeed } from "@/lib/data/sns";
import { requireUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SnsGroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const [{ groupId }, sp, { supabase, user }] = await Promise.all([params, searchParams, requireUser()]);

  const groups = await getMyFriendGroups(supabase);
  const group = groups.find((g) => g.id === groupId);
  if (!group) notFound();

  // 画面を開いたタイミングで既読にする
  await markFriendGroupReadAction(groupId);

  const view = sp.view === "chat" ? "chat" : "photos";
  const baseHref = `/sns/groups/${groupId}`;

  return (
    <>
      <PageHeader
        title={group.name}
        backHref="/sns"
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
      <PageBody>
        <SnsGroupSwitcher groups={groups} activeGroupId={groupId} />

        {view === "photos" ? (
          <GroupPhotos groupId={groupId} baseHref={baseHref} />
        ) : (
          <>
            <SnsViewTabs baseHref={baseHref} view={view} />
            <GroupChat groupId={groupId} currentUserId={user.id} />
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

async function GroupPhotos({ groupId, baseHref }: { groupId: string; baseHref: string }) {
  const { supabase } = await requireUser();
  const photos = await getSnsGroupFeed(supabase, groupId);
  const avatarUrls = await signThumbOrOriginalPaths(
    supabase,
    photos.flatMap((p) => (p.profile_image_url ? [p.profile_image_url] : [])),
  );
  // グリッドはサムネイル表示なので、原寸ではなく縮小版の署名URLを使う
  const photoUrls = await signThumbOrOriginalPaths(supabase, photos.map((p) => p.storage_path));

  return <SnsPhotoGrid photos={photos} photoUrls={photoUrls} avatarUrls={avatarUrls} baseHref={baseHref} />;
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
