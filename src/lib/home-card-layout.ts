/**
 * ホームのカードを、どの順番に並べても同じ間かくで並べるための計算
 * =============================================================
 * カードの絵（webp）は、紙のまわりに透明なふち（テープや花をはみ出させるための余白）が
 * 絵ごとにちがう量だけついている。これまでは「元の並び」に合わせてカードごとに決まった余白を
 * つけていたので、並べかえると間かくがばらばらになっていた。
 *
 * ここでは、絵の「紙そのもの」が絵の高さの何％から何％にあるか（実際の画像から測った値）を持っておき、
 * 1つ上のカードの紙の下端から、このカードの紙の上端までが CARD_GAP_PX になるように margin-top を出す。
 * カードの高さは画面の幅で変わるので、幅に対する％（margin の％は親の幅が基準）で計算する。
 */
import type { HomeCardId } from "@/lib/home-look";

/** カードの紙と紙のあいだ（px） */
export const CARD_GAP_PX = 14;

/** カードは左右に少しはみ出して置いている（左 9px・右 12px）。絵の幅は「親の幅 + 21px」 */
export const CARD_BLEED = { left: 9, right: 12 } as const;

type CardGeometry = {
  /** 表示するときの縦横比（幅 ÷ 高さ） */
  ratio: number;
  /** 紙の上端・下端が、絵の高さの何割のところにあるか（public/ の画像から測った値） */
  paperTop: number;
  paperBottom: number;
  /** 絵の幅が「親の幅 + 21px」よりせまいときの差（px）。ハイライトはスライドに左右 2px の内側余白がある */
  narrower?: number;
};

export const HOME_CARD_GEOMETRY: Record<HomeCardId, CardGeometry> = {
  // public/notice-card.webp（2172×724）：紙は 63〜673px
  notice: { ratio: 2172 / 724, paperTop: 63 / 724, paperBottom: 673 / 724 },
  // public/home-highlights-frame.webp（1536×1024）：紙は 33〜970px
  highlights: { ratio: 1536 / 1024, paperTop: 33 / 1024, paperBottom: 970 / 1024, narrower: 4 },
  // public/collection-card.webp（2172×724 を 2172×615 にのばして表示）：紙は 66〜668px
  collection: { ratio: 2172 / 615, paperTop: 66 / 724, paperBottom: 668 / 724 },
};

/**
 * 犬のカード（いちばん上）は、額縁の絵がカードの下へ はみ出している。
 * home-scene.tsx の額縁（top -30.82%・height 167.87%）と、home-scene-frame.webp の枠の下端（824/1024px）から、
 * カードの高さの約 4.3% ぶん下に枠がある。カードの縦横比は 1440 / 768
 */
const SCENE_RATIO = 1440 / 768;
const SCENE_FRAME_OVERHANG = -0.3082 + (824 / 1024) * 1.6787 - 1;

const n = (v: number) => v.toFixed(5);

/** 絵の幅（CSS の式） */
function artWidth(g: CardGeometry): string {
  return `(100% + ${CARD_BLEED.left + CARD_BLEED.right - (g.narrower ?? 0)}px)`;
}

/** そのカードの「絵の上の、紙より上の透明なところ」の高さ（CSS の式） */
function transparentAbove(id: HomeCardId): string {
  const g = HOME_CARD_GEOMETRY[id];
  return `${artWidth(g)} * ${n(g.paperTop / g.ratio)}`;
}

/** 1つ上のカードの「紙より下の透明なところ」の高さ（犬のカードは枠がはみ出すのでマイナス） */
function transparentBelow(prev: HomeCardId | "scene"): string {
  // 犬のカードは 1px の線（rough-card）の内側に絵があるので、絵の幅は 100% - 2px、枠のはみ出しは線の 1px ぶん少ない
  if (prev === "scene") return `((100% - 2px) * ${n(-SCENE_FRAME_OVERHANG / SCENE_RATIO)} + 1px)`;
  const g = HOME_CARD_GEOMETRY[prev];
  return `${artWidth(g)} * ${n((1 - g.paperBottom) / g.ratio)}`;
}

/** 1つ上が prev のときの、このカードの margin-top */
export function homeCardMarginTop(prev: HomeCardId | "scene", id: HomeCardId): string {
  return `calc(${CARD_GAP_PX}px - ${transparentBelow(prev)} - ${transparentAbove(id)})`;
}
