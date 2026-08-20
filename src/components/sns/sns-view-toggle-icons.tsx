import Link from "next/link";

/** 写真/チャットの切替アイコン2つ。両方の画面で同じ見た目・高さになるよう共通化する */
export function SnsViewToggleIcons({ baseHref, view }: { baseHref: string; view: "photos" | "chat" }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
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
      aria-current={active}
      className={`tap-target flex h-11 w-11 items-center justify-center rounded-xl border transition-colors ${
        active ? "border-leaf bg-leaf-soft" : "border-line bg-card"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-8 w-8 object-contain" />
    </Link>
  );
}
