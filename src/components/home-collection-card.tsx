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
      style={{ marginLeft: -9, marginRight: -12, marginTop: -11 }}
      aria-label={`図鑑を見る（${collected} / ${total}）`}
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
        <div className="absolute inset-0 flex items-center" style={{ paddingLeft: "37%", paddingRight: "12%" }}>
          <div className="flex w-full min-w-0 items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-ink">図鑑を見る</p>
              <p className="whitespace-nowrap text-xs text-ink-faint">集めたアイテムを見る</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <span className="text-lg font-bold tabular-nums text-leaf-deep">
                {collected} / {total}
              </span>
              <IconChevronRight size={18} className="text-ink-faint" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
