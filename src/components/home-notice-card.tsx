import { CARD_BLEED } from "@/lib/home-card-layout";
import { HOME_SKIN_ART, type HomeSkinTheme } from "@/lib/home-skins";
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

/**
 * 見出し（新着◯件）の位置。絵に描いてある「お知らせ」の札の右どなりに置く。
 * 冬の絵は紙のふちに木のわくがあるので、わくにかからないよう少し下げる。
 */
const HEADING_SHIFT: Record<HomeSkinTheme, string> = {
  default: "translate(calc(10px + 3em), calc(-4px - 0.3em))",
  winter: "translate(calc(14px + 3em), calc(5px - 0.3em))",
};

export function HomeNoticeCard({
  unreadCount,
  notices,
  skin = "default",
}: {
  /** カードの絵がら（ショップで買ったもの） */
  skin?: HomeSkinTheme;
  /** 直近24時間に作成された、自分がまだ読んでいないお知らせの件数 */
  unreadCount: number;
  /** 新しい順の最新お知らせ（先頭3件を表示） */
  notices: NoticeFeedRow[];
}) {
  const latest = notices.slice(0, 3);
  const summary = unreadCount > 0 ? `新着情報が${unreadCount}件あります` : "すべて既読済み";

  return (
    <div className="relative block" style={{ marginLeft: -CARD_BLEED.left, marginRight: -CARD_BLEED.right }}>
      <div className="relative w-full" style={{ aspectRatio: CARD_RATIO }}>
        {/* カード全体（タイトル以外の場所）は、お知らせ一覧へ。タイトルはそれぞれのお知らせへ */}
        <Link href="/notices" aria-label={`お知らせ一覧。${summary}`} className="pressable absolute inset-0 z-0 block active:scale-[0.99]" />
        <Image
          src={HOME_SKIN_ART.notice[skin]}
          alt=""
          aria-hidden="true"
          fill
          sizes="(max-width: 480px) 100vw, 480px"
          draggable={false}
          className="home-card-frame pointer-events-none select-none"
        />
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center gap-1" style={{ paddingLeft: "37%", paddingRight: "8%" }}>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {/* 見出し（新着の数）。右の花の絵にかからないよう短く、数はバッジで目立たせる */}
            <p
              className="flex items-center gap-1 text-sm font-bold text-ink"
              style={{ marginLeft: "11%", transform: HEADING_SHIFT[skin] }}
              aria-hidden="true"
            >
              {unreadCount > 0 ? (
                <>
                  新着
                  <span className="home-badge-pulse rounded-full bg-[#E8604A] px-1.5 py-px text-[11px] font-black leading-tight text-white tabular-nums">{unreadCount}</span>
                  件
                </>
              ) : (
                <span className="text-ink-faint">すべて既読</span>
              )}
            </p>
            {/* 右の矢印と重ならないよう、行の右はしを矢印のぶん手前で止める */}
            <div className="flex flex-col" style={{ gap: 6, transform: "translate(-1.5em, 3px)", marginRight: "0.8em" }}>
              {Array.from({ length: 3 }).map((_, rowIndex) => {
                const notice = latest[rowIndex];
                if (notice) {
                  return (
                    <Link
                      key={notice.id}
                      href={`/notices/${notice.id}`}
                      aria-label={`${notice.is_read ? "" : "未読 "}${notice.title}`}
                      className={`pointer-events-auto -my-0.5 flex min-w-0 items-center gap-1.5 rounded-md py-0.5 text-xs active:bg-white/60 ${notice.is_read ? "text-ink-faint" : "font-bold text-ink-soft"}`}
                    >
                      {/* まだ読んでいないものは色つきの点 */}
                      <span aria-hidden="true" className={`block h-1.5 w-1.5 shrink-0 rounded-full ${notice.is_read ? "bg-line-strong" : "bg-[#E8604A]"}`} />
                      <MarqueeText text={notice.title} className="min-w-0 flex-1" />
                    </Link>
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
    </div>
  );
}
