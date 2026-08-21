import { notFound } from "next/navigation";
import { deleteFriendGroupAction, leaveFriendGroupAction } from "@/app/actions/sns";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { IconSettings, IconUser, IconUsers } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { SnsBackgroundBand } from "@/components/sns/sns-background-band";
import { SnsIllustratedHero } from "@/components/sns/sns-illustrated-hero";
import { getFriendList } from "@/lib/data/friends";
import { signThumbOrOriginalPaths } from "@/lib/data/photos";
import { getFriendGroupMembers, getMyFriendGroups, getSnsHiddenUserIds, signGroupIconUrls } from "@/lib/data/sns";
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
  const [groupIconUrls, members, friends, hiddenUserIds] = await Promise.all([
    signGroupIconUrls(supabase, [group]),
    getFriendGroupMembers(supabase, groupId),
    isOwner ? getFriendList(supabase) : Promise.resolve([]),
    isOwner ? getSnsHiddenUserIds(supabase) : Promise.resolve(new Set<string>()),
  ]);
  const memberIds = new Set(members.map((m) => m.user_id));
  const invitableFriends = friends.filter(
    (friend) => !memberIds.has(friend.friend_user_id) && !hiddenUserIds.has(friend.friend_user_id),
  );
  const [avatarUrls, friendAvatarUrls] = await Promise.all([
    signThumbOrOriginalPaths(
      supabase,
      members.flatMap((m) => (m.profile_image_url ? [m.profile_image_url] : [])),
    ),
    isOwner
      ? signThumbOrOriginalPaths(
        supabase,
        invitableFriends.flatMap((f) => (f.profile_image_url ? [f.profile_image_url] : [])),
      )
      : Promise.resolve(new Map<string, string>()),
  ]);

  return (
    <>
      <PageHeader title="グループの設定" backHref={`/sns/groups/${groupId}`} />
      <SnsBackgroundBand hasToggleBar={false} />
      <PageBody className="sns-page-shell sns-subpage-body space-y-4">
        <SnsIllustratedHero
          eyebrow="CREW CONTROL"
          title={`${group.name}を整える`}
          description="目印とメンバーを、迷わずひとつの画面で管理。"
          artSrc="/illustrations/sns/group-tools-v2.webp"
          tone="group"
        />
        {sp.error ? (
          <p role="alert" className="rounded-2xl border border-blossom bg-blossom-soft px-4 py-3 text-sm text-[#8f4c59]">
            操作に失敗しました。
          </p>
        ) : null}

        <section className="sns-settings-card space-y-3">
          <div className="sns-section-heading">
            <span className="sns-section-heading-icon is-violet" aria-hidden="true"><IconSettings size={17} /></span>
            <span>
              <span className="block text-sm font-black">グループの目印</span>
              <span className="block text-[10px] text-ink-faint">名前とアイコン</span>
            </span>
          </div>
          <EditGroupForm
            groupId={groupId}
            userId={user.id}
            name={group.name}
            iconPath={group.icon_path}
            iconUrl={group.icon_path ? (groupIconUrls.get(group.icon_path) ?? null) : null}
          />
        </section>

        <section className="sns-settings-card space-y-3">
          <div className="sns-section-heading">
            <span className="sns-section-heading-icon is-cyan" aria-hidden="true"><IconUsers size={17} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-black">現在のメンバー</span>
              <span className="block text-[10px] text-ink-faint">このグループを見られる人</span>
            </span>
            <span className="sns-member-count">{members.length}人</span>
          </div>
          <ul className="sns-current-member-list">
            {members.map((member) => {
              const avatarUrl = member.profile_image_url ? avatarUrls.get(member.profile_image_url) : null;
              return (
                <li key={member.user_id} className="flex items-center gap-3 px-3 py-2.5">
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
          <section className="sns-settings-card space-y-3">
            <div className="sns-section-heading">
              <span className="sns-section-heading-icon is-coral" aria-hidden="true">＋</span>
              <span>
                <span className="block text-sm font-black">仲間を追加</span>
                <span className="block text-[10px] text-ink-faint">選んだフレンドを招待</span>
              </span>
            </div>
            <AddMembersForm
              groupId={groupId}
              friends={invitableFriends}
              avatarUrls={Object.fromEntries(friendAvatarUrls)}
            />
          </section>
        ) : null}

        <section className="sns-danger-zone space-y-2">
          <p className="px-1 text-[10px] font-black tracking-[0.12em] text-[#a65668]">DANGER ZONE</p>
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
