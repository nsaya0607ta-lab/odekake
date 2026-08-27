import Image from "next/image";
import Link from "next/link";
import { IconChevronRight } from "@/components/icons";
import { MarqueeText } from "@/components/marquee-text";
import type { NoticeFeedRow } from "@/lib/supabase/types";

/**
 * ホームの「お知らせ」カード。犬のメインカードの上に置く。
 *
 * public/notice-card.webp は「お知らせ」タグ・切手・リュックのイラストが
 * 左側に焼き込まれた透明背景の枠。右側の空白に、新着件数と最大3件の
 * お知らせタイトルを文字で重ねる。
 */
const CARD_RATIO = "2172 / 724";

const CARD_SRC = "/notice-card.webp";

export function HomeNoticeCard({
  unreadCount,
  notices,
}: {
  /** 直近24時間に作成された、自分がまだ読んでいないお知らせの件数 */
  unreadCount: number;
  /** 新しい順の最新お知らせ（先頭3件を表示） */
  notices: NoticeFeedRow[];
}) {
  const latest = notices.slice(0, 3);
  const summary = unreadCount > 0 ? `新着情報が${unreadCount}件あります` : "すべて既読済み";

  return (
    <Link
      href="/notices"
      className="pressable relative block active:scale-[0.99]"
      style={{ marginLeft: -9, marginRight: -12, marginTop: 13 }}
      aria-label={`お知らせ。${summary}`}
    >
      <div className="relative w-full" style={{ aspectRatio: CARD_RATIO }}>
        <Image
          src={CARD_SRC}
          alt=""
          aria-hidden="true"
          fill
          sizes="(max-width: 480px) 100vw, 480px"
          draggable={false}
          className="pointer-events-none select-none"
        />
        <div className="absolute inset-0 flex items-center gap-1" style={{ paddingLeft: "37%", paddingRight: "8%" }}>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p
              className="truncate text-sm font-bold text-ink"
              style={{ marginLeft: "11%", transform: "translate(calc(10px + 3em), calc(-4px - 0.3em))" }}
            >
              {summary}
            </p>
            <div className="flex flex-col" style={{ gap: 6, transform: "translate(-1.5em, 3px)" }}>
              {Array.from({ length: 3 }).map((_, rowIndex) => {
                const notice = latest[rowIndex];
                if (notice) {
                  return (
                    <div key={notice.id} className="flex min-w-0 items-baseline gap-0.5 text-xs text-ink-soft">
                      <span className="shrink-0">・</span>
                      <MarqueeText text={notice.title} className="min-w-0 flex-1" />
                    </div>
                  );
                }
                // お知らせが3件無い時も高さが変わらないように、見えないダミー行で埋める。
                return rowIndex === 0 ? (
                  <p key={rowIndex} className="truncate text-xs text-ink-faint">
                    ・まだお知らせはありません
                  </p>
                ) : (
                  <p key={rowIndex} aria-hidden="true" className="truncate text-xs invisible">
                    ・
                  </p>
                );
              })}
            </div>
          </div>
          <IconChevronRight
            size={18}
            className="shrink-0 text-ink-faint"
            style={{ transform: "translate(-2em, 12px)" }}
          />
        </div>
      </div>
    </Link>
  );
}
