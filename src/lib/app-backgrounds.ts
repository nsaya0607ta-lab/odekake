/**
 * アプリの背景（ショップで青コインで買って、アプリ全体の背景にする）
 * =============================================================
 * - 柄・風景の背景は src/app/app-backgrounds.css の `.app-bg[data-bg="..."]` に書いてある
 * - 動く・変わる背景（live: true）は src/components/live-backgrounds/ が描く（CSS は下地の色だけ）
 * - 値段は DB の app_background_price（0122・0123）と同じにする
 * - 選んでいる背景はCookieを正として読む（犬スキンと同じ。画面遷移のたびにDBへ問い合わせないため）
 */
import type { SkyPhase } from "@/lib/home-weather";
import type { WeatherKind } from "@/lib/room/weather";

export const APP_BACKGROUND_IDS = [
  "default",
  "paw",
  "washi",
  "watercolor",
  "autumn",
  "map",
  "scenery",
  "starry",
  "aurora",
  "sky-clock",
  "paw-trail",
  "bubbles",
  "jelly",
  "goldfish",
  "aurora-night",
  "weather",
  "garden",
  "seasons",
  "fireworks",
  "paper-planes",
  "cloud-sea",
  "dog-parade",
  "mesh",
  "holo",
  "glass",
  "sumi",
  "balloons",
  "local-train",
  "zen-sand",
  "fireflies",
  "paint-bloom",
  "marbles",
  "snow-globe",
  "my-map",
  "my-stars",
] as const;
export type AppBackgroundId = (typeof APP_BACKGROUND_IDS)[number];

export const APP_BACKGROUND_COOKIE = "odekake_app_bg";

/** ショップでの並び（動く／なぞる／かたむける／変わる／記録で育つ／シンプルアート／柄・風景） */
export type AppBackgroundGroup = "move" | "trace" | "tilt" | "change" | "record" | "art" | "pattern";

export const APP_BACKGROUND_GROUPS: readonly { id: AppBackgroundGroup; title: string; note: string }[] = [
  { id: "move", title: "動く背景", note: "ゆっくり動いたり、さわると反応したりします" },
  { id: "trace", title: "なぞる背景", note: "画面を指でなぞると、そのあとが残ります。スクロールしながらでも描けます" },
  { id: "tilt", title: "かたむける背景", note: "スマホをかたむけると、中のものが転がったり舞ったりします" },
  { id: "change", title: "変わる背景", note: "時間・天気・歩数・季節で、見た目が変わります" },
  { id: "record", title: "記録で育つ背景", note: "あなたのおでかけの記録で、絵が育っていきます。行くほど にぎやかに" },
  { id: "art", title: "シンプルアート", note: "シンプルだけど、ひと目でちがう。色と光だけで見せる背景です" },
  { id: "pattern", title: "柄・風景", note: "動かない、落ちついた背景です" },
];

export type AppBackground = {
  id: AppBackgroundId;
  name: string;
  /** ショップの一覧で名前の下に出す短い説明 */
  sub: string;
  description: string;
  /** 青コインの値段。0 は無料（最初から持っている） */
  price: number;
  group: AppBackgroundGroup;
  /** 動き・時間帯などのしるし */
  tag?: string;
  /** いつも暗い背景。ホーム以外では、文字が読めるように明るい色を重ねて薄める（時間・天気で暗くなるものは isDarkBackground） */
  dark?: boolean;
  /** 動く・変わる背景を live-backgrounds が描く */
  live?: true;
};

const DEFAULT_BACKGROUND: AppBackground = { id: "default", name: "いつもの", sub: "生成りとドット", description: "最初からの背景です。生成り色の紙に、うすいドットが入っています。", price: 0, group: "pattern" };

export const APP_BACKGROUNDS: readonly AppBackground[] = [
  // ---- 動く背景 ----
  { id: "fireworks", name: "花火大会", sub: "夜空に花火が開く", description: "夜の町の上に、菊・牡丹・しだれ柳・輪・小花の花火が次々と上がります。ときどき、まとめて上がるスターマインも。画面をタップすると、その場所に花火が上がります。ホーム以外の画面では、文字が読みやすいように薄めて表示します。", price: 4000, group: "move", tag: "さわれる", dark: true, live: true },
  { id: "paper-planes", name: "紙ひこうき", sub: "青空をすーっと飛ぶ", description: "色紙の紙ひこうきが、点線の跡を残しながら青空を飛んでいきます。ときどき宙がえりも。画面をタップすると、そこから1機飛んでいきます。", price: 4000, group: "move", tag: "さわれる", live: true },
  { id: "cloud-sea", name: "雲の上", sub: "朝焼けと雲海", description: "朝焼けの空の下に、どこまでも雲海が広がります。雲はゆっくり手前へ流れてきて、お日さまの光が雲のもりあがりを照らします。", price: 4000, group: "move", tag: "動く", live: true },
  { id: "dog-parade", name: "わんこパレード", sub: "フレブルたちがおさんぽ", description: "いろいろな服を着たフレブルたちが、画面の下をとことこ歩いていきます。ときどき立ち止まってにおいをかいだり、手をふったり。画面をタップすると、近くの子がジャンプします。", price: 4000, group: "move", tag: "さわれる", live: true },
  { id: "paw-trail", name: "わんこの足あと", sub: "見えないわんこがおさんぽ", description: "見えないわんこが、画面の上をてくてく歩いて足あとを残します。ときどきペンキをふんで、カラフルな足あとになることも。画面をタップすると、そこへかけよってきます。", price: 4000, group: "move", tag: "さわれる", live: true },
  { id: "bubbles", name: "シャボン玉", sub: "虹色にひかって、ふわふわ", description: "虹色にひかるシャボン玉が、ゆらゆら浮かんでいきます。ときどき、ふーっとまとめて飛んできます。タップするとパチンとはじけます。", price: 4000, group: "move", tag: "さわれる", live: true },
  { id: "goldfish", name: "きんぎょの池", sub: "光がゆらめく水面", description: "水面の光がゆらめく池を、金魚が泳ぎます。画面をタップすると波紋が広がって、金魚がびっくりしてにげていきます。", price: 4000, group: "move", tag: "さわれる", live: true },
  { id: "jelly", name: "とろけるゼリー", sub: "ぷるぷる、まざりあう", description: "パステルカラーのゼリーが、ゆっくりくっついたり、はなれたりします。つやつやの光もいっしょに動きます。", price: 4000, group: "move", tag: "動く", live: true },
  { id: "aurora-night", name: "オーロラの夜", sub: "流れ星と町の灯り", description: "夜空にオーロラがゆらめき、ときどき流れ星が走ります。下には小さな町の灯り。ホーム以外の画面では、文字が読みやすいように薄めて表示します。", price: 4000, group: "move", tag: "動く", dark: true, live: true },
  { id: "aurora", name: "パステルオーロラ", sub: "ゆっくり動く", description: "5色のふんわりしたグラデーションが、40秒かけてゆっくり回ります。", price: 4000, group: "move", tag: "動く" },
  { id: "balloons", name: "ふうせん", sub: "色とりどりに、ふわふわ", description: "色とりどりのふうせんと、わんこの顔のふうせんが、ゆらゆら空へのぼっていきます。ふうせんをタップするとパチンと割れて紙ふぶき。空いているところをタップすると、そこから1つ飛んでいきます。", price: 4000, group: "move", tag: "さわれる", live: true },
  { id: "local-train", name: "ローカル線", sub: "わんこを乗せて走る電車", description: "山と田んぼのあいだを、わんこたちを乗せた小さな電車がことこと走ります。雲が流れ、ときどき鳥も。開いている時刻で朝・昼・夕方・夜の景色に変わり、夜は窓に明かりがともります。画面をタップすると電車がすぐに来て、汽笛を鳴らします。", price: 4000, group: "move", tag: "さわれる", live: true },
  // ---- なぞる背景 ----
  { id: "zen-sand", name: "枯山水", sub: "指で砂に模様を描く", description: "石と苔のまわりに、砂の波もようが広がる庭。画面をなぞると、熊手でかいたような筋が砂に残り、しばらくすると元の模様にもどります。ときどき紅葉がひらりと落ちてきます。", price: 4000, group: "trace", tag: "なぞれる", live: true },
  { id: "fireflies", name: "ほたるの川辺", sub: "指に集まる光", description: "夜の川辺を、ほたるがふわふわ光りながら飛びます。画面をなぞると、ほたるが指のまわりに集まってきて、指を離すとまた散っていきます。ホーム以外の画面では、文字が読みやすいように薄めて表示します。", price: 4000, group: "trace", tag: "なぞれる", dark: true, live: true },
  { id: "paint-bloom", name: "にじむ絵の具", sub: "なぞると水彩がひろがる", description: "画用紙の上を指でなぞると、水彩の絵の具がじわっとにじんで広がります。色はなぞるうちに少しずつ変わり、重なったところは混ざります。ときどき、ぽたっと絵の具のしずくも。", price: 4000, group: "trace", tag: "なぞれる", live: true },
  // ---- かたむける背景 ----
  { id: "marbles", name: "ビー玉", sub: "かたむけると転がる", description: "ガラスのビー玉が、スマホをかたむけた方へ転がって、ぶつかり合います。タップすると、そのまわりのビー玉がはじけます。iPhoneでは、はじめに「動きと向き」の許可を聞かれます（許可しなくても、ゆっくり転がります）。", price: 4000, group: "tilt", tag: "かたむける", live: true },
  { id: "snow-globe", name: "スノードーム", sub: "ふると雪が舞う", description: "雪の町を閉じこめたスノードーム。スマホをかたむけたり、画面をなぞったりすると雪がうずを巻いて舞い上がり、ゆっくり降りつもります。タップでひとふり。", price: 4000, group: "tilt", tag: "かたむける", live: true },
  // ---- 変わる背景 ----
  { id: "weather", name: "おそとの天気", sub: "晴れ・雨・雪がそのまま", description: "いまの天気をそのまま背景にします。晴れなら光がさし、雨なら雨つぶ、雪なら雪が降り、夜は月と星が出ます。場所はマイルームで選んだところ（選んでいなければ東京）です。", price: 4000, group: "change", tag: "天気", live: true },
  { id: "garden", name: "歩いて咲く花畑", sub: "歩くほどお花が咲く", description: "きょう歩いた歩数で、画面のふちのつると花畑が育ちます。500歩ごとにお花がひとつ咲き、5,000歩でちょうちょが来て、10,000歩で満開です。毎日0歩から育ちます。", price: 4000, group: "change", tag: "歩数", live: true },
  { id: "seasons", name: "四季めぐり", sub: "季節で自動で変わる", description: "季節にあわせて、春は桜、夏はほたる、秋は落ち葉、冬は雪が舞います。季節が変わると、背景も自動で変わります。", price: 4000, group: "change", tag: "季節", live: true },
  { id: "sky-clock", name: "時間で変わる空", sub: "朝・昼・夕方・夜", description: "開いている時刻（日本時間）に合わせて、朝・昼・夕方・夜の空に自動で切り替わります。夜は星が出ます。", price: 4000, group: "change", tag: "時間帯" },
  // ---- 記録で育つ背景 ----
  { id: "my-map", name: "あなたの日本地図", sub: "行った県が色づく", description: "あなたが行った都道府県が、水彩の色で日本地図に色づきます。たくさん行った県ほど濃く、行った市区町村には小さな点がつきます。記録を増やすと、背景も育っていきます。", price: 5000, group: "record", tag: "記録", live: true },
  { id: "my-stars", name: "おでかけ星図", sub: "行った町が星になる", description: "夜空に日本の形の星くずが広がり、あなたが行った市区町村が明るい星になります。同じ県の星どうしは線でつながって、あなただけの星座に。ときどき流れ星も。ホーム以外の画面では、文字が読みやすいように薄めて表示します。", price: 5000, group: "record", tag: "記録", dark: true, live: true },
  // ---- シンプルアート ----
  { id: "mesh", name: "グラデーションメッシュ", sub: "色がゆっくり溶け合う", description: "ピンク・水色・ミント・杏・ラベンダーのやわらかい色のかたまりが、ゆっくり回りながら溶け合います。", price: 3000, group: "art", tag: "動く" },
  { id: "holo", name: "ホログラム", sub: "虹色の箔に光が流れる", description: "パステルの虹色の箔が少しずつ動き、ときどき光の筋がすーっと流れます。小さなきらめきつき。", price: 3000, group: "art", tag: "動く" },
  { id: "glass", name: "すりガラス", sub: "たて筋のガラス越しの色", description: "たて筋の入ったすりガラスの向こうに、あざやかな色がにじんで見えます。", price: 3000, group: "art" },
  { id: "sumi", name: "墨と金箔", sub: "和紙ににじむ墨と金", description: "和紙のすみに墨がにじみ、金箔と金の筆あとを散らしています。", price: 3000, group: "art" },
  // ---- 柄・風景 ----
  DEFAULT_BACKGROUND,
  { id: "paw", name: "肉球スタンプ", sub: "4色の肉球柄", description: "ベージュ・ピンク・ミント・水色の肉球を、角度を変えて散らしています。", price: 1500, group: "pattern" },
  { id: "washi", name: "和紙", sub: "繊維とざらつき", description: "和紙の繊維のような白いムラと細かい粒子に、画面のふちだけほんのり影を落としています。", price: 1500, group: "pattern" },
  { id: "watercolor", name: "水彩にじみ", sub: "5色がにじむ", description: "水色・ピンク・若葉・黄色・薄紫を、水彩絵の具がにじんだように四隅に置いています。", price: 1500, group: "pattern" },
  { id: "autumn", name: "秋の落ち葉", sub: "イチョウと紅葉", description: "暖かい色のグラデーションに、イチョウと紅葉の葉を散らしています。", price: 1500, group: "pattern" },
  { id: "map", name: "おでかけ地図", sub: "等高線と道とピン", description: "地図の等高線と方眼に、点線の道と2本のピンを描いています。", price: 2500, group: "pattern" },
  { id: "scenery", name: "空と丘", sub: "雲と3段の丘", description: "空に雲を浮かべ、画面の下に丘を重ねています。丘は下のナビの奥に透けて見えます。", price: 2500, group: "pattern" },
  { id: "starry", name: "星空", sub: "星と光の帯", description: "夜空に大小の星を散らし、天の川のような淡い光の帯を入れています。ホーム以外の画面では、文字が読みやすいように薄めて表示します。", price: 2500, group: "pattern", dark: true },
];

const BY_ID = new Map(APP_BACKGROUNDS.map((bg) => [bg.id, bg]));

export function isAppBackgroundId(value: unknown): value is AppBackgroundId {
  return typeof value === "string" && (APP_BACKGROUND_IDS as readonly string[]).includes(value);
}

export function getAppBackground(id: AppBackgroundId): AppBackground {
  return BY_ID.get(id) ?? DEFAULT_BACKGROUND;
}

export type SkyTime = "morning" | "day" | "evening" | "night";

/** 「時間で変わる空」の時間帯（日本時間）。朝5〜10時／昼10〜16時／夕方16〜19時／夜19〜5時 */
export function skyTimeOf(date: Date): SkyTime {
  const hour = (date.getUTCHours() + 9) % 24;
  if (hour >= 5 && hour < 10) return "morning";
  if (hour >= 10 && hour < 16) return "day";
  if (hour >= 16 && hour < 19) return "evening";
  return "night";
}

export type Season = "spring" | "summer" | "autumn" | "winter";

/** 季節（日本時間の月）。春3〜5月／夏6〜8月／秋9〜11月／冬12〜2月 */
export function seasonOf(date: Date): Season {
  const month = new Date(date.getTime() + 9 * 3600_000).getUTCMonth() + 1;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

/** 「おそとの天気」が受けとる、いまの天気と時間帯 */
export type WeatherSignal = { kind: WeatherKind; phase: SkyPhase };

/**
 * 動く・変わる背景が受けとる値。背景ごとに使うものだけ入る。
 * ショップの見本では、ここを差し替えて「雨のとき」「10,000歩のとき」などを見せる。
 */
export type BackgroundSignals = {
  skyTime?: SkyTime;
  weather?: WeatherSignal | null;
  /** きょうの歩数。わからないときは null */
  steps?: number | null;
  season?: Season;
  /** 記録で育つ背景の記録。mine は自分の記録、それ以外はショップの見本 */
  records?: RecordsKind;
};

export type RecordsKind = "mine" | "few" | "some" | "all";

/** ホーム以外で薄めて表示するか（暗い背景のときだけ） */
export function isDarkBackground(id: AppBackgroundId, signals: BackgroundSignals): boolean {
  if (id === "sky-clock" || id === "local-train") return signals.skyTime === "night";
  if (id === "weather") return signals.weather?.phase === "night";
  if (id === "seasons") return signals.season === "summer";
  return Boolean(getAppBackground(id).dark);
}

/** ショップの見本で切りかえて見せる「◯◯のとき」 */
export type BackgroundVariant = { key: string; label: string; signals: BackgroundSignals };

const SKY_TIME_VARIANTS: readonly BackgroundVariant[] = [
  { key: "morning", label: "朝", signals: { skyTime: "morning" } },
  { key: "day", label: "昼", signals: { skyTime: "day" } },
  { key: "evening", label: "夕方", signals: { skyTime: "evening" } },
  { key: "night", label: "夜", signals: { skyTime: "night" } },
];

export const BACKGROUND_VARIANTS: Partial<Record<AppBackgroundId, readonly BackgroundVariant[]>> = {
  "local-train": SKY_TIME_VARIANTS,
  "sky-clock": [
    { key: "morning", label: "朝", signals: { skyTime: "morning" } },
    { key: "day", label: "昼", signals: { skyTime: "day" } },
    { key: "evening", label: "夕方", signals: { skyTime: "evening" } },
    { key: "night", label: "夜", signals: { skyTime: "night" } },
  ],
  weather: [
    { key: "clear", label: "晴れ", signals: { weather: { kind: "clear", phase: "day" } } },
    { key: "cloudy", label: "くもり", signals: { weather: { kind: "cloudy", phase: "day" } } },
    { key: "rain", label: "雨", signals: { weather: { kind: "rain", phase: "day" } } },
    { key: "thunder", label: "雷", signals: { weather: { kind: "thunder", phase: "day" } } },
    { key: "snow", label: "雪", signals: { weather: { kind: "snow", phase: "day" } } },
    { key: "fog", label: "きり", signals: { weather: { kind: "fog", phase: "morning" } } },
    { key: "evening", label: "夕方", signals: { weather: { kind: "partly", phase: "evening" } } },
    { key: "night", label: "夜", signals: { weather: { kind: "clear", phase: "night" } } },
  ],
  garden: [
    { key: "0", label: "0歩", signals: { steps: 0 } },
    { key: "3000", label: "3,000歩", signals: { steps: 3000 } },
    { key: "6000", label: "6,000歩", signals: { steps: 6000 } },
    { key: "10000", label: "10,000歩", signals: { steps: 10000 } },
  ],
  "my-map": [
    { key: "mine", label: "あなた", signals: { records: "mine" } },
    { key: "few", label: "5県", signals: { records: "few" } },
    { key: "some", label: "21県", signals: { records: "some" } },
    { key: "all", label: "全国", signals: { records: "all" } },
  ],
  "my-stars": [
    { key: "mine", label: "あなた", signals: { records: "mine" } },
    { key: "few", label: "5県", signals: { records: "few" } },
    { key: "some", label: "21県", signals: { records: "some" } },
    { key: "all", label: "全国", signals: { records: "all" } },
  ],
  seasons: [
    { key: "spring", label: "春", signals: { season: "spring" } },
    { key: "summer", label: "夏", signals: { season: "summer" } },
    { key: "autumn", label: "秋", signals: { season: "autumn" } },
    { key: "winter", label: "冬", signals: { season: "winter" } },
  ],
};

/** ショップ一覧の見本で、縦に並べて見せる切りかえ（1つだけなら、その様子を全面に） */
export const POSTER_VARIANTS: Partial<Record<AppBackgroundId, readonly string[]>> = {
  "sky-clock": ["morning", "day", "evening", "night"],
  weather: ["clear", "rain", "snow", "night"],
  seasons: ["spring", "summer", "autumn", "winter"],
  garden: ["10000"],
  "local-train": ["day"],
  "my-map": ["some"],
  "my-stars": ["some"],
};

/** 大きな見本を開いたときに、最初に見せる切りかえ（いまの時間帯・季節に近いもの） */
export function defaultVariantKey(id: AppBackgroundId, now: Date): string | null {
  if (id === "sky-clock" || id === "local-train") return skyTimeOf(now);
  if (id === "seasons") return seasonOf(now);
  if (id === "weather") return skyTimeOf(now) === "night" ? "night" : "clear";
  if (id === "garden") return "6000";
  if (id === "my-map" || id === "my-stars") return "mine";
  return null;
}
