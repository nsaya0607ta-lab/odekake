import { notFound } from "next/navigation";
import { deleteFriendGroupAction, leaveFriendGroupAction } from "@/app/actions/sns";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { IconUser } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { getFriendList } from "@/lib/data/friends";
import { signThumbOrOriginalPaths } from "@/lib/data/photos";
import { getFriendGroupMembers, getMyFriendGroups, signGroupIconUrls } from "@/lib/data/sns";
import { requireUser } from "@/lib/supabase/server";
import { AddMembersForm } from "./add-members-form";
import { EditGroupForm } from "./edit-group-form";

export const metadata = { title: "グループの設定 | SNS" };
export const dynamic = "force-dynamic";

export default async function SnsGroupSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ groupId }, sp, { supabase, user }] = await Promise.all([params, searchParams, requireUser()]);

  const groups = await getMyFriendGroups(supabase, user.id);
  const group = groups.find((g) => g.id === groupId);
  if (!group) notFound();

  const isOwner = group.owner_id === user.id;
  const groupIconUrls = await signGroupIconUrls(supabase, [group]);
  const members = await getFriendGroupMembers(supabase, groupId);
  const avatarUrls = await signThumbOrOriginalPaths(
    supabase,
    members.flatMap((m) => (m.profile_image_url ? [m.profile_image_url] : [])),
  );

  const friends = isOwner ? await getFriendList(supabase) : [];
  const memberIds = new Set(members.map((m) => m.user_id));
  const invitableFriends = friends.filter((f) => !memberIds.has(f.friend_user_id));
  const friendAvatarUrls = isOwner
    ? await signThumbOrOriginalPaths(
        supabase,
        invitableFriends.flatMap((f) => (f.profile_image_url ? [f.profile_image_url] : [])),
      )
    : new Map<string, string>();

  return (
    <>
      <PageHeader title="グループの設定" backHref={`/sns/groups/${groupId}`} />
      <PageBody>
        {sp.error ? (
          <p role="alert" className="rounded-2xl border border-blossom bg-blossom-soft px-4 py-3 text-sm text-[#8f4c59]">
            操作に失敗しました。
          </p>
        ) : null}

        <section className="space-y-2">
          <h2 className="px-1 text-sm font-bold text-ink-soft">グループ名・アイコン</h2>
          <EditGroupForm
            groupId={groupId}
            userId={user.id}
            name={group.name}
            iconPath={group.icon_path}
            iconUrl={group.icon_path ? (groupIconUrls.get(group.icon_path) ?? null) : null}
          />
        </section>

        <section className="space-y-2">
          <h2 className="px-1 text-sm font-bold text-ink-soft">メンバー（{members.length}人）</h2>
          <ul className="rough-card divide-y divide-line overflow-hidden">
            {members.map((member) => {
              const avatarUrl = member.profile_image_url ? avatarUrls.get(member.profile_image_url) : null;
              return (
                <li key={member.user_id} className="flex items-center gap-3 px-4 py-3">
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
                  <span className="min-w-0 flex-1 truncate font-semibold">{member.display_name}</span>
                  {member.is_owner ? (
                    <span className="shrink-0 rounded-full bg-leaf-soft px-2 py-0.5 text-[10px] font-bold text-leaf-deep">
                      作成者
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>

        {isOwner && invitableFriends.length > 0 ? (
          <section className="space-y-2">
            <h2 className="px-1 text-sm font-bold text-ink-soft">メンバーを追加</h2>
            <AddMembersForm
              groupId={groupId}
              friends={invitableFriends}
              avatarUrls={Object.fromEntries(friendAvatarUrls)}
            />
          </section>
        ) : null}

        <section className="space-y-2">
          {isOwner ? (
            <form action={deleteFriendGroupAction}>
              <input type="hidden" name="groupId" value={groupId} />
              <ConfirmSubmitButton
                className="btn btn-danger w-full"
                message="このグループを削除しますか？写真やチャットもすべて消えます。"
              >
                グループを削除
              </ConfirmSubmitButton>
            </form>
          ) : (
            <form action={leaveFriendGroupAction}>
              <input type="hidden" name="groupId" value={groupId} />
              <ConfirmSubmitButton className="btn btn-danger w-full" message="このグループを退出しますか？">
                グループを退出
              </ConfirmSubmitButton>
            </form>
          )}
        </section>
      </PageBody>
    </>
  );
}
