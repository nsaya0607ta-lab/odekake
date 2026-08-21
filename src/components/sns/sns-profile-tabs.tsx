import Link from "next/link";
import { IconBookmark, IconImage, IconMapPin, IconNotebook } from "@/components/icons";

export type SnsProfileTab = "posts" | "photos" | "places" | "saved";

const TABS = [
  { id: "posts", label: "投稿", icon: IconNotebook },
  { id: "photos", label: "写真", icon: IconImage },
  { id: "places", label: "場所", icon: IconMapPin },
  { id: "saved", label: "保存", icon: IconBookmark },
] as const;

export function parseSnsProfileTab(value: string | undefined, isMine: boolean): SnsProfileTab {
  if (value === "photos" || value === "places") return value;
  if (value === "saved" && isMine) return value;
  return "posts";
}

export function SnsProfileTabs({
  active,
  baseHref,
  isMine,
  counts,
}: {
  active: SnsProfileTab;
  baseHref: string;
  isMine: boolean;
  counts: Partial<Record<SnsProfileTab, number>>;
}) {
  return (
    <nav aria-label="プロフィールの投稿切り替え" className="sns-profile-tabs">
      {TABS.filter((tab) => tab.id !== "saved" || isMine).map((tab) => {
        const Icon = tab.icon;
        const selected = active === tab.id;
        const href = tab.id === "posts" ? baseHref : `${baseHref}?tab=${tab.id}`;
        return (
          <Link
            key={tab.id}
            href={href}
            prefetch={false}
            scroll={false}
            aria-current={selected ? "page" : undefined}
            className={`pressable ${selected ? "is-active" : ""}`}
          >
            <Icon size={16} />
            <span>{tab.label}</span>
            <small>{counts[tab.id] ?? 0}</small>
          </Link>
        );
      })}
    </nav>
  );
}
