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
 * ボール重量は規格上16lb（7.25kg）以下だが、実際に成人が使う球は
 * 一般的に6.3〜7.3kg程度に集中する（中間値の目安は約6.8kg＝約15lb）。
 * 7lb（3.175kg）は実際の平均よりかなり軽く、衝突時の質量比が
 * 実物とずれてしまうため、この代表値を採用する。
 */
export const GAME_BALL_MASS_KG = 6.8;

/**
 * Ji et al. (AIP Advances, 2025, DOI: 10.1063/5.0247761) の
 * 基準軌道で使われている40ftフラットオイルパターン。
 */
export const GAME_OIL_LENGTH_M = 40 * 0.3048;
/** 既存の軌道再現テストとの互換用エイリアス。 */
export const PAPER_REFERENCE_OIL_LENGTH_M = GAME_OIL_LENGTH_M;

/**
 * プレイヤーのスワイプから作るリリース初速レンジ。
 * 25〜40km/h（6.94〜11.11m/s）へ必ずクランプし、論文の基準投球
 * 8.0m/s（28.8km/h）もこの範囲に含める。
 */
export const GAME_MIN_BALL_SPEED_KMH = 25;
export const GAME_MAX_BALL_SPEED_KMH = 40;

/**
 * ピンが底縁を支点に倒れ始めるために必要な重心上昇を簡易モデル化。
 * 実際には摩擦・弾性・ピン形状が絡むため、計算値に安全係数を掛けてゲーム用閾値にする。
 *
 * ボール直撃は従来どおりある程度の速度を必要とする一方、
 * すでに動いているピンからの衝撃は実物では横倒し・滑走・回転が加わるため、
 * 2Dモデルでは連鎖側の閾値を低めにしてピンキャリーを補正する。
 */
const PIN_BASE_RADIUS_M = 0.0254;
export const GRAVITY_MPS2 = 9.80665;
const cogRiseM = Math.hypot(JB_PIN_COG_M, PIN_BASE_RADIUS_M) - JB_PIN_COG_M;
const idealTipSpeedMps = Math.sqrt(2 * GRAVITY_MPS2 * cogRiseM);
export const PIN_DIRECT_KNOCK_SPEED_MPS = idealTipSpeedMps * 1.55;
export const PIN_CHAIN_KNOCK_SPEED_MPS = idealTipSpeedMps * 1.45;

/**
 * ボール軌道（ドラッグ／フック）のモデル。
 * 出典: 2025年 AIP Advances掲載論文のボウリングボール転がり摩擦モデル。
 * 固定のドラッグ／フック係数ではなく、ボールとレーンの接触点における
 * 滑り速度（スリップベロシティ）とレーン摩擦係数から並進加速度を計算する。
 *
 *   slipX = vx - r・ωy
 *   slipY = vy + r・ωx
 *   slipSpeed = √(slipX² + slipY²)
 *   ax = -μ・g・slipX / slipSpeed
 *   ay = -μ・g・slipY / slipSpeed
 *
 * （x=レーン横方向, y=レーン奥行き方向, z=鉛直方向で、接触点オフセットを
 *  (0,0,-r)としたときの ω×offset から導出される標準的な接触点滑り速度式）
 *
 * 摩擦力は接触点でボールに力積を与えるだけでなく、その反作用として
 * 角速度（ω）にもトルクを与える。滑り速度が0に近づく＝ボールとレーンの
 * 相対速度が無くなる（pure rolling）まで、並進と回転を同時に更新する。
 *
 *   torqueX = m・r・ay,  torqueY = -m・r・ax
 *   alphaX = torqueX / Ix,  alphaY = torqueY / Iy
 *   ωx += alphaX・dt,  ωy += alphaY・dt
 *
 * Ix・Iy・Izは論文の基準ボール仕様（RG・Diff・IntDiff）から算出した慣性モーメント。
 * ωz（軸回転）はslipの式に寄与しないため、この論文の範囲では変化させず一定とする。
 */
/** 接触点計算に使うボール半径。論文の基準値そのもの。 */
export const BALL_SPIN_RADIUS_M = 0.1085;
/**
 * Ji et al. のシミュレーションで使われる代表的な動摩擦係数。
 * オイル面 μ=0.04、ドライ面 μ=0.20。
 */
export const OIL_FRICTION_MU = 0.04;
export const DRY_FRICTION_MU = 0.20;

/**
 * レーン奥行き方向（y）に沿った動摩擦係数のプロファイル。
 * 実際のオイルパターンはコンディショナーの塗布量がパターン全長で均一ではなく、
 * パターン終盤（研究では概ね最後の1/3）にかけて塗布量が減り摩擦係数が
 * 急激に高まる（2倍以上になる）ことが報告されている。
 * これを踏まえ、従来の「オイル終端で瞬時に0.04→0.20へ切り替わる階段関数」を、
 * 3区間の滑らかなカーブに置き換える。
 *
 *   1) 0 〜 OIL_RAMP_START_M（オイル長の2/3地点）: OIL_FRICTION_MUで一定
 *   2) OIL_RAMP_START_M 〜 OIL_RAMP_END_M: OIL_FRICTION_MUからDRY_FRICTION_MUへ
 *      スムーズステップ（3t²-2t³）で連続的に遷移
 *   3) OIL_RAMP_END_M以降: DRY_FRICTION_MUで一定
 *
 * OIL_RAMP_END_MはGAME_OIL_LENGTH_Mより少し先（1.5m）に置き、
 * 見た目上のオイル終端（OIL_END_Y表示）を跨いで遷移が続くようにすることで、
 * 描画上のオイル境界とボール挙動の急変が一致しないようにしている。
 */
const OIL_RAMP_START_M = GAME_OIL_LENGTH_M * (2 / 3);
const OIL_RAMP_END_M = GAME_OIL_LENGTH_M + 1.5;

export function laneFrictionMuAt(downLaneM: number): number {
  if (downLaneM <= OIL_RAMP_START_M) return OIL_FRICTION_MU;
  if (downLaneM >= OIL_RAMP_END_M) return DRY_FRICTION_MU;
  const t = (downLaneM - OIL_RAMP_START_M) / (OIL_RAMP_END_M - OIL_RAMP_START_M);
  const smoothT = t * t * (3 - 2 * t);
  return OIL_FRICTION_MU + (DRY_FRICTION_MU - OIL_FRICTION_MU) * smoothT;
}

/** 論文の基準投球条件（標準投球としてゲームの基準速度にも使う）。 */
export const GAME_REFERENCE_SPEED_MPS = 8.0;
export const BALL_RADIUS_OF_GYRATION_M = 0.0635; // RG
export const BALL_DIFFERENTIAL_M = 0.001; // Diff
export const BALL_INT_DIFFERENTIAL_M = 0; // IntDiff

/**
 * リリース時の初期ωは、論文の基準条件(-30,-30,+10 rad/s)を
 * 「416rpm相当の角速度ベクトルが、レーン面内で回転軸方位45°、
 * 面に対する軸の傾き13.3°を向いているときの成分」として再解釈し、
 * 軸の向き（axisRotation）から毎回組み立てる。
 *
 *   spinMagnitude = spinMagnitudeRadSAtSpeed(releaseSpeed)
 *   horizontalSpin = spinMagnitude * cos(axisTilt)
 *   omegaX = -horizontalSpin * cos(axisRotation)
 *   omegaY = -sign(curveNorm) * horizontalSpin * sin(axisRotation)
 *   omegaZ = spinMagnitude * sin(axisTilt)
 *
 * 論文基準の回転量416rpm・axisRotation=45°では(-30,-30,+10)にほぼ一致する。
 * ゲーム本番では投球速度に応じて275〜416rpmへ補間するため、8.0m/s時の
 * 回転量は基準ベクトルより小さい。curveNorm（プレイヤーのカーブ入力）は
 * axisRotationのみを決め、omegaYへ直接掛けることはしない。
 */
export const SPIN_MAGNITUDE_REF_RAD_S = Math.sqrt(30 * 30 + 30 * 30 + 10 * 10); // ≒43.589 rad/s ≒416rpm
export const SPIN_AXIS_TILT_DEG = 13.26;

/**
 * ゲーム本番の回転量（スピンの大きさ）。実際のボウラーのレブ数は
 * リリース速度に単純比例するわけではない（同じ速度でも手首の使い方で
 * レブ数は変わる）ため、論文の基準条件そのままの比例スケーリングではなく、
 * 一般的なレクリエーションボウラーのレブ数目安（約275rpm）から上級者・
 * 論文基準条件相当（約416rpm、SPIN_MAGNITUDE_REF_RAD_S参照）までを、
 * リリース速度レンジ（GAME_MIN/MAX_BALL_SPEED_KMH）と同じ正規化係数で
 * 線形補間する。
 */
export const GAME_MIN_SPIN_RPM = 275;
export const GAME_MAX_SPIN_RPM = 416;

export function spinMagnitudeRadSAtSpeed(speedMps: number): number {
  const speedKmh = speedMps * 3.6;
  const speedNorm = Math.min(1, Math.max(
    0,
    (speedKmh - GAME_MIN_BALL_SPEED_KMH) / (GAME_MAX_BALL_SPEED_KMH - GAME_MIN_BALL_SPEED_KMH),
  ));
  const rpm = GAME_MIN_SPIN_RPM + (GAME_MAX_SPIN_RPM - GAME_MIN_SPIN_RPM) * speedNorm;
  return rpm * (2 * Math.PI / 60);
}

/**
 * USBC Ball Motion Study のロボット投球条件（axis rotation 55°）を
 * カーブ入力の上限として採用する。
 */
export const MAX_AXIS_ROTATION_DEG = 55;
/**
 * curve入力（0〜1）からaxisRotationへの変換指数。
 * 入力感度は従来の0.8を維持し、小さなスワイプで急にカーブが強くならないようにする。
 * axisRotation = MAX_AXIS_ROTATION_DEG * curveInput^AXIS_ROTATION_INPUT_EXPONENT
 */
export const AXIS_ROTATION_INPUT_EXPONENT = 0.8;

/** 慣性モーメント（Ix = m(RG+Diff)^2, Iy = m・RG^2, Iz = m(RG+Diff+IntDiff)^2）。 */
export const BALL_INERTIA_X_KGM2 =
  GAME_BALL_MASS_KG * (BALL_RADIUS_OF_GYRATION_M + BALL_DIFFERENTIAL_M) ** 2;
export const BALL_INERTIA_Y_KGM2 = GAME_BALL_MASS_KG * BALL_RADIUS_OF_GYRATION_M ** 2;
export const BALL_INERTIA_Z_KGM2 =
  GAME_BALL_MASS_KG
  * (BALL_RADIUS_OF_GYRATION_M + BALL_DIFFERENTIAL_M + BALL_INT_DIFFERENTIAL_M) ** 2;

/** これ未満の滑り速度は pure rolling とみなし、動摩擦（クーロン摩擦）を止める。 */
export const SLIP_EPSILON_MPS = 0.02;

/**
 * 反発係数（公認規格値はないため実測・計測研究で報告される代表値を採用）。
 * ウレタン/樹脂系ボールが木材＋プラスチックコーティングのピンに当たる場合の
 * 反発係数はおよそ0.5前後と報告されており、ここではその値を採用する。
 * ピン同士はほぼ同じ材質のプラスチックコーティング面同士がぶつかるため、
 * ボール→ピンよりわずかに高い反発係数（0.6前後）とする。
 */
export const BALL_PIN_RESTITUTION = 0.5;
export const PIN_PIN_RESTITUTION = 0.6;

/**
 * 倒れたピンがデッキ上を少し滑って次のピンへ当たり続けられるようにする。
 * ピン同士の干渉を強めつつ、飛び回りすぎない範囲に抑える。
 */
export const PIN_FRICTION_PER_SEC = 1.85;
export const PIN_SETTLE_SPEED_MPS = 0.09;
