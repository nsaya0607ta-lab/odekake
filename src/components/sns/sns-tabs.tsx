import Link from "next/link";
import { IconPlus } from "@/components/icons";
import type { FriendGroupRow } from "@/lib/supabase/types";

/** /sns と /sns/groups/[groupId] の上部に出す、全体フィードとグループの切り替えタブ */
export function SnsTabs({ groups, activeGroupId }: { groups: FriendGroupRow[]; activeGroupId?: string }) {
  return (
    <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: "none" }}>
      <SnsTab href="/sns" label="みんな" active={!activeGroupId} />
      {groups.map((group) => (
        <SnsTab
          key={group.id}
          href={`/sns/groups/${group.id}`}
          label={group.name}
          active={activeGroupId === group.id}
          unread={group.has_unread}
        />
      ))}
      <Link
        href="/sns/groups/new"
        aria-label="グループを作る"
        className="tap-target flex shrink-0 items-center justify-center rounded-full border border-dashed border-line-strong px-3 text-ink-faint active:bg-paper-deep"
      >
        <IconPlus size={16} />
      </Link>
    </div>
  );
}

function SnsTab({
  href,
  label,
  active,
  unread,
}: {
  href: string;
  label: string;
  active: boolean;
  unread?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`tap-target relative shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors ${
        active
          ? "border-leaf bg-leaf-soft text-leaf-deep"
          : "border-line-strong bg-card text-ink-soft active:bg-paper-deep"
      }`}
    >
      {label}
      {unread ? (
        <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#4a90d9] ring-2 ring-paper" />
      ) : null}
    </Link>
  );
}
