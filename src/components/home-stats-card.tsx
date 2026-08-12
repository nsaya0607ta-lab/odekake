/**
 * ホームの「都道府県 / 市区町村など / 訪問数」のカード。
 *
 * いただいた一枚絵（public/home-stats.webp）を切らずにそのまま出し、数だけを絵の中の
 * 「/ 47」の左に重ねる。分母（47・1894）とラベルと区切り線は絵に描かれているので、
 * 文字では出さない。だから絵と数の位置関係がずれてはいけない。
 *
 * カードの縦横比を絵と同じ CARD_RATIO に固定し、数の位置は絵に対する％で持つ。
 * object-cover で高さを決め打ちすると、端末幅ごとに絵の拡大率が変わって数がずれる。
 *
 * 絵の中の「47」「1894」は src/lib/geo の件数（47都道府県・1894市区町村）そのもの。
 * データ側の件数が変わったら、この絵も描き直す必要がある。
 */

/** public/home-stats.webp の実ピクセル比（1440×890）。絶対に変えない。 */
const CARD_RATIO = "1440 / 890";

const CARD_SRC = "/home-stats.webp";

/**
 * 数を置く位置。元画像 1596×986 上で焼き込み文字を実測した座標から出している。
 *
 * - 数字は元位置と前回の上寄せ位置のちょうど中間にする
 * - 「/」の左端: x 408 / 796 / 1284。数と「/」の間は、絵の中の「/ 47」と同じ 18px あける
 *
 * 3列とも「/ 分母」を絵の中で右へずらし（それぞれの破線の右端 x517 / x973 / x1366 に
 * 分母の右端をそろえた）、左側に数を書ける幅を広げてある。とくに訪問数は 220px あるので、
 * 10000回を超えて6桁になっても区切り線に当たらない。
 */
const VALUE_BOTTOM = "40.75%";
const VALUE_RIGHT = {
  prefectures: "75.6%",
  municipalities: "51.3%",
  visits: "20.7%",
} as const;

/**
 * 数の大きさ。絵の中の数字の高さ（47px / 幅1596px = 2.95%）に合わせる。
 * Yusei Magic は数字の高さが 0.68em なので、字は絵の幅の 4.33% になる。
 *
 * カードの幅は「画面幅 - 左右の余白32px」で、PageBody の max-w-lg により 480px で止まる。
 * vw を使っているのは、コンテナクエリ（cqw）に対応していない古い端末でも効かせるため。
 */
const VALUE_FONT_SIZE = "min(calc(4.33vw - 1.39px), 20.8px)";

/** 焼き込み文字と同じインクの色。 */
const VALUE_COLOR = "#3b260f";

export function HomeStatsCard({
  prefectures,
  prefectureTotal,
  municipalities,
  municipalityTotal,
  visits,
}: {
  prefectures: number;
  prefectureTotal: number;
  municipalities: number;
  municipalityTotal: number;
  visits: number;
}) {
  return (
    <section
      aria-label="訪れたところ"
      className="relative top-2"
      style={{ marginLeft: "-3.15%", marginRight: "-2.245%" }}
    >
      <div className="relative" style={{ aspectRatio: CARD_RATIO }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={CARD_SRC}
          alt=""
          aria-hidden="true"
          width={1440}
          height={890}
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full select-none"
        />
        <StatValue value={prefectures} right={VALUE_RIGHT.prefectures} />
        <StatValue value={municipalities} right={VALUE_RIGHT.municipalities} />
        <StatValue value={visits} right={VALUE_RIGHT.visits} />
      </div>
      {/* 分母もラベルも絵の中の文字なので、読み上げ用に文字でも持っておく */}
      <p className="sr-only">
        都道府県 {prefectures} / {prefectureTotal}、市区町村など {municipalities} / {municipalityTotal}、訪問数{" "}
        {visits} 回
      </p>
    </section>
  );
}

function StatValue({ value, right }: { value: number; right: string }) {
  return (
    <span
      aria-hidden="true"
      className="absolute leading-none whitespace-nowrap tabular-nums"
      style={{
        right,
        bottom: VALUE_BOTTOM,
        fontSize: VALUE_FONT_SIZE,
        color: VALUE_COLOR,
        // line-height:1 の箱の下端と、字の下端のずれ（Yusei Magic のディセンダ分）を戻す
        transform: "translateY(0.175em)",
      }}
    >
      {value}
    </span>
  );
}
