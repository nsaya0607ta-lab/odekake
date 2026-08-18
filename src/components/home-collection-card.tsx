import Link from "next/link";

/**
 * ホームの「図鑑を見る」カード。
 *
 * いただいた一枚絵（public/collection-card.webp）をそのまま出し、数だけを絵の中の
 * 「0 / 23」があった位置に重ねる。もとの絵に焼き込まれていた数字は消してあるので、
 * 分子（集めた数）も分母（アイテム総数）もここでは文字として出す。どちらも今後
 * 変わる値なので、絵に焼き込まず数だけをこの位置に乗せている。
 *
 * カードの縦横比を絵と同じ CARD_RATIO に固定し、数の位置は絵に対する％で持つ。
 */
const CARD_RATIO = "1440 / 416";

const CARD_SRC = "/collection-card.webp";

/**
 * 数を置く位置。元絵 1800×520 上で、焼き込まれていた「0 / 23」を実測した座標から出している。
 *
 * - 数字の下端: y 355 → 下から 31.7%
 * - 「0」の左端: x 1284 → 71.3%（左そろえ。桁が増えても右の矢印までは十分あく）
 */
const VALUE_BOTTOM = "31.7%";
const VALUE_LEFT = "71.3%";

/**
 * 数の大きさ。絵の中にあった数字の高さ（47px / 幅1800px = 2.61%）に合わせる。
 * Yusei Magic は数字の高さが 0.68em なので、字は絵の幅の 3.84% になる。
 *
 * カードの幅は「画面幅 - 左右の余白32px」で、PageBody の max-w-lg により 480px で止まる。
 */
const VALUE_FONT_SIZE = "min(calc(3.84vw - 1.23px), 18.4px)";

/** 焼き込まれていた数字と同じインクの色。 */
const VALUE_COLOR = "#6f7752";

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
      className="pressable relative block w-full active:scale-[0.99]"
      style={{ top: 12 }}
      aria-label={`図鑑を見る（${collected} / ${total}）`}
    >
      <div className="relative w-full" style={{ aspectRatio: CARD_RATIO }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={CARD_SRC}
          alt=""
          aria-hidden="true"
          width={1440}
          height={416}
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full select-none"
        />
        <span
          aria-hidden="true"
          className="absolute leading-none whitespace-nowrap tabular-nums"
          style={{
            left: VALUE_LEFT,
            bottom: VALUE_BOTTOM,
            fontSize: VALUE_FONT_SIZE,
            color: VALUE_COLOR,
            transform: "translateY(0.175em)",
          }}
        >
          {collected} / {total}
        </span>
      </div>
    </Link>
  );
}
