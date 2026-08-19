import Link from "next/link";

/** 「写真」「チャット」の切り替え。/sns と /sns/groups/[groupId] で共通のレイアウト */
export function SnsViewTabs({ baseHref, view }: { baseHref: string; view: "photos" | "chat" }) {
  return (
    <div className="flex gap-1.5 px-1">
      <ViewTab href={`${baseHref}?view=photos`} label="写真" active={view === "photos"} />
      <ViewTab href={`${baseHref}?view=chat`} label="チャット" active={view === "chat"} />
    </div>
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
