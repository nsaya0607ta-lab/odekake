import { REGULAR_ITEMS } from "@/lib/collection/items";

/**
 * わんこのおやつ道のバランス定数。
 *
 * ゲーム本体（snack-trail-preview.tsx）と説明書ページの両方から参照する。
 * ここを直せば、説明書の数値が古いままになることがない。
 */

/** 盤面に常に出ているアイテムの数 */
export const ITEMS_ON_BOARD = 3;
/** 罠を踏んだときの減点 */
export const HAZARD_PENALTY = 20;
/** 通常アイテムと金色アイテムの基礎点 */
export const NORMAL_POINT = 1;
export const GOLDEN_POINT = 5;
/** 経過プレイ時間がこの間隔(ms)を超えるたびに壁を1つ生成する */
export const WALL_SPAWN_INTERVAL_MS = 60_000;
/** 壁が出現する何ms前から予告点滅を表示するか */
export const WALL_WARNING_LEAD_MS = 3_000;
export const BOOST_INTERVAL = 5;
/** 壁ガードは1ゲームにつき最大2回まで発動できる */
export const MAX_WALL_GUARD_USES = 2;
/** コイン還元率。スコア×分子/分母(端数切り捨て)がコインになる。DB側(record_snack_trail_result)と揃えること */
export const COIN_SCORE_NUMERATOR = 2;
export const COIN_SCORE_DENOMINATOR = 3;
/** 出現しうるアイテムの種類数 */
export const PLAYABLE_ITEM_COUNT = REGULAR_ITEMS.filter((item) => Boolean(item.image)).length;
