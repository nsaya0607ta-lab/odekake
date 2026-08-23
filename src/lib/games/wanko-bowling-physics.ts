/**
 * わんこボウリングの物理スケール。
 * JAPAN BOWLING「ボウリング施設、設備及び競技用具の認証規格」の寸法・重量を基準にする。
 * 画面サイズに依存せず、衝突計算はメートル / 秒 / キログラムで行う。
 */

/** ファールラインから1番ピン中心まで 60ft。 */
export const JB_HEAD_PIN_DISTANCE_M = 18.288;
/** レーン本体幅の規格 41〜42in の中間値。 */
export const JB_LANE_WIDTH_M = (1.0414 + 1.0668) / 2;
/** レーン＋両ガター幅 60〜60.25in の中間値。 */
export const JB_TOTAL_WIDTH_M = (1.524 + 1.5303) / 2;
/** 片側ガター幅。 */
export const JB_GUTTER_WIDTH_M = (JB_TOTAL_WIDTH_M - JB_LANE_WIDTH_M) / 2;

/** ピン中心間隔 12in。 */
export const JB_PIN_SPACING_M = 0.3048;
/** ピン最大胴径 12.105cm。 */
export const JB_PIN_DIAMETER_M = 0.12105;
/** ピン重量 1.531〜1.645kg の中間値。 */
export const JB_PIN_MASS_KG = (1.531 + 1.645) / 2;
/** ピン重心 14.28〜15.08cm の中間値。 */
export const JB_PIN_COG_M = (0.1428 + 0.1508) / 2;
/** ピン高さ 38.085cm。 */
export const JB_PIN_HEIGHT_M = 0.38085;

/** ボール直径規格 21.59〜21.83cm の中間値。 */
export const JB_BALL_DIAMETER_M = (0.2159 + 0.2183) / 2;
/**
 * ボール重量は規格上16lb（7.25kg）以下。
 * 今回のゲーム設定では全ボールを7lb相当として統一する。
 */
export const GAME_BALL_MASS_KG = 7 * 0.45359237;

/** JAPAN BOWLING掲載の大会パターン例 42ft。ゲームの標準オイル長として採用。 */
export const GAME_OIL_LENGTH_M = 42 * 0.3048;

/**
 * スワイプ速度の差を体感できるゲーム用速度レンジ。
 * 規格値ではなく入力フィーリング用の近似値。
 */
export const GAME_MIN_BALL_SPEED_KMH = 13;
export const GAME_MAX_BALL_SPEED_KMH = 38;

/**
 * ピンが底縁を支点に倒れ始めるために必要な重心上昇を簡易モデル化。
 * 実際には摩擦・弾性・ピン形状が絡むため、計算値に安全係数を掛けてゲーム用閾値にする。
 *
 * ボール直撃は従来どおりある程度の速度を必要とする一方、
 * すでに動いているピンからの衝撃は実物では横倒し・滑走・回転が加わるため、
 * 2Dモデルでは連鎖側の閾値を低めにしてピンキャリーを補正する。
 */
const PIN_BASE_RADIUS_M = 0.0254;
const GRAVITY_MPS2 = 9.80665;
const cogRiseM = Math.hypot(JB_PIN_COG_M, PIN_BASE_RADIUS_M) - JB_PIN_COG_M;
const idealTipSpeedMps = Math.sqrt(2 * GRAVITY_MPS2 * cogRiseM);
export const PIN_DIRECT_KNOCK_SPEED_MPS = idealTipSpeedMps * 1.55;
export const PIN_CHAIN_KNOCK_SPEED_MPS = idealTipSpeedMps * 1.28;

/**
 * 公認42ftパターン例を土台にしたゲーム用フック近似。
 * 直球の微小ブレでは曲げず、カーブ入力が入った時はオイル上でも少し軌道が作られ、
 * ドライ部分に入ってからはっきりブレイクするようにする。
 */
export const OIL_HOOK_FACTOR = 0.22;
export const DRY_HOOK_FACTOR = 1.12;
/** 意図的なカーブスワイプが画面上でも分かる強さまで戻す。 */
export const BACKEND_HOOK_ACCEL_MPS2 = 1.85;

/**
 * 反発係数は公認規格値ではないゲーム用近似。
 * ボール→ピンは大きく跳ね返らせず、ピン→ピンは連鎖が途中で消えない程度に
 * エネルギーを残して2番・3番ピン以降へ衝撃を伝える。
 */
export const BALL_PIN_RESTITUTION = 0.2;
export const PIN_PIN_RESTITUTION = 0.58;

/**
 * 倒れたピンがデッキ上を少し滑って次のピンへ当たり続けられるようにする。
 * ピン同士の干渉を強めつつ、飛び回りすぎない範囲に抑える。
 */
export const PIN_FRICTION_PER_SEC = 1.85;
export const PIN_SETTLE_SPEED_MPS = 0.09;
