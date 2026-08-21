import Link from "next/link";
import { IconHome, IconUser, IconUsers } from "@/components/icons";

type SnsSection = "home" | "user" | "group";

const ITEMS = [
  { key: "home", label: "ホーム", icon: IconHome },
  { key: "user", label: "ユーザー", icon: IconUser },
  { key: "group", label: "グループ", icon: IconUsers },
] as const;

/** SNS内の3つの役割を常に見える形で切り替える主ナビゲーション。 */
export function SnsPrimaryNav({
  active,
  userHref,
  groupHref,
}: {
  active: SnsSection;
  userHref: string;
  groupHref: string;
}) {
  const hrefs: Record<SnsSection, string> = {
    home: "/sns/home",
    user: userHref,
    group: groupHref,
  };

  return (
    <nav aria-label="SNSの表示切り替え" className="sns-primary-nav">
      {ITEMS.map(({ key, label, icon: Icon }) => {
        const selected = active === key;
        return (
          <Link
            key={key}
            href={hrefs[key]}
            aria-current={selected ? "page" : undefined}
            className={`sns-primary-nav-item pressable is-${key} ${selected ? "is-active" : ""}`}
          >
            <span className="sns-primary-nav-icon" aria-hidden="true">
              <Icon size={19} />
            </span>
            <span className="min-w-0 truncate text-[13px] font-bold leading-tight">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
