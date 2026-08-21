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
  groupLabel = "グループ",
}: {
  active: SnsSection;
  userHref: string;
  groupHref: string;
  /** グループ詳細では「一覧へ戻る」に変え、同じボタンの行き先を明確にする。 */
  groupLabel?: string;
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
        const visibleLabel = key === "group" ? groupLabel : label;
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
            <span className="min-w-0 truncate text-[13px] font-bold leading-tight">{visibleLabel}</span>
          </Link>
        );
      })}
    </nav>
  );
}
