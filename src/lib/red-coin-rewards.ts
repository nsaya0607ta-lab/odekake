/**
 * 赤コインがもらえるもの（ご当地ピンボールの、自分で作るステージの部品に使う）。
 * もらえるのは、ご当地ピンボールのスコア・ホームに降ってくる赤コイン・ログインだけ。数は DB と同じにする（0140。2026-10-09 にどれも2.5倍）。
 * ご当地ピンボールの枚数は src/lib/games/pinball/config.ts（COIN_POINTS・COIN_MAX）、
 * ホームに降る赤コインの枚数は黄色・青の2.5倍（components/guide/guide-data.ts の HOME_DROP の redAmount）。
 */

/** ログインした日に1回（1日1回） */
export const RED_LOGIN_COINS = 125;

/** ためかたの短い説明 */
export const RED_COIN_SOURCES_SHORT = "赤コインは「ご当地ピンボール」・ホームに降ってくる赤コイン・毎日のログインでもらえます。";
