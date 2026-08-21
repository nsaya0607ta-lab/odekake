import Image from "next/image";
import Link from "next/link";

/** 写真/チャットの切替アイコン2つ。両方の画面で同じ見た目・高さになるよう共通化する */
export function SnsViewToggleIcons({ baseHref, view }: { baseHref: string; view: "photos" | "chat" }) {
  return (
    <div className="sns-view-toggle-shell flex shrink-0 items-center gap-1 rounded-2xl p-1">
      <ToggleIcon href={`${baseHref}?view=photos`} label="写真" src="/illustrations/sns/mode-photo-v2.webp" active={view === "photos"} />
      <ToggleIcon href={`${baseHref}?view=chat`} label="チャット" src="/illustrations/sns/mode-chat-v2.webp" active={view === "chat"} />
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
      scroll={false}
      data-haptic="light"
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`sns-view-toggle is-${active ? `active-${label === "写真" ? "photos" : "chat"}` : "idle"} tap-target flex h-11 min-w-[5.5rem] items-center justify-center gap-1 rounded-xl px-1.5 transition-all`}
    >
      <span className="sns-view-toggle-art" aria-hidden="true">
        <Image src={src} alt="" width={34} height={34} sizes="34px" />
      </span>
      <span className="text-[11px] font-black">{label}</span>
    </Link>
  );
}
