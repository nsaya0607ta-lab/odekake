import { IconUser } from "@/components/icons";

export type SnsPersonRow = {
  id: string;
  label: string;
  iconUrl?: string;
};

/**
 * 個人アカウント画面の切替バー。写真/チャット切替バーと同じ高さ・位置に、
 * 個人アカウント（自分）を左端、縦棒の右にフレンドのアイコンを並べる。
 * 入り切らない分は左にスワイプして見る。押したときの挙動は今後実装する。
 */
export function SnsPeopleToggleBar({ own, friends }: { own: SnsPersonRow; friends: SnsPersonRow[] }) {
  return (
    <div
      id="sns-toggle-bar"
      className="sticky top-14 z-20 -mx-4 -mt-6 border-b border-line bg-paper/92 px-4 backdrop-blur-sm"
    >
      <div
        className="mx-auto flex max-w-lg items-center gap-1.5 overflow-x-auto py-1.5"
        style={{ scrollbarWidth: "none" }}
      >
        <PersonIcon person={own} active />
        {friends.length > 0 ? <span aria-hidden className="h-8 w-px shrink-0 bg-line" /> : null}
        {friends.map((friend) => (
          <PersonIcon key={friend.id} person={friend} />
        ))}
      </div>
    </div>
  );
}

function PersonIcon({ person, active = false }: { person: SnsPersonRow; active?: boolean }) {
  return (
    <span
      aria-label={person.label}
      className={`tap-target flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border transition-colors ${
        active ? "border-leaf bg-leaf-soft" : "border-line bg-card"
      }`}
    >
      {person.iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={person.iconUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-ink-faint">
          <IconUser size={18} />
        </span>
      )}
    </span>
  );
}
