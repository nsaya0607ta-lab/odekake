import Link from "next/link";

/** 「写真」「チャット」の切り替え。/sns/groups/[groupId] で使う。
 * スクロールしても常に押せるよう sticky にする */
export function SnsViewTabs({ baseHref, view }: { baseHref: string; view: "photos" | "chat" }) {
  return (
    <div className="sticky top-14 z-10 -mx-4 -mt-4 bg-paper/95 px-4 py-1 backdrop-blur-sm">
      <div className="flex items-center justify-center gap-8 rounded-3xl border border-line bg-card py-1.5 shadow-sm">
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
      className={`tap-target flex flex-col items-center gap-0.5 rounded-2xl px-2 py-1 transition-all ${
        active ? "scale-105 opacity-100" : "opacity-45"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-11 w-11 object-contain" />
      <span className={`text-[11px] font-semibold ${active ? "text-leaf-deep" : "text-ink-faint"}`}>{label}</span>
    </Link>
  );
}
