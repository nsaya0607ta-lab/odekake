import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteFriendGroupMessageAction, markFriendGroupReadAction } from "@/app/actions/sns";
import { IconCamera, IconClose, IconSettings, IconUser } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { SnsPhotoGrid } from "@/components/sns/sns-photo-grid";
import { SnsTabs } from "@/components/sns/sns-tabs";
import { signPhotoPaths } from "@/lib/data/photos";
import { getFriendGroupMessages, getMyFriendGroups, getSnsGroupFeed } from "@/lib/data/sns";
import { requireUser } from "@/lib/supabase/server";
import { GroupChatForm } from "./group-chat-form";

export const dynamic = "force-dynamic";

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date(iso));
}

export default async function SnsGroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ view?: string; posted?: string }>;
}) {
  const [{ groupId }, sp, { supabase, user }] = await Promise.all([params, searchParams, requireUser()]);

  const groups = await getMyFriendGroups(supabase);
  const group = groups.find((g) => g.id === groupId);
  if (!group) notFound();

  // 画面を開いたタイミングで既読にする
  await markFriendGroupReadAction(groupId);

  const view = sp.view === "chat" ? "chat" : "photos";

  return (
    <>
      <PageHeader
        title={group.name}
        backHref="/sns"
        action={
          <Link
            href={`/sns/groups/${groupId}/settings`}
            aria-label="グループの設定"
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft active:bg-paper-deep"
          >
            <IconSettings size={20} />
          </Link>
        }
      />
      <PageBody>
        <SnsTabs groups={groups} activeGroupId={groupId} />

        {sp.posted === "1" ? (
          <p role="status" className="rounded-2xl border border-leaf bg-leaf-soft px-4 py-3 text-sm text-leaf-deep">
            写真を投稿しました
          </p>
        ) : null}

        <div className="flex gap-1.5 px-1">
          <ViewTab href={`/sns/groups/${groupId}?view=photos`} label="写真" active={view === "photos"} />
          <ViewTab href={`/sns/groups/${groupId}?view=chat`} label="チャット" active={view === "chat"} />
        </div>

        {view === "photos" ? (
          <GroupPhotos groupId={groupId} />
        ) : (
          <GroupChat groupId={groupId} currentUserId={user.id} />
        )}
      </PageBody>
    </>
  );
}

function ViewTab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`tap-target flex-1 rounded-full py-2 text-center text-sm font-semibold transition-colors ${
        active ? "bg-leaf-soft text-leaf-deep" : "bg-paper-deep text-ink-faint"
      }`}
    >
      {label}
    </Link>
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
    <div className="space-y-6">
      <Link href={`/sns/groups/${groupId}/new`} className="btn btn-primary w-full">
        <IconCamera size={18} />
        写真を投稿する
      </Link>
      {photos.length === 0 ? (
        <p className="px-1 text-center text-xs text-ink-faint">まだ写真がありません。</p>
      ) : (
        <SnsPhotoGrid
          photos={photos}
          photoUrls={photoUrls}
          avatarUrls={avatarUrls}
          hrefFor={(photoId) => `/sns/${photoId}`}
        />
      )}
    </div>
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
    <div className="space-y-4">
      <GroupChatForm groupId={groupId} />
      {messages.length === 0 ? (
        <p className="px-1 text-center text-xs text-ink-faint">まだメッセージがありません。</p>
      ) : (
        <ul className="space-y-3">
          {messages.map((message) => {
            const avatarUrl = message.profile_image_url ? avatarUrls.get(message.profile_image_url) : null;
            return (
              <li key={message.id} className="flex items-start gap-2 px-1">
                <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-paper-deep">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-ink-faint">
                      <IconUser size={18} />
                    </span>
                  )}
                </span>
                <div className="min-w-0 flex-1 rounded-2xl bg-paper-deep px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-bold">{message.display_name}</span>
                    <span className="shrink-0 text-[10px] text-ink-faint">{formatDateTime(message.created_at)}</span>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed">{message.body}</p>
                </div>
                {message.user_id === currentUserId ? (
                  <form action={deleteFriendGroupMessageAction} className="shrink-0">
                    <input type="hidden" name="messageId" value={message.id} />
                    <input type="hidden" name="groupId" value={groupId} />
                    <button
                      type="submit"
                      aria-label="このメッセージを削除"
                      className="flex h-7 w-7 items-center justify-center rounded-full text-ink-faint active:bg-paper-deep"
                    >
                      <IconClose size={14} />
                    </button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
