/**
 * ホーム上部のヒーローカードの背景。いただいた一枚絵を、切らずに全部そのまま出す。
 *
 * 絵の中に木の看板が2枚描かれていて、おでかけレベルと歩数はその板の上に文字だけを
 * 重ねる（level-tag.tsx / steps-tag.tsx）。だから絵と文字の位置関係が絶対にずれては
 * いけない。カードの縦横比を絵と同じ SCENE_RATIO に固定して絵をぴったり収め、看板の
 * 位置はすべてカードに対する％で持つ。object-cover で高さを決め打ちすると、端末幅
 * ごとに絵の拡大率と切れる位置が変わって板と文字がずれる。
 *
 * 絵が横長なぶんカードは薄く、板もそのぶん小さい。文字が潰れないよう、板に載せる
 * 文字は画面幅に追従させている（SIGN_TEXT）。板の面には限りがあるので、行を足すのは
 * 必ず実機の幅で確かめてから。
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
export const LEVEL_PANEL = { left: "9.5%", top: "30.5%", width: "81%", height: "53%" } as const;
export const STEPS_BANNER = { left: "21%", top: "9.4%", width: "61%", height: "21.9%" } as const;
export const STEPS_PANEL = { left: "9%", top: "36.5%", width: "82%", height: "51%" } as const;

/**
 * 板に載せる文字の大きさ。
 *
 * カードは幅いっぱい（最大 480px）に対して縦横比が固定なので、板の大きさは画面幅で
 * 決まる。文字だけ px で固定すると、狭い端末では板からはみ出し、広い端末では板の中で
 * 迷子になる。だから画面幅に追従させて、上限と下限だけ clamp で止めている。
 * vw を使っているのは、コンテナクエリ（cqw）に対応していない古い端末でも効かせるため。
 */
export const SIGN_TEXT = {
  /** リボンの見出し */
  banner: "clamp(4.5px, 1.35vw, 7px)",
  /** 「Lv.」「歩」などの添え字 */
  unit: "clamp(4.5px, 1.4vw, 7.5px)",
  /** レベルの数字 */
  level: "clamp(9px, 2.9vw, 15px)",
  /** 歩数の数字 */
  steps: "clamp(10px, 3.2vw, 16.5px)",
  /** EXP・注記 */
  small: "clamp(4px, 1.35vw, 6.5px)",
} as const;

/**
 * 絵と、その上に載せる看板を入れる箱。カードの縦横比は必ず SCENE_RATIO にする。
 * 看板（children）は必ずこの中に入れる。カード直下に置くと位置がずれる。
 */
export function HomeScene({ children }: { children?: React.ReactNode }) {
  return (
    <div className="absolute inset-0">
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
