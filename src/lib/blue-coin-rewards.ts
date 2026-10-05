/**
 * 青コインがもらえるもの（家具・背景・都道府県ガチャに使う）。
 * 数は DB と同じにする：おさんぽフレンチーは 0111、はじめての場所と7日連続ログインは 0125。
 */

/** はじめての市区町村を登録したとき */
export const BLUE_FIRST_MUNICIPALITY = 100;
/** はじめての都道府県を登録したとき */
export const BLUE_FIRST_PREFECTURE = 600;
/** ログインボーナスの7日目（7日連続で開いた日） */
export const BLUE_LOGIN_STREAK = 400;
/** おさんぽフレンチーの毎日のミッション（1つあたり）と、3つ全部のボーナス */
export const BLUE_OSANPO_MISSION = 30;
export const BLUE_OSANPO_MISSION_ALL = 100;
/** おさんぽフレンチーの協力チャレンジ（週に1回） */
export const BLUE_OSANPO_COOP = 100;

/** お店のコインの帯に出す、ためかたの短い説明 */
export const BLUE_COIN_SOURCES_SHORT = "青コインは「おさんぽフレンチー」・はじめての市区町村や都道府県の登録・7日連続ログインでもらえます。";
