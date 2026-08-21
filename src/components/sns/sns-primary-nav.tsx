import Image from "next/image";
import Link from "next/link";

type SnsSection = "home" | "user" | "group";

const ITEMS = [
  {
    key: "home",
    label: "ホーム",
    note: "みんな",
    artSrc: "/illustrations/sns/nav-home-v2.webp",
  },
  {
    key: "user",
    label: "ユーザー",
    note: "個人",
    artSrc: "/illustrations/sns/nav-user-v2.webp",
  },
  {
    key: "group",
    label: "グループ",
    note: "共有",
    artSrc: "/illustrations/sns/nav-group-v2.webp",
  },
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
    <nav aria-label="SNSの表示切り替え" className={`sns-primary-nav is-${active}`}>
      {ITEMS.map(({ key, label, note, artSrc }) => {
        const selected = active === key;
        return (
          <Link
            key={key}
            href={hrefs[key]}
            data-haptic="light"
            aria-current={selected ? "page" : undefined}
            className={`sns-primary-nav-item pressable is-${key} ${selected ? "is-active" : ""}`}
          >
            <span className="sns-primary-nav-artframe" aria-hidden="true">
              <Image src={artSrc} alt="" width={46} height={46} className="sns-primary-nav-art" sizes="46px" />
              <span className="sns-primary-nav-sparkle">✦</span>
            </span>
            <span className="min-w-0 leading-none">
              <span className="block truncate text-[12px] font-black">{label}</span>
              <span className="mt-1 block truncate text-[8px] font-black tracking-[0.12em] opacity-65">{note}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
