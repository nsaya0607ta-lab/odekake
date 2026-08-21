"use client";

import type { ReactNode } from "react";
import { useActionState, useEffect, useState, useTransition } from "react";
import {
  setSnsUserBlockAction,
  updateSnsNotificationSettingsAction,
} from "@/app/actions/sns";
import { emptyActionState, FormMessage, SubmitButton } from "@/components/form";
import {
  IconAt,
  IconBell,
  IconChat,
  IconCheck,
  IconHeart,
  IconShield,
  IconUser,
  IconUsers,
  IconVolumeOff,
} from "@/components/icons";
import type { SnsNotificationPreferences } from "@/lib/data/sns-notifications";
import { refreshSnsUnreadCount } from "@/components/sns/use-sns-unread-count";

type GroupOption = { id: string; name: string; icon: string };
type BlockedUser = { userId: string; displayName: string; avatarUrl?: string };

export function SnsSettingsForm({
  preferences,
  groups,
  initialBlockedUsers,
}: {
  preferences: SnsNotificationPreferences;
  groups: GroupOption[];
  initialBlockedUsers: BlockedUser[];
}) {
  const [state, action] = useActionState(updateSnsNotificationSettingsAction, emptyActionState);
  const [blockedUsers, setBlockedUsers] = useState(initialBlockedUsers);
  const [blockMessage, setBlockMessage] = useState("");
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (state.ok) void refreshSnsUnreadCount();
  }, [state.ok]);

  function unblock(userId: string) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("userId", userId);
      formData.set("blocked", "0");
      const result = await setSnsUserBlockAction(formData);
      if (result.ok) {
        setBlockedUsers((current) => current.filter((person) => person.userId !== userId));
        setBlockMessage("ブロックを解除しました。");
      } else {
        setBlockMessage(result.error);
      }
      window.setTimeout(() => setBlockMessage(""), 2600);
    });
  }

  return (
    <div className="space-y-4">
      <form action={action} className="sns-settings-feature-card space-y-3">
        <div className="sns-settings-feature-title">
          <span><IconBell size={19} /></span>
          <div><h2>通知する内容</h2><p>欲しい便りだけを受け取れます</p></div>
        </div>
        <div className="sns-settings-toggle-list">
          <SettingsToggle name="notifyReplies" defaultChecked={preferences.replies} icon={<IconChat size={17} />} label="返信" description="自分の投稿への返信" />
          <SettingsToggle name="notifyLikes" defaultChecked={preferences.likes} icon={<IconHeart size={17} />} label="いいね" description="投稿への新しい反応" />
          <SettingsToggle name="notifyMentions" defaultChecked={preferences.mentions} icon={<IconAt size={17} />} label="メンション" description="@名前で呼ばれたとき" />
          <SettingsToggle name="notifyGroups" defaultChecked={preferences.groups} icon={<IconUsers size={17} />} label="グループ" description="写真やチャットの新着" />
        </div>

        {groups.length > 0 ? (
          <section className="sns-muted-groups">
            <div className="flex items-center gap-2"><IconVolumeOff size={16} /><h3>グループごとのミュート</h3></div>
            <p>選んだグループは、SNSタブの未読バッジと通知一覧へ出しません。</p>
            <div className="mt-2 space-y-1.5">
              {groups.map((group) => (
                <label key={group.id} className="sns-muted-group-row pressable">
                  <span aria-hidden="true">{group.icon}</span>
                  <strong>{group.name}</strong>
                  <input
                    type="checkbox"
                    name="mutedGroupIds"
                    value={group.id}
                    defaultChecked={preferences.mutedGroupIds.includes(group.id)}
                  />
                  <span className="sns-switch" aria-hidden="true" />
                </label>
              ))}
            </div>
          </section>
        ) : null}
        <FormMessage state={state} />
        <SubmitButton className="sns-primary-submit pressable" pendingLabel="設定を保存中…">
          <IconCheck size={17} />設定を保存
        </SubmitButton>
      </form>

      <section className="sns-settings-feature-card space-y-3">
        <div className="sns-settings-feature-title is-safety">
          <span><IconShield size={19} /></span>
          <div><h2>安心して使うために</h2><p>ブロックした相手を管理できます</p></div>
        </div>
        {blockedUsers.length > 0 ? (
          <ul className="sns-blocked-list">
            {blockedUsers.map((person) => (
              <li key={person.userId}>
                <span className="sns-blocked-avatar">
                  {person.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={person.avatarUrl} alt="" />
                  ) : <IconUser size={18} />}
                </span>
                <strong>{person.displayName}</strong>
                <button type="button" onClick={() => unblock(person.userId)} className="pressable">解除</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="sns-safe-empty"><IconShield size={17} />ブロック中のユーザーはいません</p>
        )}
        {blockMessage ? <p className="sns-settings-inline-message" role="status">{blockMessage}</p> : null}
      </section>
    </div>
  );
}

function SettingsToggle({
  name,
  defaultChecked,
  icon,
  label,
  description,
}: {
  name: string;
  defaultChecked: boolean;
  icon: ReactNode;
  label: string;
  description: string;
}) {
  return (
    <label className="sns-settings-toggle-row pressable">
      <span className="sns-settings-toggle-icon">{icon}</span>
      <span className="min-w-0 flex-1"><strong>{label}</strong><small>{description}</small></span>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} />
      <span className="sns-switch" aria-hidden="true" />
    </label>
  );
}
