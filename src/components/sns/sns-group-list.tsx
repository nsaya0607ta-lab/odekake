import Link from "next/link";
import { IconChat, IconChevronRight, IconImage, IconUsers } from "@/components/icons";
import { formatRelativeTimeJa } from "@/lib/date";
import type { FriendGroupSummaryRow } from "@/lib/supabase/types";

export function SnsGroupList({
  groups,
  iconUrls,
  currentUserId,
}: {
  groups: FriendGroupSummaryRow[];
  iconUrls: Map<string, string>;
  currentUserId: string;
}) {
  return (
    <ul className="space-y-3">
      {groups.map((group) => {
        const iconUrl = group.icon_path ? iconUrls.get(group.icon_path) : undefined;
        const latestLabel = group.latest_preview
          ? `${group.latest_actor_name ? `${group.latest_actor_name}：` : ""}${group.latest_preview}`
          : "まだ投稿はありません";

        return (
          <li key={group.id}>
            <Link
              href={`/sns/groups/${group.id}`}
              prefetch={false}
              data-haptic="light"
              className={`sns-group-list-card pressable ${group.has_unread ? "is-unread" : ""}`}
            >
              <span className="sns-group-list-icon">
                {iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={iconUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                ) : (
                  <span aria-hidden="true">{group.icon}</span>
                )}
                {group.has_unread ? <span className="sns-group-list-icon-dot" aria-hidden="true" /> : null}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[15px] font-black text-ink">{group.name}</span>
                  {group.owner_id === currentUserId ? <span className="sns-group-owner-chip">オーナー</span> : null}
                  {group.unread_count > 0 ? (
                    <span className="sns-group-unread-count">{group.unread_count > 99 ? "99+" : group.unread_count}</span>
                  ) : null}
                </span>

                <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-ink-soft">
                  <span className={`sns-group-latest-kind is-${group.latest_kind ?? "empty"}`} aria-hidden="true">
                    {group.latest_kind === "photo" ? <IconImage size={13} /> : group.latest_kind === "message" ? <IconChat size={13} /> : <IconUsers size={13} />}
                  </span>
                  <span className={`truncate ${group.has_unread ? "font-bold text-ink" : ""}`}>{latestLabel}</span>
                </span>

                <span className="mt-1.5 flex items-center gap-2 text-[10px] font-bold text-ink-faint">
                  <span>{group.member_count}人</span>
                  {group.latest_at ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{formatRelativeTimeJa(group.latest_at)}</span>
                    </>
                  ) : null}
                </span>
              </span>

              <span className="sns-group-list-arrow" aria-hidden="true">
                <IconChevronRight size={18} />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
