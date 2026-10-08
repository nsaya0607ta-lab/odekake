/**
 * 青コインがもらえるもの（家具・背景・都道府県ガチャに使う）。
 * 数は DB と同じにする：おさんぽフレンチーは 0111、はじめての場所と通算ログインは 0125。
 * ご当地ピンボールの青コインは src/lib/games/pinball/config.ts（COIN_POINTS・COIN_MAX）と 0136。
 */

/** はじめての市区町村を登録したとき */
export const BLUE_FIRST_MUNICIPALITY = 100;
/** はじめての都道府県を登録したとき */
export const BLUE_FIRST_PREFECTURE = 600;
/** 通算ログイン日数（1日目から数えた合計。休んでもへらない）が7の倍数になった日 */
export const BLUE_LOGIN_TOTAL = 400;
export const BLUE_LOGIN_TOTAL_EVERY = 7;
/** おさんぽフレンチーの毎日のミッション（1つあたり）と、3つ全部のボーナス */
export const BLUE_OSANPO_MISSION = 30;
export const BLUE_OSANPO_MISSION_ALL = 100;
/** おさんぽフレンチーの協力チャレンジ（週に1回） */
export const BLUE_OSANPO_COOP = 100;

/** お店のコインの帯に出す、ためかたの短い説明 */
export const BLUE_COIN_SOURCES_SHORT = "青コインは「おさんぽフレンチー」「ご当地ピンボール」・はじめての市区町村や都道府県の登録・通算7日ごとのログインでもらえます。";
