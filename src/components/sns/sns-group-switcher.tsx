import Link from "next/link";
import { IconPlus } from "@/components/icons";
import type { FriendGroupRow } from "@/lib/supabase/types";

/** /sns と /sns/groups/[groupId] の上部に出す、グループアイコンの横スクロール切り替え */
export function SnsGroupSwitcher({ groups, activeGroupId }: { groups: FriendGroupRow[]; activeGroupId?: string }) {
  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: "none" }}>
      {groups.map((group) => (
        <GroupIcon
          key={group.id}
          href={`/sns/groups/${group.id}`}
          icon={group.icon}
          label={group.name}
          active={activeGroupId === group.id}
          unread={group.has_unread}
        />
      ))}
      <Link
        href="/sns/groups/new"
        aria-label="グループを作る"
        className="flex shrink-0 flex-col items-center gap-1"
      >
        <span className="tap-target flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-line-strong text-ink-faint active:bg-paper-deep">
          <IconPlus size={20} />
        </span>
        <span className="max-w-[3.5rem] truncate text-[10px] text-ink-faint">追加</span>
      </Link>
    </div>
  );
}

function GroupIcon({
  href,
  icon,
  label,
  active,
  unread,
}: {
  href: string;
  icon: string;
  label: string;
  active: boolean;
  unread?: boolean;
}) {
  return (
    <Link href={href} className="flex shrink-0 flex-col items-center gap-1">
      <span className="relative">
        <span
          className={`tap-target flex h-14 w-14 items-center justify-center rounded-full border-2 text-2xl transition-colors ${
            active ? "border-leaf bg-leaf-soft" : "border-line-strong bg-card active:bg-paper-deep"
          }`}
        >
          {icon}
        </span>
        {unread ? (
          <span className="absolute top-0 right-0 h-3 w-3 rounded-full bg-[#4a90d9] ring-2 ring-paper" />
        ) : null}
      </span>
      <span className={`max-w-[3.5rem] truncate text-[10px] font-semibold ${active ? "text-leaf-deep" : "text-ink-soft"}`}>
        {label}
      </span>
    </Link>
  );
}
