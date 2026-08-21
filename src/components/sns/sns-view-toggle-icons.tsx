import Link from "next/link";

/** 写真/チャットの切替アイコン2つ。両方の画面で同じ見た目・高さになるよう共通化する */
export function SnsViewToggleIcons({ baseHref, view }: { baseHref: string; view: "photos" | "chat" }) {
  return (
    <div className="flex shrink-0 items-center gap-1 rounded-2xl border border-line bg-card/85 p-1 shadow-sm">
      <ToggleIcon href={`${baseHref}?view=photos`} label="写真" src="/icons/sns/photo-toggle.png" active={view === "photos"} />
      <ToggleIcon href={`${baseHref}?view=chat`} label="チャット" src="/icons/sns/chat-toggle.png" active={view === "chat"} />
    </div>
  );
}

function ToggleIcon({
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
      aria-current={active ? "page" : undefined}
      className={`sns-view-toggle is-${active ? `active-${label === "写真" ? "photos" : "chat"}` : "idle"} tap-target flex h-10 min-w-[5.3rem] items-center justify-center gap-1.5 rounded-xl px-2 transition-all`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className={`h-6 w-6 object-contain ${active ? "brightness-0 invert" : "opacity-70"}`} />
      <span className="text-xs font-bold">{label}</span>
    </Link>
  );
}
