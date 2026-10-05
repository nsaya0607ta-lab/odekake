/**
 * おさんぽフレンチー（ミニゲーム）の設定
 * =============================================================
 * 横スクロールで障害物をジャンプ・スライディングでかわしながら、
 * 自分が持っている図鑑アイテムを拾っていくゲーム。
 * ステージ・レアリティごとの点数・称号・BGMの譜面などをここにまとめる。
 * 描画と進行は src/components/games/osanpo-run/engine.ts。
 */
import type { GachaRarity } from "@/lib/gacha/config";
import type { DogSkinId } from "@/lib/dog-skins";

export const OSANPO_RUN_STAGE_IDS = ["town", "hiking", "snow", "summer"] as const;
export type OsanpoRunStageId = (typeof OSANPO_RUN_STAGE_IDS)[number];

export type OsanpoRunStage = {
  id: OsanpoRunStageId;
  name: string;
  /** ステージ選択に出す紹介文 */
  desc: string;
  /** 犬スキン。季節ステージはそのスキンを持っていると遊べる */
  skin: DogSkinId;
  skinName: string;
  /** スタート時刻（0時からの分） */
  clock: number;
  /** このステージで出やすくなる図鑑シリーズ */
  series: string | null;
  weather: "rain" | "snow";
};

export const OSANPO_RUN_STAGES: Record<OsanpoRunStageId, OsanpoRunStage> = {
  town: {
    id: "town",
    name: "まち",
    desc: "夕方5時20分、いつもの住宅街。電柱と自販機の並ぶ道を、日が暮れて星が出るまで。",
    skin: "default",
    skinName: "いつものフレブル",
    clock: 17 * 60 + 20,
    series: null,
    weather: "rain",
  },
  hiking: {
    id: "hiking",
    name: "山道",
    desc: "夜明け前の山道。朝日が昇るなか山頂を目指す。岩や倒木、低く張り出した枝に気をつけて。",
    skin: "hiking",
    skinName: "登山のフレブル",
    clock: 5 * 60 + 40,
    series: "hiking",
    weather: "rain",
  },
  snow: {
    id: "snow",
    name: "雪国",
    desc: "雪の降る午後の町。雪だるまやソリ、軒先のつららをかわしながら、凍った道を進む。",
    skin: "snow",
    skinName: "雪国のフレブル",
    clock: 15 * 60 + 10,
    series: "snow",
    weather: "snow",
  },
  summer: {
    id: "summer",
    name: "夏まつり",
    desc: "夏まつりの夕暮れ。屋台と提灯の参道を歩いていくと、夜には花火が上がる。",
    skin: "summer",
    skinName: "夏のフレブル",
    clock: 18 * 60 + 30,
    series: "summer",
    weather: "rain",
  },
};

export function isOsanpoRunStageId(value: unknown): value is OsanpoRunStageId {
  return typeof value === "string" && (OSANPO_RUN_STAGE_IDS as readonly string[]).includes(value);
}

/**
 * 歩数ブースト。アプリに同期した「今日の歩数」に応じて、スタート時に効果が付く（段階は積み重なる）。
 * 3000歩〜: 最初の STEP_BOOST_SEC 秒スコア×STEP_BOOST_MUL / 6000歩〜: バリア1回 / 10000歩〜: スタートでボーナスタイム
 */
export const OSANPO_RUN_STEP_BOOSTS = [
  { steps: 3000, label: "スコアアップ", desc: "最初の10秒、拾ったもののスコア×1.2" },
  { steps: 6000, label: "バリア", desc: "1回だけぶつかっても平気" },
  { steps: 10000, label: "ボーナスタイム", desc: "スタートからボーナスタイム" },
] as const;
export const STEP_BOOST_SEC = 10;
export const STEP_BOOST_MUL = 1.2;

/** 今日の歩数で届いている段階の数（0〜3） */
export function stepBoostLevel(steps: number | null): number {
  if (steps === null) return 0;
  return OSANPO_RUN_STEP_BOOSTS.filter((b) => steps >= b.steps).length;
}

/**
 * 分かれ道。ときどき道しるべが出て、通る瞬間に跳んでいれば上の道（calm）、地面にいれば下の道（risky）へ進む。
 * calm: 障害物が少なめ・ほねとアイテムが多め / risky: 障害物が多めだが、SR以上のアイテムが出やすい
 */
export type OsanpoRunRouteKind = "calm" | "risky";
export const OSANPO_RUN_ROUTE_SEC = 20;
export const OSANPO_RUN_ROUTES: Record<OsanpoRunStageId, Record<OsanpoRunRouteKind, string>> = {
  town: { calm: "公園", risky: "商店街" },
  hiking: { calm: "沢", risky: "尾根" },
  snow: { calm: "かまくら広場", risky: "温泉街" },
  summer: { calm: "河原", risky: "屋台通り" },
};
export const OSANPO_RUN_ROUTE_DESC: Record<OsanpoRunRouteKind, string> = {
  calm: "障害物が少なめで、ほねとアイテムが多い",
  risky: "障害物が多いけど、SR以上のアイテムが出やすい",
};

/**
 * 思い出の写真。自分のおでかけ写真を、空を横切る飛行機にぶら下げて運ぶ。
 * 縦長の写真は縦向き（横3:縦4）、横長・正方形の写真は横向き（横4:縦3）の枠に、
 * はみ出す分を中央で切って貼る。
 */
/** 写真が真上を通ったときのおまけ点 */
export const MEMORY_SIGN_PTS = 20;

/** 水たまりスタンプ：空中から急降下して水たまりに着地すると、水たまりが消えて点がもらえる */
export const PUDDLE_STOMP_PTS = 30;

/** においかぎ：くんくんマークの上をスライディングで通ると掘り出す。中身の重み */
export const SNIFF_REWARDS = [
  { kind: "bones", weight: 5 },
  { kind: "item", weight: 3.5 },
  { kind: "sock", weight: 1.5 },
] as const;
export type SniffRewardKind = (typeof SNIFF_REWARDS)[number]["kind"];

/**
 * ご近所さん：道で会うほかのフレブル9匹。名前は設定でつけられる（空なら defaultName）。
 * あいさつの回数でなかよし度が上がり、会ったときの反応とおまけが変わる。
 */
export const OSANPO_RUN_NEIGHBOR_DEFAULT_NAMES: Record<DogSkinId, string> = {
  default: "まる",
  hiking: "こてつ",
  snow: "ゆき",
  summer: "なつ",
  gifu: "ひだ",
  aichi: "しゃち",
  mie: "いせ",
  shizuoka: "ちゃちゃ",
  nagano: "りんご",
};
export const NEIGHBOR_NAME_MAX = 8;
export const NEIGHBOR_LEVELS = [
  { greets: 0, name: "はじめまして", pts: 30, gift: "none" },
  { greets: 5, name: "顔見知り", pts: 40, gift: "none" },
  { greets: 15, name: "なかよし", pts: 50, gift: "bones" },
  { greets: 30, name: "親友", pts: 60, gift: "item" },
] as const;
export function neighborLevel(greets: number): number {
  let lv = 0;
  NEIGHBOR_LEVELS.forEach((l, i) => { if (greets >= l.greets) lv = i; });
  return lv;
}

/**
 * 協力チャレンジ：自分とフレンドの今週の合計距離（m）で目標を目指す。
 * 目標は 1人あたり COOP_METERS_PER_MEMBER × 人数（COOP_GOAL_MIN〜COOP_GOAL_MAX）。達成で全員 COOP_COINS。
 * 同じ値を DB の get_osanpo_run_coop / claim_osanpo_run_coop でも使う。
 */
export const COOP_METERS_PER_MEMBER = 2000;
export const COOP_GOAL_MIN = 2000;
export const COOP_GOAL_MAX = 20000;
export const COOP_COINS = 100;

export type RarityStyle = {
  /** 1個あたりの点数（コンボ倍率がさらに掛かる） */
  points: number;
  /** 出現の重み */
  weight: number;
  color: string;
  /** 光のにじみの色（"r,g,b"）。N は光らせない */
  glow: string | null;
};

export const RARITY_STYLES: Record<GachaRarity, RarityStyle> = {
  N: { points: 10, weight: 44, color: "#D9D3EE", glow: null },
  R: { points: 20, weight: 28, color: "#7CC4FF", glow: "124,196,255" },
  SR: { points: 40, weight: 14, color: "#C79BFF", glow: "199,155,255" },
  SSR: { points: 80, weight: 8, color: "#FFC857", glow: "255,200,87" },
  UR: { points: 150, weight: 4, color: "#FF84BC", glow: "255,132,188" },
  LR: { points: 300, weight: 1.4, color: "#7EF0D0", glow: "126,240,208" },
  MR: { points: 500, weight: 0.6, color: "#FFFFFF", glow: "255,255,255" },
};

/** LR・MR を拾うと、一度だけ衝突を防ぐバリアが付く */
export function isBarrierRarity(rarity: GachaRarity): boolean {
  return rarity === "LR" || rarity === "MR";
}

export type OsanpoRunAchievement = { id: string; name: string; condition: string };

export const OSANPO_RUN_ACHIEVEMENTS: readonly OsanpoRunAchievement[] = [
  { id: "first", name: "はじめの一歩", condition: "はじめてのおさんぽを終える" },
  { id: "m100", name: "ご近所さんぽ", condition: "1回で100m歩く" },
  { id: "m500", name: "ちょっと遠出", condition: "1回で500m歩く" },
  { id: "m1000", name: "健脚フレブル", condition: "1回で1000m歩く" },
  { id: "rain", name: "雨にも負けず", condition: "雨か雪の中を20秒歩く" },
  { id: "night", name: "夜ふかし散歩", condition: "夜9時を過ぎても歩き続ける" },
  { id: "rush", name: "ラッシュ突破", condition: "ラッシュを乗り切る" },
  { id: "rush3", name: "ラッシュの鬼", condition: "1回で3回ラッシュを乗り切る" },
  { id: "bonus15", name: "ボーナスハンター", condition: "1回のボーナスタイムで15個拾う" },
  { id: "combo5", name: "コンボ職人", condition: "×5コンボを出す" },
  { id: "close5", name: "ギリギリの達人", condition: "1回で「ギリギリ！」を5回出す" },
  { id: "pigeon10", name: "ハトとなかよし", condition: "ハトを飛び立たせる（累計10回）" },
  { id: "slide10", name: "スライディング名人", condition: "スライディングでくぐる（累計10回）" },
  { id: "barrier", name: "おまもり効果", condition: "バリアで助かる" },
  { id: "mr", name: "幻の一品", condition: "MRのアイテムを拾う" },
  { id: "kinds50", name: "コレクター", condition: "アイテムを50種類拾う（累計）" },
  { id: "kindsAll", name: "ぜんぶ拾った", condition: "持っているアイテムをすべて拾う（累計）" },
  { id: "hiking", name: "山道マスター", condition: "山道で300m歩く" },
  { id: "snow", name: "雪国マスター", condition: "雪国で300m歩く" },
  { id: "summer", name: "夏まつりマスター", condition: "夏まつりで300m歩く" },
  // ---- ひとクセある仕掛け。接触してスキルで助かった場合は回避に数えない ----
  { id: "suitcaseFirst", name: "手荷物はお預け", condition: "大脱走スーツケースをぶつからずにかわす" },
  { id: "suitcaseUnder", name: "手荷物の下を失礼します", condition: "浮いたスーツケースの下を地面にいたまま通り抜ける" },
  { id: "suitcaseJumps5", name: "荷物より身軽", condition: "スーツケースを跳び越える（累計5回・接触なし）" },
  { id: "surpriseFirst", name: "置き配、飛び出し注意", condition: "びっくり宅配便をぶつからずにかわす" },
  { id: "openBoxes5", name: "開封の儀は空中で", condition: "カエルが飛び出しきった宅配箱を跳び越える（累計5回・接触なし）" },
  { id: "droneFirst", name: "配達員さん、頭上です", condition: "配達ドローンをぶつからずにかわす" },
  { id: "droneSlides10", name: "低姿勢のVIP", condition: "ドローンの下をスライディングでくぐる（累計10回・接触なし）" },
  { id: "trickTrio", name: "本日の散歩、情報量多め", condition: "1回のおさんぽでスーツケース・宅配箱・ドローンをすべて接触せずにかわす" },
  { id: "trickStreak6", name: "町内スタント担当", condition: "途中でどの障害物にもぶつからず、新しい3種類の仕掛けを合計6回かわす" },
  { id: "trickTour", name: "全国トラブル行脚", condition: "4つのステージそれぞれで、1回のおさんぽ中に新しい3種類すべてを接触せずにかわす" },
  // ---- 追加した障害物・スキルの称号 ----
  { id: "roller10", name: "おそうじロボの天敵", condition: "転がってくるものを跳び越える（累計10回）" },
  { id: "drop10", name: "頭上注意", condition: "上から落ちてくるものをよける（累計10回）" },
  { id: "greet20", name: "ごあいさつ上手", condition: "ほかのフレブルにあいさつする（累計20回）" },
  { id: "geyser10", name: "びしょぬれ回避", condition: "水が出ているところを通り抜ける（累計10回）" },
  { id: "bones100", name: "ほね職人", condition: "1回でほねを100本拾う" },
  { id: "skills10", name: "スキルマニア", condition: "1回で10種類のスキルを発動させる" },
  { id: "knock10", name: "ブルドーザー", condition: "1回で無敵中に障害物を10個吹っ飛ばす" },
  { id: "rare3", name: "引きが強い", condition: "1回でUR以上のアイテムを3個拾う" },
  { id: "survive180", name: "3分間のおさんぽ", condition: "1回で3分間歩き続ける" },
  { id: "quick", name: "おさんぽ終了のおしらせ", condition: "歩き出して5秒以内にぶつかる" },
  { id: "kiriban", name: "キリ番ゲッター", condition: "スコアがちょうど100の倍数で帰る" },
  { id: "dawn", name: "朝帰り", condition: "朝の5時まで歩き続ける" },
];

/** 結果画面のひとこと。スコアがしきい値以上の中で一番大きいものを出す */
export const OSANPO_RUN_COMMENTS: readonly (readonly [number, string])[] = [
  [0, "電柱ひとつ分でもう満足した顔をしている。"],
  [200, "まだ帰りたくなくて、玄関の前で踏ん張っている。"],
  [600, "いい散歩だった。短いしっぽがちぎれそうなくらい揺れている。"],
  [1200, "近所のカラスに顔を覚えられた。"],
  [2200, "拾ったアイテムで小屋がいっぱい。図鑑コンプの顔をしている。"],
  [3500, "町内でいちばん健脚なフレブル。帰ったら即、へそ天でいびき。"],
];

export const OSANPO_RUN_RANKS: readonly { min: number; label: string; color: string }[] = [
  { min: 35000, label: "SS", color: "#FF84BC" },
  { min: 20000, label: "S", color: "#FFC857" },
  { min: 10000, label: "A", color: "#7EF0D0" },
  { min: 5000, label: "B", color: "#7CC4FF" },
  { min: 0, label: "C", color: "#ABA5CF" },
];

export const OSANPO_RUN_HINTS = {
  jump: "タップでジャンプ！ 長押しで高く",
  dj: "空中でタップで2段・3段ジャンプ",
  crow: "カラスは跳ばずに、下をくぐろう",
  cat: "猫はこっちに歩いてくる。早めに跳ぼう",
  slide: "下スワイプでスライディング！",
  roller: "こっちに転がってくる。早めに跳ぼう",
  drop: "地面に影！ 上から何か落ちてくる",
  buddy: "ほかのフレブルはぶつかってもOK。ごあいさつすると点がもらえる",
  geyser: "水が止まった瞬間に通るか、2段ジャンプで越えよう",
  suitcase: "荷物がバウンド！ 低いときは跳び越え、高いときは下を通ろう",
  surprise: "箱がガタガタしたら飛び出す合図。2段ジャンプで高く越えよう！",
  drone: "ランプが点滅したら降下！ 下スワイプで荷物の下をくぐろう",
  stomp: "水たまりは、空中から下スワイプの急降下で踏むと バシャーン！",
  sniff: "くんくんマーク！ スライディングで通ると何か掘り出せる",
} as const;
export type OsanpoRunHintId = keyof typeof OSANPO_RUN_HINTS;

export type Song = {
  bpm: number;
  lead: OscillatorType;
  level: number;
  kit: "pop" | "folk" | "bell" | "matsuri";
  roots: readonly [number, number, number, number];
  /** 16分音符×64ステップのメロディ（MIDIノート番号。0は休符） */
  melody: readonly number[];
};

export const OSANPO_RUN_SONGS: Record<OsanpoRunStageId, Song> = {
  town: {
    bpm: 120, lead: "square", level: 0.035, kit: "pop", roots: [48, 45, 41, 43],
    melody: [
      72, 0, 76, 0, 79, 0, 76, 0, 81, 0, 79, 0, 76, 0, 74, 0, 76, 0, 72, 0, 69, 0, 72, 0, 76, 0, 74, 0, 72, 0, 0, 0,
      69, 0, 72, 0, 77, 0, 76, 0, 74, 0, 72, 0, 69, 0, 72, 0, 74, 0, 79, 0, 77, 0, 76, 0, 74, 0, 71, 0, 74, 0, 0, 0,
    ],
  },
  hiking: {
    bpm: 112, lead: "triangle", level: 0.075, kit: "folk", roots: [43, 48, 50, 43],
    melody: [
      67, 0, 71, 0, 74, 0, 71, 0, 72, 0, 71, 0, 69, 0, 67, 0, 64, 0, 67, 0, 72, 0, 71, 0, 69, 0, 67, 0, 64, 0, 0, 0,
      66, 0, 69, 0, 74, 0, 72, 0, 71, 0, 69, 0, 66, 0, 69, 0, 71, 0, 74, 0, 79, 0, 76, 0, 74, 0, 71, 0, 67, 0, 0, 0,
    ],
  },
  snow: {
    bpm: 92, lead: "sine", level: 0.07, kit: "bell", roots: [45, 41, 48, 43],
    melody: [
      76, 0, 0, 0, 72, 0, 69, 0, 72, 0, 76, 0, 81, 0, 0, 0, 77, 0, 0, 0, 76, 0, 72, 0, 69, 0, 72, 0, 77, 0, 0, 0,
      76, 0, 0, 0, 79, 0, 76, 0, 72, 0, 74, 0, 76, 0, 0, 0, 74, 0, 0, 0, 71, 0, 67, 0, 71, 0, 74, 0, 79, 0, 0, 0,
    ],
  },
  summer: {
    bpm: 124, lead: "triangle", level: 0.07, kit: "matsuri", roots: [50, 43, 45, 50],
    melody: [
      74, 0, 74, 76, 79, 0, 76, 0, 74, 0, 71, 0, 74, 0, 0, 0, 79, 0, 79, 81, 83, 0, 81, 0, 79, 0, 76, 0, 74, 0, 0, 0,
      76, 0, 79, 0, 81, 0, 79, 76, 74, 0, 76, 0, 71, 0, 69, 0, 71, 0, 74, 0, 76, 0, 79, 0, 76, 0, 74, 0, 74, 0, 0, 0,
    ],
  },
};

/** localStorage のキー接頭辞。記録はこの端末にだけ保存する */
export const OSANPO_RUN_STORAGE_PREFIX = "odekake:osanpo-run:";
