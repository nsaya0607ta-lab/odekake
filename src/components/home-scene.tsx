/**
 * ホーム上部のヒーローカードの背景。いただいた一枚絵をそのまま敷いている。
 *
 * 絵の中に木の看板が2枚描かれていて、おでかけレベルと歩数はその板の上に文字だけを
 * 重ねる（level-tag.tsx / steps-tag.tsx）。だから絵と文字の位置関係が絶対にずれては
 * いけない。ずらさないために、絵は「カードいっぱい」ではなく縦横比を保った箱
 * （SCENE_RATIO）に入れて左端を揃え、看板の位置はすべてその箱に対する％で持つ。
 * object-cover でカードに合わせると、端末幅ごとに絵の拡大率と切れる位置が変わって
 * 板と文字がずれる。
 *
 * 絵はカードより横長なので、はみ出した右側はカードの overflow-hidden で切れる。
 * 板が左端にあるぶん、犬は右の空いた芝を歩く（wandering-frenchie.tsx の MIN_X/MAX_X）。
 */

/** public/characters/home-scene.webp の実ピクセル比（1440×768）。絶対に変えない。 */
export const SCENE_RATIO = "1440 / 768";

const SCENE_SRC = "/characters/home-scene.webp";

/**
 * 板の位置（絵の箱に対する％）。元画像 1717×916 上で実測した座標から出している。
 *
 * - 上の板: x 91〜515 / y 133〜367
 * - 下の板: x 92〜517 / y 395〜660
 */
export const LEVEL_BOARD = { left: "5.3%", top: "14.5%", width: "24.7%", height: "25.5%" } as const;
export const STEPS_BOARD = { left: "5.4%", top: "43.1%", width: "24.8%", height: "28.9%" } as const;

/**
 * 板の中の「リボン（見出し帯）」と「書ける面」。どちらも板の箱に対する％。
 * 元画像での座標は、リボンが上 x183〜452 / y155〜205、下 x168〜450 / y420〜478、
 * 書ける面が上 x125〜480 / y215〜338、下 x125〜490 / y490〜638。
 */
export const LEVEL_BANNER = { left: "22%", top: "9.4%", width: "58.5%", height: "21.4%" } as const;
export const LEVEL_PANEL = { left: "9.5%", top: "33.5%", width: "81%", height: "55%" } as const;
export const STEPS_BANNER = { left: "21%", top: "9.4%", width: "61%", height: "21.9%" } as const;
export const STEPS_PANEL = { left: "9%", top: "36.5%", width: "82%", height: "51%" } as const;

/**
 * 絵と、その上に載せる看板を入れる箱。
 * 看板（children）は必ずこの中に入れる。カード直下に置くと位置がずれる。
 */
export function HomeScene({ children }: { children?: React.ReactNode }) {
  return (
    <div className="absolute inset-y-0 left-0" style={{ aspectRatio: SCENE_RATIO }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={SCENE_SRC}
        alt=""
        aria-hidden="true"
        width={1440}
        height={768}
        fetchPriority="high"
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full select-none"
      />
      {children}
    </div>
  );
}
