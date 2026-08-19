import Link from "next/link";
import { IconInfo } from "@/components/icons";

/** 「写真」「チャット」の切り替え。/sns/groups/[groupId] で使う。
 * スクロールしても常に押せるよう sticky にする */
export function SnsViewTabs({ baseHref, view }: { baseHref: string; view: "photos" | "chat" }) {
  return (
    <div className="sticky top-14 z-10 -mx-4 bg-paper/95 px-4 pt-1 backdrop-blur-sm">
      <div className="flex overflow-hidden rounded-2xl border border-line bg-card">
        <ViewTab href={`${baseHref}?view=photos`} label="写真" active={view === "photos"} />
        <ViewTab href={`${baseHref}?view=chat`} label="チャット" active={view === "chat"} />
      </div>
      <p className="mt-2 flex items-center justify-center gap-1 text-[11px] text-ink-faint">
        写真は日付ごとに整理 / チャットは通常表示
        <IconInfo size={13} />
      </p>
    </div>
  );
}

function ViewTab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active}
      className={`tap-target flex-1 border-b-2 py-3 text-center text-sm font-bold transition-colors ${
        active ? "border-leaf text-leaf-deep" : "border-transparent text-ink-faint"
      }`}
    >
      {label}
    </Link>
  );
}
