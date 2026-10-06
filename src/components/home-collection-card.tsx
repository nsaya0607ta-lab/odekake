import { CARD_BLEED } from "@/lib/home-card-layout";
import Image from "next/image";
import Link from "next/link";
import { IconChevronRight } from "@/components/icons";

/**
 * ホームの「図鑑を見る」カード。
 *
 * public/collection-card.webp は本と花の水彩イラストだけが描かれた透明背景の枠。
 * タイトル・件数・矢印はすべて文字として重ねる（絵に焼き込まれていないので、
 * 件数が変わっても絵を描き直す必要はない）。
 *
 * 本のイラストは絵の左 32.4%、花のイラストは右 89.8% から始まるので、
 * 文字はその間（左 37% 〜 右 12% を除いた範囲）に収める。
 *
 * 元絵の縦横比のままだとカードが縦に大きすぎるため、絵を縦だけ約15%圧縮して表示する。
 */
const CARD_RATIO = "2172 / 615";

const CARD_SRC = "/collection-card.webp";

export function HomeCollectionCard({
  collected,
  total,
}: {
  collected: number;
  total: number;
}) {
  return (
    <Link
      href="/collection"
      className="pressable relative block active:scale-[0.99]"
      style={{ marginLeft: -CARD_BLEED.left, marginRight: -CARD_BLEED.right }}
      aria-label={`図鑑を見る（${collected} / ${total}）`}
    >
      <div className="relative w-full" style={{ aspectRatio: CARD_RATIO }}>
        <Image
          src={CARD_SRC}
          alt=""
          aria-hidden="true"
          fill
          sizes="(max-width: 480px) 100vw, 480px"
          draggable={false}
          className="home-card-frame pointer-events-none select-none"
        />
        <div className="absolute inset-0 flex items-center" style={{ paddingLeft: "37%", paddingRight: "12%" }}>
          <div className="flex w-full min-w-0 items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-bold text-ink">図鑑を見る</p>
              {/* 集めた割合（バーと％） */}
              <div className="mt-1 flex items-center gap-1.5">
                <span className="block h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#EADFC8]">
                  <span className="home-shine block h-full rounded-full bg-[linear-gradient(90deg,#8CCB74,#5E8C4A)]" style={{ width: `${total > 0 ? Math.min(100, (collected / total) * 100) : 0}%` }} />
                </span>
                <span className="shrink-0 text-[10px] font-bold tabular-nums text-ink-faint">{total > 0 ? Math.floor((collected / total) * 100) : 0}%</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <span className="flex flex-col items-end leading-none">
                <span className="text-lg font-bold tabular-nums text-leaf-deep">{collected}</span>
                <span className="mt-0.5 text-[10px] font-bold tabular-nums text-ink-faint">/ {total}</span>
              </span>
              <IconChevronRight size={18} className="text-ink-faint" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
