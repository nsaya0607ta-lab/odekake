"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/home", label: "ホーム", icon: "/icons/navigation/home.webp", match: ["/home"] },
  { href: "/sns", label: "SNS", icon: "/icons/navigation/sns.svg", match: ["/sns"] },
  { href: "/map", label: "地図", icon: "/icons/navigation/map.webp", match: ["/map"] },
  {
    href: "/add",
    label: "追加",
    icon: "/icons/navigation/add.webp",
    // 「行った場所を登録」は追加の主導線なので、記録ではなく追加を選択中にする
    match: ["/add", "/spots/new"],
    center: true,
  },
  {
    href: "/records",
    label: "記録",
    icon: "/icons/navigation/records.webp",
    match: ["/records", "/trips", "/visits", "/spots"],
  },
  {
    href: "/mypage",
    label: "マイページ",
    icon: "/icons/navigation/mypage.webp",
    match: ["/mypage"],
  },
] as const;

/**
 * 選択中のタブは、一致した文字列がいちばん長いものひとつに決める。
 * `/spots/new` のように複数のタブに当てはまるパスで、両方が選択中に
 * 見えてしまうのを防ぐ。
 */
function activeHref(pathname: string): string | null {
  let best: { href: string; length: number } | null = null;
  for (const item of ITEMS) {
    for (const prefix of item.match) {
      if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) continue;
      if (!best || prefix.length > best.length) best = { href: item.href, length: prefix.length };
    }
  }
  return best?.href ?? null;
}

export function BottomNav({ snsLocked = false }: { snsLocked?: boolean }) {
  const pathname = usePathname();
  const current = activeHref(pathname);

  return (
    <nav
      aria-label="メインナビゲーション"
      className="app-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 backdrop-blur-sm"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2">
        {ITEMS.map(({ href, label, icon, ...rest }) => {
          const center = "center" in rest && rest.center;
          const active = current === href;
          const locked = href === "/sns" && snsLocked;

          if (locked) {
            return (
              <li key={href} className="flex flex-1">
                <span
                  aria-disabled="true"
                  className="tap-target relative flex w-full flex-col items-center justify-center gap-1 rounded-2xl py-2 text-ink-faint"
                >
                  <span className="absolute top-0 rounded-full bg-paper-deep px-1.5 py-0.5 text-[8px] font-bold whitespace-nowrap text-ink-faint">
                    準備中
                  </span>
                  <Image
                    src={icon}
                    alt={label}
                    width={30}
                    height={30}
                    className="h-[30px] w-[30px] object-contain opacity-30 grayscale"
                  />
                  <span className="text-[11px] opacity-50">{label}</span>
                </span>
              </li>
            );
          }

          if (center) {
            return (
              <li key={href} className="flex flex-1 justify-center">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className="pressable tap-target flex w-full flex-col items-center gap-1 rounded-2xl pt-1 pb-2 active:bg-paper-deep"
                >
                  <Image
                    src={icon}
                    alt={label}
                    width={52}
                    height={52}
                    className="h-[52px] w-[52px] object-contain"
                    style={{ opacity: active ? 1 : 0.6 }}
                    priority
                  />
                  <span className="text-[11px] font-semibold text-leaf-deep">{label}</span>
                </Link>
              </li>
            );
          }

          return (
            <li key={href} className="flex flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`pressable tap-target flex w-full flex-col items-center justify-center gap-1 rounded-2xl py-2 active:bg-paper-deep ${
                  active ? "text-leaf-deep" : "text-ink-faint"
                }`}
              >
                <Image
                  src={icon}
                  alt={label}
                  width={30}
                  height={30}
                  className="h-[30px] w-[30px] object-contain"
                  style={{ opacity: active ? 1 : 0.6 }}
                />
                <span className={`text-[11px] ${active ? "font-semibold" : ""}`}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
