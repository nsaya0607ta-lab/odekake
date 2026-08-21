import Link from "next/link";
import { IconUser } from "@/components/icons";

export type SnsPersonRow = {
  id: string;
  label: string;
  iconUrl?: string;
  isMe?: boolean;
};

/** 個人SNSを切り替える、Twitterのプロフィール一覧に相当する横スクロール。 */
export function SnsPeopleRail({ people, activeUserId }: { people: SnsPersonRow[]; activeUserId: string }) {
  return (
    <section className="sns-rail-panel" aria-labelledby="sns-people-title">
      <div className="mb-3 flex items-end justify-between gap-3 px-1">
        <div>
          <p className="text-[10px] font-bold tracking-[0.16em] text-leaf-deep">PERSONAL</p>
          <h2 id="sns-people-title" className="text-base font-bold">
            ユーザー
          </h2>
        </div>
        <p className="text-[10px] text-ink-faint">アイコンをタップして切り替え</p>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {people.map((person) => {
          const active = person.id === activeUserId;
          return (
            <Link
              key={person.id}
              href={`/sns/users/${person.id}`}
              aria-current={active ? "page" : undefined}
              className="group flex w-[4.25rem] shrink-0 flex-col items-center gap-1.5"
            >
              <span className={`sns-person-avatar pressable ${active ? "is-active" : ""}`}>
                {person.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={person.iconUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <IconUser size={23} className="text-ink-faint" />
                )}
                {person.isMe ? <span className="sns-me-badge">自分</span> : null}
              </span>
              <span className={`w-full truncate text-center text-[10px] font-bold ${active ? "text-leaf-deep" : "text-ink-soft"}`}>
                {person.label}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
