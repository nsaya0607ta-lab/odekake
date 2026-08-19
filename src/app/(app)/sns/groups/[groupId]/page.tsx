import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createFriendGroupMessageAction,
  deleteFriendGroupMessageAction,
  markFriendGroupReadAction,
} from "@/app/actions/sns";
import { IconSettings } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { PostedToast } from "@/components/sns/posted-toast";
import { SnsChatForm } from "@/components/sns/sns-chat-form";
import { SnsChatList } from "@/components/sns/sns-chat-list";
import { SnsGroupSwitcher } from "@/components/sns/sns-group-switcher";
import { SnsPhotoGrid } from "@/components/sns/sns-photo-grid";
import { SnsViewTabs } from "@/components/sns/sns-view-tabs";
import { signPhotoPaths } from "@/lib/data/photos";
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
        <SnsViewTabs baseHref={baseHref} view={view} />

        {view === "photos" ? (
          <GroupPhotos groupId={groupId} />
        ) : (
          <GroupChat groupId={groupId} currentUserId={user.id} />
        )}
      </PageBody>
    </>
  );
}

async function GroupPhotos({ groupId }: { groupId: string }) {
  const { supabase } = await requireUser();
  const photos = await getSnsGroupFeed(supabase, groupId);
  const avatarUrls = await signPhotoPaths(
    supabase,
    photos.flatMap((p) => (p.profile_image_url ? [p.profile_image_url] : [])),
  );
  const photoUrls = await signPhotoPaths(supabase, photos.map((p) => p.storage_path));

  return (
    <SnsPhotoGrid photos={photos} photoUrls={photoUrls} avatarUrls={avatarUrls} postHref={`/sns/groups/${groupId}/new`} />
  );
}

async function GroupChat({ groupId, currentUserId }: { groupId: string; currentUserId: string }) {
  const { supabase } = await requireUser();
  const messages = await getFriendGroupMessages(supabase, groupId);
  const avatarUrls = await signPhotoPaths(
    supabase,
    messages.flatMap((m) => (m.profile_image_url ? [m.profile_image_url] : [])),
  );

  return (
    <div>
      <SnsChatList
        messages={messages}
        avatarUrls={avatarUrls}
        currentUserId={currentUserId}
        deleteAction={deleteFriendGroupMessageAction}
        groupId={groupId}
      />
      <SnsChatForm
        action={createFriendGroupMessageAction}
        hiddenFields={{ groupId }}
        postHref={`/sns/groups/${groupId}/new`}
      />
    </div>
  );
}
