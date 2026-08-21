import { SnsViewToggleIcons } from "@/components/sns/sns-view-toggle-icons";

/** 「写真」「チャット」の切り替え。/sns/groups/[groupId] のチャット画面で使う。
 * 写真画面の切替バー（日付チップ付き）と高さ・アイコンを完全に揃え、日付部分だけを省く */
export function SnsViewTabs({ baseHref, view }: { baseHref: string; view: "photos" | "chat" }) {
  return (
    <div id="sns-toggle-bar" className="sticky top-14 z-20 -mx-4 border-y border-line bg-paper/92 px-4 py-2 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
        <span>
          <span className="block text-[9px] font-bold tracking-[0.14em] text-leaf-deep">GROUP ROOM</span>
          <span className="block text-xs font-bold">グループチャット</span>
        </span>
        <SnsViewToggleIcons baseHref={baseHref} view={view} />
      </div>
    </div>
  );
}
