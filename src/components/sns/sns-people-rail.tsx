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
    <section className="sns-people-strip" aria-label="表示するユーザーを切り替える">
      <div className="flex gap-2.5 overflow-x-auto px-1 py-1" style={{ scrollbarWidth: "none" }}>
        {people.map((person) => {
          const active = person.id === activeUserId;
          return (
            <Link
              key={person.id}
              href={`/sns/users/${person.id}`}
              scroll={false}
              data-haptic="light"
              aria-current={active ? "page" : undefined}
              className="group flex w-[3.6rem] shrink-0 flex-col items-center gap-1"
            >
              <span className={`sns-person-avatar is-compact pressable ${active ? "is-active" : ""}`}>
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
