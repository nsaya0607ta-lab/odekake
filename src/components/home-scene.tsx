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

import { HOME_SKIN_ART, type HomeSkinTheme } from "@/lib/home-skins";

/** public/characters/home-scene.webp の実ピクセル比（1440×768）。絶対に変えない。 */
export const SCENE_RATIO = "1440 / 768";

/**
 * 板の位置（絵の箱に対する％）。元画像 1717×916 上で実測した座標から出している。
 * 板の位置は絵がら（home-skins）ごとに少しちがうので、HomeScene が CSS 変数で渡し、ここはその変数を読む。
 *
 * いつもの：
 * - 上の板: x 91〜515 / y 133〜367、下の板: x 92〜517 / y 395〜660
 * - リボンが上 x183〜452 / y155〜205、下 x168〜450 / y420〜478
 * - 書ける面が上 x125〜480 / y215〜338、下 x125〜490 / y490〜638
 * 冬：
 * - 上の板: x 83〜515 / y 150〜370、下の板: x 85〜518 / y 425〜655
 * - リボン（帯のまん中）が上 x185〜415 / y172〜222、下 x195〜415 / y447〜497
 * 豪華：
 * - 上の板（リボン込み）: x 112〜585 / y 155〜370、下の板: x 112〜585 / y 405〜628
 * - リボン（帯のまん中）が上 x225〜470 / y162〜218、下 x225〜470 / y418〜478
 */
type Box = { left: string; top: string; width: string; height: string };
type SceneLayout = { levelBoard: Box; levelBanner: Box; levelPanel: Box; stepsBoard: Box; stepsBanner: Box; stepsPanel: Box };

const SCENE_LAYOUTS: Record<HomeSkinTheme, SceneLayout> = {
  default: {
    levelBoard: { left: "5.3%", top: "14.5%", width: "24.7%", height: "25.5%" },
    levelBanner: { left: "22%", top: "9.4%", width: "58.5%", height: "21.4%" },
    levelPanel: { left: "9.5%", top: "30.5%", width: "81%", height: "53%" },
    stepsBoard: { left: "5.4%", top: "43.1%", width: "24.8%", height: "28.9%" },
    stepsBanner: { left: "21%", top: "9.4%", width: "61%", height: "21.9%" },
    stepsPanel: { left: "9%", top: "36.5%", width: "82%", height: "51%" },
  },
  winter: {
    levelBoard: { left: "4.8%", top: "16.4%", width: "25.2%", height: "24%" },
    levelBanner: { left: "23.4%", top: "7.5%", width: "53%", height: "22.7%" },
    levelPanel: { left: "9.5%", top: "37%", width: "81%", height: "52%" },
    stepsBoard: { left: "5%", top: "46.4%", width: "25.2%", height: "25.1%" },
    stepsBanner: { left: "25.4%", top: "7.2%", width: "50.8%", height: "21.7%" },
    stepsPanel: { left: "9%", top: "36%", width: "82%", height: "54%" },
  },
  deluxe: {
    levelBoard: { left: "6.5%", top: "16.9%", width: "27.5%", height: "23.5%" },
    levelBanner: { left: "23.9%", top: "-1.5%", width: "51.8%", height: "26%" },
    levelPanel: { left: "10%", top: "33%", width: "80%", height: "58%" },
    stepsBoard: { left: "6.5%", top: "44.2%", width: "27.5%", height: "24.3%" },
    stepsBanner: { left: "23.9%", top: "1%", width: "51.8%", height: "26.9%" },
    stepsPanel: { left: "9%", top: "37%", width: "82%", height: "57%" },
  },
};

const LAYOUT_KEYS = ["levelBoard", "levelBanner", "levelPanel", "stepsBoard", "stepsBanner", "stepsPanel"] as const;

/** 絵がらの板の位置を、CSS 変数（--levelBoard-left など）にする */
function layoutVars(theme: HomeSkinTheme): React.CSSProperties {
  const layout = SCENE_LAYOUTS[theme];
  const vars: Record<string, string> = {};
  for (const key of LAYOUT_KEYS) for (const side of ["left", "top", "width", "height"] as const) vars[`--${key}-${side}`] = layout[key][side];
  return vars as React.CSSProperties;
}

const box = (key: (typeof LAYOUT_KEYS)[number]): Box => {
  const fallback = SCENE_LAYOUTS.default[key];
  return {
    left: `var(--${key}-left, ${fallback.left})`,
    top: `var(--${key}-top, ${fallback.top})`,
    width: `var(--${key}-width, ${fallback.width})`,
    height: `var(--${key}-height, ${fallback.height})`,
  };
};

export const LEVEL_BOARD = box("levelBoard");
export const STEPS_BOARD = box("stepsBoard");

/** 板の中の「リボン（見出し帯）」と「書ける面」。どちらも板の箱に対する％ */
export const LEVEL_BANNER = box("levelBanner");
export const LEVEL_PANEL = box("levelPanel");
export const STEPS_BANNER = box("stepsBanner");
export const STEPS_PANEL = box("stepsPanel");

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
 * 額縁はカードの外側へ少しはみ出す前提なので、親側では overflow を切らない。
 */
export function HomeScene({ children, skin = "default" }: { children?: React.ReactNode; skin?: HomeSkinTheme }) {
  return (
    <div className="absolute inset-0 overflow-visible" style={layoutVars(skin)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={HOME_SKIN_ART.scene[skin]}
        alt=""
        aria-hidden="true"
        width={1440}
        height={768}
        fetchPriority="high"
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full select-none rounded-[21px_19px_23px_18px]"
      />
      {children}
      {/* 額縁の内側の線が犬カード外周に重なるように拡大。外側の線・花・葉はカード外へ出して見せる。 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={HOME_SKIN_ART.sceneFrame[skin]}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="pointer-events-none absolute z-50 max-w-none select-none"
        style={{
          left: "-3.15%",
          top: "-30.82%",
          width: "107.64%",
          height: "167.87%",
        }}
      />
    </div>
  );
}
