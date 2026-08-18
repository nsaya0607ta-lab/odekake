import Link from "next/link";
import { IconChevronRight } from "@/components/icons";
import { DUMMY_NOTICES } from "@/lib/dummy-notices";

/**
 * ホームの「お知らせ」カード。犬のメインカードの上に置く。
 *
 * public/notice-card.webp は「お知らせ」タグ・切手・リュックのイラストが
 * 左側に焼き込まれた透明背景の枠。右側の空白に、新着件数と最大3件の
 * お知らせタイトルを文字で重ねる。
 *
 * お知らせ機能のDBがまだ無いので、一覧は src/lib/dummy-notices.ts の
 * ダミーデータを表示している。
 */
const CARD_RATIO = "2172 / 724";

const CARD_SRC = "/notice-card.webp";

export function HomeNoticeCard() {
  const notices = DUMMY_NOTICES.slice(0, 3);
  const unreadCount = DUMMY_NOTICES.length;
  const summary = unreadCount > 0 ? `新着情報が${unreadCount}件あります` : "すべて既読済み";

  return (
    <Link
      href="/notices"
      className="pressable relative block active:scale-[0.99]"
      style={{ marginLeft: -9, marginRight: -12 }}
      aria-label={`お知らせ。${summary}`}
    >
      <div className="relative w-full" style={{ aspectRatio: CARD_RATIO }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={CARD_SRC}
          alt=""
          aria-hidden="true"
          width={2172}
          height={724}
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full select-none"
        />
        <div className="absolute inset-0 flex items-center gap-1" style={{ paddingLeft: "37%", paddingRight: "8%" }}>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p
              className="truncate text-sm font-bold text-ink"
              style={{ marginLeft: "11%", transform: "translate(calc(10px + 3em), -5px)" }}
            >
              {summary}
            </p>
            {notices.length > 0 ? (
              <div className="flex flex-col" style={{ gap: 2, transform: "translateX(-2em)" }}>
                {notices.map((notice) => (
                  <p key={notice.id} className="truncate text-xs text-ink-soft">
                    ・{notice.title}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
          <IconChevronRight size={18} className="shrink-0 text-ink-faint" />
        </div>
      </div>
    </Link>
  );
}
