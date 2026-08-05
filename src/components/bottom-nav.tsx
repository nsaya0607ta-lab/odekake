"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconHome, IconMapPin, IconNotebook, IconPlus, IconUser } from "./icons";

const ITEMS = [
  { href: "/home", label: "ホーム", Icon: IconHome, match: ["/home"] },
  { href: "/map", label: "地図", Icon: IconMapPin, match: ["/map"] },
  { href: "/add", label: "追加", Icon: IconPlus, match: ["/add"], center: true },
  { href: "/records", label: "記録", Icon: IconNotebook, match: ["/records", "/trips", "/visits", "/spots"] },
  { href: "/mypage", label: "マイページ", Icon: IconUser, match: ["/mypage", "/invitations"] },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="メインナビゲーション"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 backdrop-blur-sm"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2">
        {ITEMS.map(({ href, label, Icon, match, ...rest }) => {
          const center = "center" in rest && rest.center;
          const active = match.some((m) => pathname === m || pathname.startsWith(`${m}/`));

          if (center) {
            return (
              <li key={href} className="flex flex-1 justify-center">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className="flex w-full flex-col items-center gap-1 pt-1.5 pb-2"
                >
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-full border transition-transform active:scale-95 ${
                      active
                        ? "border-leaf-deep bg-leaf text-white"
                        : "border-leaf bg-leaf-soft text-leaf-deep"
                    }`}
                  >
                    <IconPlus size={26} strokeWidth={2} />
                  </span>
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
                className={`flex w-full flex-col items-center justify-center gap-1 rounded-2xl py-2.5 transition-colors ${
                  active ? "text-leaf-deep" : "text-ink-faint"
                }`}
              >
                <Icon size={23} strokeWidth={active ? 2 : 1.6} />
                <span className={`text-[11px] ${active ? "font-semibold" : ""}`}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
