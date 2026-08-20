import Link from "next/link";

/** 「写真」「チャット」の切り替え。/sns/groups/[groupId] で使う。
 * PageHeader と同じ見た目のバーにして、スクロールで貼り付いたときに
 * ヘッダーの続きに見えるようにする */
export function SnsViewTabs({ baseHref, view }: { baseHref: string; view: "photos" | "chat" }) {
  return (
    <div className="sticky top-14 z-20 -mx-4 -mt-4 border-b border-line bg-paper/92 px-4 backdrop-blur-sm">
      <div className="mx-auto flex max-w-lg items-center justify-center gap-10">
        <ViewTab href={`${baseHref}?view=photos`} label="写真" src="/icons/sns/photo-toggle.png" active={view === "photos"} />
        <ViewTab href={`${baseHref}?view=chat`} label="チャット" src="/icons/sns/chat-toggle.png" active={view === "chat"} />
      </div>
    </div>
  );
}

function ViewTab({
  href,
  label,
  src,
  active,
}: {
  href: string;
  label: string;
  src: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active}
      className={`tap-target flex flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 transition-all ${
        active ? "scale-105 bg-leaf-soft opacity-100" : "opacity-40"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-10 w-10 object-contain" />
      <span className={`text-[11px] font-semibold ${active ? "text-leaf-deep" : "text-ink-faint"}`}>{label}</span>
    </Link>
  );
}
