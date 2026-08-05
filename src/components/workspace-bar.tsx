import Link from "next/link";
import { IconChevronRight, IconFlag, IconUsers } from "@/components/icons";
import type { Workspace } from "@/lib/data/workspace";

/**
 * いま開いている旅ワークスペースの表示と切替への導線。
 * 下部ナビの主要画面（ホーム・地図・記録）の先頭に置く。
 */
export function WorkspaceBar({ workspace }: { workspace: Workspace }) {
  const isShared = workspace.kind === "trip";

  return (
    <Link
      href="/workspaces"
      className="rough-card flex items-center gap-3 px-4 py-2.5 transition-transform active:scale-[0.99]"
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          isShared ? "bg-sky-soft text-[#42718f]" : "bg-blossom-soft text-[#95505e]"
        }`}
      >
        {isShared ? <IconUsers size={17} /> : <IconFlag size={17} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] text-ink-faint">{isShared ? "共有旅" : "いまの旅"}</span>
        <span className="block truncate font-semibold">{workspace.name}</span>
      </span>
      {isShared ? (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-paper-deep px-2.5 py-1 text-[11px] font-semibold text-ink-soft">
          <IconUsers size={13} />
          <span className="tabular-nums">{workspace.memberCount}</span>人
        </span>
      ) : null}
      <span className="shrink-0 text-xs text-leaf-deep">切替</span>
      <IconChevronRight size={16} className="shrink-0 text-ink-faint" />
    </Link>
  );
}
