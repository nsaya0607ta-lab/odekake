/**
 * おさんぽフレンチーのアイテムスキル
 * =============================================================
 * 図鑑の全アイテムに1つずつスキルがあり、道で拾った瞬間に発動する。
 * 効果は小さな部品（Fx）の組み合わせで書き、engine.ts がそれを解釈して動かす。
 *
 * 数値の書き方:
 *   - 数字1つ …… レベルに関係なく同じ
 *   - [Lv1, Lv.MAX] …… 図鑑のスキルLv（1〜5）で直線的に強くなる
 * N は図鑑のスキルLvを持たないので、いつも Lv1 の値になる。
 *
 * 重ねがけ:
 *   - 「○秒間」の効果（buff）は、同じアイテムをもう一度拾うと秒数がリセットされる（のびない）
 *   - 違うアイテムの倍率どうしは掛け算
 *
 * desc / max は画面（ずかん）にそのまま出す説明文。数値を変えたら両方直す。
 */
import type { GachaRarity } from "@/lib/gacha/config";

/** 数字1つか、[Lv1の値, Lv.MAXの値] */
export type Lv = number | readonly [number, number];

/**
 * 障害物のまとまり。見た目はステージで変わるが、中身は同じ。
 * cone=コーン/岩/雪だるま/スイカ、bike=自転車/倒木/ソリ/金魚のたらい、sign=看板/道標/かき氷の旗
 */
export type ObsGroup =
  | "all" | "hard" | "rock" | "rockbike" | "crow" | "crowcat" | "cat" | "animals" | "puddle" | "puddlecrow" | "low" | "ground" | "bikesign";

/** 点数を変えるときの対象 */
export type ItemFilter = "any" | "food" | "N" | "NR" | "air";

/** しばらく続く効果。sec 秒たつと切れる */
export type Buff = {
  sec: Lv;
  /** HUD に出す短い名前（省略時はスキル名） */
  label?: string;
  /** スコア倍率（アイテム・障害物の加点すべて） */
  mul?: Lv;
  /** アイテムの点数倍率 */
  itemMul?: Lv;
  itemFilter?: ItemFilter;
  /** アイテム1個ごとの加点 */
  itemAdd?: Lv;
  /** 拾うたびに +ramp, +2ramp, +3ramp… */
  ramp?: Lv;
  /** アイテムを吸い寄せる半径（ふだんは 52） */
  magnet?: Lv;
  /** 高いところのアイテムも真上から吸い寄せる */
  wide?: boolean;
  /** アイテムを大きく、拾いやすく */
  big?: boolean;
  /** ジャンプ力の倍率 */
  jump?: Lv;
  /** 空中で追加できるジャンプの回数（99 で何回でも） */
  air?: number;
  /** 落ちるのがゆっくり */
  float?: boolean;
  /** 着地するたびに自動で小ジャンプ */
  hop?: boolean;
  /** 障害物を自動でよける（念のため無敵もつく） */
  auto?: boolean;
  /** 無敵 */
  inv?: boolean;
  /** 障害物をすり抜ける。1つにつき +pts */
  pass?: Lv;
  /** 障害物を越えるたびに +pts（ふつうに跳んで越えたとき） */
  over?: Lv;
  /** 触れた障害物を壊す。1つにつき +pts */
  smash?: Lv;
  smashKinds?: ObsGroup;
  /** この種類には当たらない */
  immune?: ObsGroup;
  /** この種類は近づくと逃げていく */
  repel?: ObsGroup;
  /** この種類は出てこない */
  noSpawn?: ObsGroup;
  /** 走る速さの倍率 */
  speed?: Lv;
  /** スピードが上がらない */
  hold?: boolean;
  /** その場で止まる（止まっているあいだは無敵） */
  stop?: boolean;
  /** コンボが下がらない */
  comboLock?: boolean;
  /** コンボが切れるまでの猶予（秒）を足す */
  comboGrace?: Lv;
  /** コンボ倍率が1上がるたびに、スコア倍率が +comboStep */
  comboStep?: Lv;
  /** 雨・雪がやむ */
  dry?: boolean;
  /** 雨つぶ・雪で見づらくならない */
  clear?: boolean;
  /** 障害物が光って見やすい */
  bright?: boolean;
  /** 画面の色（"r,g,b"） */
  tint?: string;
  /** 1秒あたりに空から降ってくるアイテムの数 */
  rain?: Lv;
  /** 空から降らせるのをアイテムではなく小さな粒（この点数）にする */
  rainToken?: Lv;
  /** BGMの拍に合わせてジャンプすると +pts */
  rhythm?: Lv;
  /** 拾うと、近くのアイテムももう1個いっしょに拾う */
  spark?: boolean;
  /** このおさんぽで初めて拾う種類なら +pts */
  fresh?: Lv;
  /** 効果が切れたとき、そのあいだに拾った数 × pts */
  countPer?: Lv;
  /** 効果が切れたとき +pts */
  endPts?: Lv;
};

export type Fx =
  | { op: "buff"; b: Buff }
  | { op: "pts"; v: Lv }
  | { op: "randPts"; min: Lv; max: Lv }
  /** 次に拾う n 個に効く（add=加点, mul=倍率, up=レアリティを上げる段数, dup=増える数） */
  | { op: "next"; n: Lv; add?: Lv; mul?: Lv; up?: Lv; dup?: Lv; filter?: ItemFilter }
  /** 次の n 個のうち、いちばん点の高かったものを mul 倍 */
  | { op: "best"; n: Lv; mul: Lv }
  /**
   * 次にぶつかったとき1回防ぐ（n は互換のため残しているが、守りは1回までなので1として扱う）。
   * sec 以内だけ有効。after 秒の無敵がつく
   */
  | { op: "guard"; n: Lv; sec?: Lv; kinds?: ObsGroup; pts?: Lv; after?: Lv }
  /** 前から来る障害物を n 個はじき飛ばす */
  | { op: "clear"; n: Lv; kinds?: ObsGroup; pts?: Lv }
  /** 画面の障害物をすべて片づける */
  | { op: "clearAll"; pts: Lv }
  /** アイテム（token のときは小さな粒）を並べる */
  | { op: "spawn"; n: Lv; shape: SpawnShape; min?: GachaRarity; food?: boolean; token?: Lv }
  /** すぐにボーナスタイム */
  | { op: "bonus"; sec: Lv }
  /** 次のボーナスタイムが早く来る（残り時間を frac だけ縮める） */
  | { op: "bonusSoon"; frac: Lv }
  /** 次のラッシュは無敵で、突破ボーナスが mul 倍 */
  | { op: "rush"; mul: Lv }
  /** 時計を進める（add 分）/ 決まった時刻にする（set）/ 夜なら粒を降らせ、昼なら夜まで進める（night） */
  | { op: "clock"; add?: number; set?: number; night?: Lv }
  /**
   * 1回だけ倒れても復活。keep=残るスコアの割合, pts=復活したとき, mul=復活後10秒のスコア倍率。
   * 身代わり・バリア・復活の「守り」は合わせて1回ぶんまで。今より弱い守りは付かず、強いか同じなら入れかわる
   */
  | { op: "revive"; keep?: number; pts?: Lv; mul?: Lv }
  /** このおさんぽ中、UR以上の出る確率 × mul */
  | { op: "rare"; mul: Lv }
  /** このおさんぽ中、夜のあいだスコア × mul */
  | { op: "nightMul"; mul: Lv }
  /** このおさんぽ中、スコア × mul（stage のときは stageMul） */
  | { op: "runMul"; mul: Lv; stage?: string; stageMul?: Lv }
  /** sec 秒後に +pts */
  | { op: "delay"; sec: number; pts: Lv }
  /** 拾うたびに、このおさんぽ中の全アイテムが +add（max 回まで） */
  | { op: "stack"; add: Lv; max: number }
  /** need 回拾うと +pts（ぶつかって守られると崩れる） */
  | { op: "cairn"; need: number; pts: Lv }
  /** 次の1個の点数をしまい、おさんぽの終わりに mul 倍で足す */
  | { op: "pouch"; mul: Lv }
  /** おさんぽの終わりに、いちばん点の高かったアイテムを times 回ぶん足す */
  | { op: "keepBest"; times: Lv }
  /** 画面のハトを飛び立たせる。1羽 +per */
  | { op: "pigeons"; per: Lv }
  /** 次の n 回のジャンプが mul 倍 */
  | { op: "bigJump"; n: Lv; mul: Lv }
  /** ほかのスキルを n 個ランダムで発動 */
  | { op: "random"; n: Lv }
  /** 次に出る n 個のレアリティがランダムに入れかわる */
  | { op: "reroll"; n: Lv }
  /** 次に出る n 個のうち hits 個が LR 以上 */
  | { op: "lucky"; n: Lv; hits: Lv }
  /** このおさんぽで初めて拾ったら first、2回目からは later */
  | { op: "first"; first: Lv; later: Lv }
  /** このおさんぽで拾ったシリーズの種類数 × per */
  | { op: "series"; series: string; per: Lv }
  /** コンボ倍率を add 上げる（雪の中ならさらに snow） */
  | { op: "combo"; add: Lv; snow?: Lv }
  /** コンボが切れそうになったら n 回まで防ぐ */
  | { op: "comboGuard"; n: Lv }
  /** いまのコンボ数（最大30） × per */
  | { op: "comboPts"; per: Lv }
  /** コンボ ×5 のときだけ +pts */
  | { op: "maxCombo"; pts: Lv }
  /** 雨・雪なら +v、晴れなら半分 */
  | { op: "weatherPts"; v: Lv }
  /** 取りこぼしたアイテムを n 個まで自動で拾う */
  | { op: "miss"; n: Lv }
  /** 直前に拾ったアイテムが n 個また落ちてくる */
  | { op: "echo"; n: Lv }
  /** スピードを最初の速さに戻す */
  | { op: "reset" };

export type SpawnShape = "row" | "arc" | "high" | "ring" | "wave" | "sky" | "line" | "one" | "mid";

export type SkillKind = "score" | "guard" | "spawn" | "jump" | "collect" | "combo" | "weather" | "pace" | "revive";

export const SKILL_KIND_LABELS: Record<SkillKind, string> = {
  score: "スコア", guard: "守り", spawn: "出現", jump: "ジャンプ", collect: "回収", combo: "コンボ", weather: "天気・時計", pace: "速さ", revive: "復活",
};

/** 種類ごとの色（プレイ中の左上のカード・ずかんの絞り込みで使う） */
export const SKILL_KIND_COLORS: Record<SkillKind, string> = {
  score: "#FFC857", guard: "#7CC4FF", spawn: "#FF84BC", jump: "#7EF0D0", collect: "#C79BFF", combo: "#FF9F6B", weather: "#9FD4FF", pace: "#B8E986", revive: "#FF6B8A",
};

export type OsanpoRunSkill = {
  /** COLLECTION_ITEMS の id */
  id: string;
  name: string;
  kind: SkillKind;
  /** Lv1 の説明 */
  desc: string;
  /** Lv.MAX でどう変わるか */
  max: string;
  /** おもしろ枠 */
  fun?: boolean;
  fx: readonly Fx[];
};

const B = (b: Buff): Fx => ({ op: "buff", b });
function sk(id: string, name: string, kind: SkillKind, desc: string, max: string, fx: readonly Fx[], fun = false): OsanpoRunSkill {
  return { id, name, kind, desc, max, fx, fun };
}

export const OSANPO_RUN_SKILLS: readonly OsanpoRunSkill[] = [
  // ---------- 通常図鑑：おもちゃ ----------
  sk("toy_colorful_ball", "ころころ", "score", "次の3個のアイテムが +5pt", "+15pt", [{ op: "next", n: 3, add: [5, 15] }]),
  sk("toy_rope", "ひっぱりっこ", "combo", "5秒間、コンボが切れるまでの猶予が +0.5秒", "+1.5秒", [B({ sec: 5, comboGrace: [0.5, 1.5] })]),
  sk("toy_bone", "ほねほね貯金", "score", "拾うたび、このおさんぽ中ずっと全アイテム +1pt（10回まで貯まる）", "1回につき +3pt", [{ op: "stack", add: [1, 3], max: 10 }]),
  sk("toy_squeaky_ball", "ぴこっ！", "score", "「ぴこっ」と鳴って、画面内のハトが一斉に飛び立つ。1羽 +20pt", "1羽 +60pt", [{ op: "pigeons", per: [20, 60] }], true),
  sk("toy_duck_plush", "ぷかぷかダイブ", "guard", "次の水たまりにぷかぷか浮いて通れる（+50pt）", "+150pt", [{ op: "guard", n: 1, kinds: "puddle", pts: [50, 150] }], true),
  sk("toy_carrot", "うさぎ跳び", "jump", "5秒間、ジャンプが1.2倍高くなる", "8秒間・1.5倍", [B({ sec: [5, 8], jump: [1.2, 1.5] })]),
  sk("toy_frisbee", "キャッチ＆ラン", "score", "次に拾う1個の点数 ×2", "×3", [{ op: "next", n: 1, mul: [2, 3] }]),
  sk("toy_treasure_puzzle", "宝さがし", "spawn", "少し先にSR以上のアイテムが1個出る", "SSR以上", [{ op: "spawn", n: 1, shape: "one", min: "SR" }]),
  sk("toy_frenchie_plush", "身代わりぬいぐるみ", "guard", "5秒以内にぶつかったら、ぬいぐるみが1回だけ代わりに受け止める", "15秒以内", [{ op: "guard", n: 1, sec: [5, 15] }]),
  sk("toy_rainbow_ball", "レインボーロード", "collect", "5秒間、空中のアイテムも真上から吸い寄せる", "10秒間", [B({ sec: [5, 10], wide: true, magnet: 90, tint: "255,190,240" })]),
  sk("toy_tennis_ball", "ワンバウンド", "jump", "次のジャンプが1.3倍高く、よくはずむ", "3回まで", [{ op: "bigJump", n: [1, 3], mul: 1.3 }]),
  sk("toy_red_slipper", "スリッパ強奪", "guard", "スリッパをぶんぶん振り回して、前の障害物を1つはじき飛ばす", "2つ", [{ op: "clear", n: [1, 2], kinds: "ground", pts: 20 }], true),
  sk("toy_wood_stick", "でっかい枝", "score", "+30pt。ただし枝がひっかかって3秒間だけ少し遅くなる", "+90pt", [{ op: "pts", v: [30, 90] }, B({ sec: 3, speed: 0.9, label: "枝がひっかかり中" })], true),
  sk("toy_donut_rope", "わっか通し", "score", "5秒間、障害物を越えるたびに +30pt", "+80pt", [B({ sec: 5, over: [30, 80] })]),
  sk("toy_soccer_ball", "ドリブル突破", "guard", "次のコーンや岩をボールごと蹴り飛ばす（+50pt）", "2回まで", [{ op: "clear", n: [1, 2], kinds: "rock", pts: 50 }]),
  sk("toy_taiyaki_plush", "あんこ補給", "score", "次の3個のうち、食べ物アイテムの点数が ×1.5", "×2", [{ op: "next", n: 3, mul: [1.5, 2], filter: "food" }]),
  sk("toy_bear_plush", "くまさんと一緒", "collect", "5秒間、アイテムを拾える範囲が広がる", "もっと広い", [B({ sec: 5, magnet: [78, 104] })]),
  sk("toy_meat", "肉パワー", "score", "6秒間、スコア ×1.3", "×1.8", [B({ sec: 6, mul: [1.3, 1.8] })]),
  sk("toy_frenchie_cushion", "ぽよん着地", "jump", "10秒間、クッションではずんで、ジャンプが1.3倍", "20秒間", [B({ sec: [10, 20], jump: 1.3 })]),
  sk("toy_paw_macaron", "にくきゅうスタンプ", "score", "8秒間、アイテムの点数 +10%", "+40%", [B({ sec: 8, itemMul: [1.1, 1.4] })]),
  sk("toy_star_wan_wand", "おほしさまに願いを", "spawn", "ほかのアイテムのスキルが、ランダムで1つ発動", "2つ", [{ op: "random", n: [1, 2] }], true),
  sk("toy_golden_crown_ball", "王さまのおさんぽ", "score", "次の5個が、1ランク上のレアリティの点数になる", "2ランク上", [{ op: "next", n: 5, up: [1, 2] }]),
  // ---------- 通常図鑑：食べ物 ----------
  sk("food_paw_bowl", "おかわり", "score", "次の3個のアイテムが +10pt", "次の5個 +20pt", [{ op: "next", n: [3, 5], add: [10, 20] }]),
  sk("food_strawberry_roll_cake", "くるくるロール", "combo", "5秒間、コンボが下がらない", "10秒間", [B({ sec: [5, 10], comboLock: true })]),
  sk("food_paw_pudding", "ぷるぷるボディ", "guard", "3秒以内にぶつかったら、ぷるんと跳ね返って1回だけ無傷", "5秒以内", [{ op: "guard", n: 1, sec: [3, 5] }]),
  sk("food_paw_melon_bread", "さくさく", "combo", "次のボーナスタイムが早く来る（残り時間 -20%）", "-50%", [{ op: "bonusSoon", frac: [0.2, 0.5] }]),
  sk("food_smile_onigiri", "エネルギー補給", "score", "+20pt", "+60pt", [{ op: "pts", v: [20, 60] }]),
  sk("food_paw_cupcake", "おたんじょうび", "score", "5秒間、拾うたびに +1pt, +2pt, +3pt…と増えていく", "10秒間・+2ptずつ", [B({ sec: [5, 10], ramp: [1, 2] })]),
  sk("food_paw_taiyaki", "しっぽまであんこ", "score", "いまのコンボ数 ×5pt（30コンボまで）", "コンボ数 ×15pt", [{ op: "comboPts", per: [5, 15] }]),
  sk("food_dog_milk", "すくすく", "score", "次の3個のうち、Nアイテムの点数 ×2", "×4", [{ op: "next", n: 3, mul: [2, 4], filter: "N" }]),
  sk("food_cheese_cubes", "ころころチーズ", "spawn", "前にチーズの粒が3個ころがってくる（1個 +10pt）", "6個", [{ op: "spawn", n: [3, 6], shape: "row", token: 10 }]),
  sk("food_roasted_sweet_potato", "ほっかほか", "weather", "雨か雪の中で拾うと +40pt（晴れなら半分）", "+120pt", [{ op: "weatherPts", v: [40, 120] }]),
  sk("food_honey_butter_toast", "とろ〜り", "collect", "3秒間、アイテムが大きくなって拾いやすい", "6秒間", [B({ sec: [3, 6], big: true })]),
  sk("food_fruit_basket", "フルーツ盛り合わせ", "spawn", "前に食べ物アイテムが5個並ぶ", "10個", [{ op: "spawn", n: [5, 10], shape: "row", food: true }]),
  sk("food_kamikami", "かみかみタイム", "score", "4秒間、ジャンプ中に拾ったアイテムの点数 +30%", "+80%", [B({ sec: 4, itemMul: [1.3, 1.8], itemFilter: "air" })]),
  sk("food_mocchurin", "もっちゅり化", "guard", "8秒間、もちもちボディで、ぶつかってもびよーんと伸びて何回でも平気", "12秒間", [B({ sec: [8, 12], inv: true, tint: "255,236,210" })], true),
  // ---------- 通常図鑑：インテリア ----------
  sk("interior_stretch_rod", "のび〜", "jump", "5秒間、胴がのびて、のれんや低いカラスに当たらない", "10秒間", [B({ sec: [5, 10], immune: "low" })], true),
  sk("interior_anball", "アンボール転がし", "guard", "10秒間、大きなボールに乗って障害物をなぎ倒す（1つ +30pt）", "15秒間", [B({ sec: [10, 15], smash: 30 })], true),
  sk("interior_kinoko_azubee", "きのこトランポリン", "jump", "8秒間、きのこで跳ねて大ジャンプ（1.4倍）。上空に星の粒が並ぶ", "12秒間", [B({ sec: [8, 12], jump: 1.4 }), { op: "spawn", n: 6, shape: "high", token: 20 }], true),
  sk("interior_gold_ball", "金ぴか", "score", "10秒間、N・Rアイテムの点数 ×3", "15秒間", [B({ sec: [10, 15], itemMul: 3, itemFilter: "NR", tint: "255,215,120" })]),
  sk("interior_sleepy_moon", "夜ふかし", "weather", "時計が1時間すすむ。このおさんぽ中、夜のあいだスコア ×1.2", "×1.5", [{ op: "clock", add: 60 }, { op: "nightMul", mul: [1.2, 1.5] }], true),
  sk("interior_spring_flower_wreath", "花道", "weather", "6秒間、花が咲いて雨や雪がやむ", "12秒間", [B({ sec: [6, 12], dry: true, clear: true })]),
  sk("interior_shikkoku_no_ar", "漆黒モード", "guard", "10秒間、影に溶けて障害物をすり抜ける（1つ +50pt）", "15秒間", [B({ sec: [10, 15], pass: 50, tint: "20,14,40" })], true),
  sk("interior_ragby_ar", "タックル突破", "guard", "10秒間、ボールを抱えて突進し、障害物を吹っ飛ばす（1つ +80pt）。終わると「トライ！」+500pt", "15秒間", [B({ sec: [10, 15], smash: 80, endPts: 500 })], true),
  // ---------- 通常図鑑：その他 ----------
  sk("other_sparkle_rope_crown", "きらきら王冠", "collect", "5秒間、少し離れたアイテムを吸い寄せる", "10秒間", [B({ sec: [5, 10], magnet: 110 })]),
  sk("other_azubee", "あずびーダッシュ", "guard", "5秒間、猛ダッシュで無敵。通り道のアイテムを吸い寄せる", "8秒間", [B({ sec: [5, 8], inv: true, speed: 1.3, magnet: 120 })]),
  sk("other_omojii", "おじいちゃんのおさんぽ", "pace", "8秒間、のんびり歩き（速さ0.6倍）になるかわりに、スコア ×2", "12秒間・×3", [B({ sec: [8, 12], speed: 0.6, mul: [2, 3] })], true),
  sk("other_nakayoshi_azubee", "なかよしペア", "collect", "10秒間、もう1匹が取りこぼしを拾ってくれる（広く吸い寄せ）", "20秒間", [B({ sec: [10, 20], magnet: 100, wide: true })]),
  sk("other_komochi", "こもち大行進", "guard", "子犬がついてきて、ぶつかったとき1回だけ身代わりになって帰っていく", "身代わりのあと3秒無敵", [{ op: "guard", n: 1, after: [0, 3] }], true),
  sk("other_azuki", "あずき色の風", "combo", "次のラッシュを無敵で乗り切り、突破ボーナス ×2", "×3", [{ op: "rush", mul: [2, 3] }]),
  sk("other_kobee", "こびーのおねだり", "spawn", "10秒間、食べ物を拾うたび +100pt。前に食べ物が5個並ぶ", "15秒間", [B({ sec: [10, 15], itemAdd: 100, itemFilter: "food" }), { op: "spawn", n: 5, shape: "row", food: true }], true),
  sk("other_kamunayo", "かむなよ！", "guard", "次の自転車や看板をかじって壊す（+30pt）", "3回まで", [{ op: "clear", n: [1, 3], kinds: "bikesign", pts: 30 }], true),
  sk("other_hamigaki", "ぴかぴか歯", "score", "5秒間、拾ったアイテムの点数 +50%", "10秒間", [B({ sec: [5, 10], itemMul: 1.5 })]),
  sk("other_ikea", "くみたて中", "score", "5秒間、拾った数を数え、終わったときに「家具完成！」で 個数 ×20pt", "個数 ×50pt", [B({ sec: 5, countPer: [20, 50] })]),
  sk("other_orusuban", "おるすばん", "spawn", "その場で3秒間おるすばん。再開すると前にアイテムがどっさり", "もっとどっさり", [B({ sec: 3, stop: true }), { op: "spawn", n: [8, 14], shape: "wave" }], true),
  sk("other_kurumari_a", "くるまり防御", "guard", "5秒間、丸まってころころ。のれんや低いカラス、水たまりに当たらない", "10秒間", [B({ sec: [5, 10], immune: "low" }), B({ sec: [5, 10], immune: "puddle", label: "ころころ" })]),
  sk("other_pondeomo", "ぽんでリング", "spawn", "空中にほねとアイテムがリング状に6個並ぶ（アイテムは3つに1つ）", "9個", [{ op: "spawn", n: [6, 9], shape: "ring" }]),
  sk("other_pondear", "ぽんでジャンプ", "jump", "10秒間、空中で何回でもジャンプできる", "15秒間", [B({ sec: [10, 15], air: 99 })]),
  sk("other_oyatsu_no_jikan", "おやつのじかん", "combo", "すぐにボーナスタイムが5秒はじまる", "10秒", [{ op: "bonus", sec: [5, 10] }]),
  sk("other_jare_a", "じゃれつき", "guard", "5秒間、猫やハト・カラスと仲良し。当たらず、じゃれるたび +40pt", "10秒間", [B({ sec: [5, 10], smash: 40, smashKinds: "animals" })], true),
  sk("other_ketsunade_a", "けつなで", "combo", "おしりをなでてもらってご機嫌。コンボ倍率が +2", "一気に最大 ×5", [{ op: "combo", add: [2, 4] }], true),
  sk("other_omochi_janai", "おもちじゃない...!?", "spawn", "次に出る5個のうち1個がLR以上（なにが出るかはお楽しみ）", "10個・うち2個", [{ op: "lucky", n: [5, 10], hits: [1, 2] }], true),
  sk("other_oyasumi", "すやすや", "guard", "3秒間、寝落ちしたまま自動で走り、障害物も自動でよける", "8秒間", [B({ sec: [3, 8], auto: true })], true),
  sk("other_nisoku_a", "二足歩行", "collect", "8秒間、立ち上がって歩き、高いところのアイテムも拾える", "12秒間", [B({ sec: [8, 12], wide: true })], true),
  sk("other_listen_to_the_a", "リッスン", "score", "10秒間、BGMの拍に合わせてジャンプすると1回 +100pt", "20秒間", [B({ sec: [10, 20], rhythm: 100, tint: "150,200,255" })], true),
  sk("other_okaeri", "おかえり！", "revive", "1回だけ、倒れても家から迎えが来て、その場から再開できる", "再開後10秒間 スコア ×1.5", [{ op: "revive", mul: [1, 1.5] }]),
  sk("other_omoi_bashira", "一家の大黒柱", "guard", "10秒間、どっしりして何にぶつかっても平気。ただしジャンプは少し低め", "15秒間", [B({ sec: [10, 15], inv: true, jump: 0.85 })]),
  sk("other_pink_omo", "ピンク旋風", "guard", "10秒間、画面がピンクになり、障害物がハートに（当たると +50pt）", "15秒間・アイテムも1ランクアップ", [B({ sec: [10, 15], smash: 50, tint: "255,140,200" }), { op: "next", n: [0, 10], up: 1 }], true),
  sk("other_burebur", "ブレブル", "collect", "5秒間、ブレて分身し、どの高さのアイテムも拾う。無敵", "10秒間", [B({ sec: [5, 10], inv: true, wide: true, magnet: 130 })], true),
  sk("other_xmas_party", "メリークリスマス", "spawn", "10秒間、プレゼントの粒が空から降ってくる（1つ +100pt）", "20秒間", [B({ sec: [10, 20], rain: 3, rainToken: 100, tint: "200,230,255" })], true),
  sk("other_narcissist_a", "鏡よ鏡", "score", "10秒間、スコア ×3。ただしキラキラがまぶしい", "×5", [B({ sec: 10, mul: [3, 5], tint: "255,245,200" })], true),
  sk("other_mafia_a", "ボスの命令", "guard", "画面内の障害物をすべて片づけ（1つ +100pt）、そのあと10秒間は障害物が出ない", "20秒間", [{ op: "clearAll", pts: 100 }, B({ sec: [10, 20], noSpawn: "all" })], true),
  sk("other_clawd", "オートコーディング", "guard", "5秒間、先の障害物を読み切って、自動でよけながら走る", "10秒間", [B({ sec: [5, 10], auto: true })], true),
  sk("other_mah", "まぁ〜", "pace", "あくびをして、5秒間ゆっくり（0.5倍の速さ）になる", "10秒間", [B({ sec: [5, 10], speed: 0.5 })]),
  sk("other_mirror_omochi", "ミラー", "score", "次の5個が、拾うと鏡でもう1個に増える", "10個", [{ op: "next", n: [5, 10], dup: 1 }]),
  sk("other_toorematen", "通れまてん", "guard", "10秒間、通せんぼ。前から来る猫や自転車が引き返していく", "20秒間", [B({ sec: [10, 20], repel: "rockbike" }), B({ sec: [10, 20], repel: "cat", label: "通せんぼ" })], true),
  sk("other_hia", "ハイ！", "jump", "ハイタッチで、8秒間ジャンプ力1.5倍・落ちるのがゆっくり", "15秒間", [B({ sec: [8, 15], jump: 1.5, float: true })]),
  sk("other_mrs_green_apple", "ライブ開演", "score", "10秒間、空からリンゴが降るライブ。スコア ×1.5", "20秒間・×2", [B({ sec: [10, 20], mul: [1.5, 2], rain: 2, rainToken: 30, tint: "180,255,170" })], true),
  sk("other_yellow_rain_boots", "ながぐつ", "guard", "10秒間、水たまりを気にせず歩ける", "20秒間", [B({ sec: [10, 20], immune: "puddle" })]),
  sk("accessory_red_bandana", "やる気バンダナ", "combo", "次のコンボ切れを1回防ぐ", "3回まで", [{ op: "comboGuard", n: [1, 3] }]),
  sk("other_acorns", "どんぐり拾い", "spawn", "前にどんぐりが5個並ぶ（1個 +5pt）", "15個", [{ op: "spawn", n: [5, 15], shape: "row", token: 5 }]),
  sk("toy_paper_airplane", "すーっと滑空", "jump", "3秒間、落ちるのがゆっくりになる", "6秒間", [B({ sec: [3, 6], float: true })]),
  sk("other_walk_water_bottle", "ひとやすみ", "pace", "5秒間、スピードが上がらなくなる", "15秒間", [B({ sec: [5, 15], hold: true })]),
  sk("other_shiny_pinecone", "まつぼっくり", "score", "+15pt", "+45pt", [{ op: "pts", v: [15, 45] }]),
  sk("accessory_blue_handkerchief", "ふきふき", "weather", "10秒間、雨つぶや雪で見づらくならない", "30秒間", [B({ sec: [10, 30], clear: true })]),
  sk("toy_red_balloon", "ふうせん", "jump", "3秒間、ふわふわ浮いて落ちるのがゆっくり", "6秒間", [B({ sec: [3, 6], float: true, jump: 1.15 })], true),
  sk("toy_sand_bucket", "すなあそび", "guard", "次の水たまりが砂場に変わる（+20pt）", "3つまで", [{ op: "clear", n: [1, 3], kinds: "puddle", pts: 20 }]),
  sk("accessory_walk_pouch", "ポーチにしまう", "score", "次に拾う1個をしまっておき、おさんぽの終わりに点数を2倍で足す", "3倍", [{ op: "pouch", mul: [2, 3] }]),
  sk("other_red_apple", "しゃきっ", "score", "+20pt", "+50pt", [{ op: "pts", v: [20, 50] }]),
  // ---------- 山道シリーズ ----------
  sk("hiking_frenchie", "登頂", "score", "10秒間、山道モードでジャンプ1.15倍。10秒たつと山頂ボーナス +500pt", "+1500pt", [B({ sec: 10, jump: 1.15, endPts: [500, 1500] })], true),
  sk("toy_hiking_stick", "杖つき", "jump", "5秒間、ジャンプが1.1倍で、空中でもう1回跳べる", "10秒間", [B({ sec: [5, 10], jump: 1.1, air: 1 })]),
  sk("toy_rock_ball", "岩くだき", "guard", "次の岩（コーン）を1回くだく（+20pt）", "3回まで", [{ op: "clear", n: [1, 3], kinds: "rock", pts: 20 }]),
  sk("toy_echo_whistle", "やっほー", "spawn", "山びこで、直前に拾ったアイテムがもう1個落ちてくる", "2個", [{ op: "echo", n: [1, 2] }]),
  sk("toy_rope_swing", "アーアアー", "jump", "5秒間、ロープで大きくスイング（ジャンプ1.6倍・ゆっくり落ちる）", "10秒間", [B({ sec: [5, 10], jump: 1.6, float: true })], true),
  sk("food_ume_onigiri", "すっぱ！", "jump", "すっぱくて飛び上がる。次のジャンプが1.5倍（+15pt）", "+45pt", [{ op: "bigJump", n: 1, mul: 1.5 }, { op: "pts", v: [15, 45] }], true),
  sk("food_hut_curry", "スパイス", "score", "5秒間、スコア ×1.1", "×1.3", [B({ sec: 5, mul: [1.1, 1.3] })]),
  sk("food_onsen_tamago", "ぽかぽか", "weather", "8秒間、雨や雪でも見やすく、スコア ×1.3", "×1.6", [B({ sec: 8, clear: true, mul: [1.3, 1.6] })]),
  sk("food_summit_cup_ramen", "3分待って", "score", "拾ってから3秒後に +100pt（それまでに倒れたら無し）", "+300pt", [{ op: "delay", sec: 3, pts: [100, 300] }], true),
  sk("interior_led_lantern", "足もと照らす", "weather", "20秒間、障害物が光って見やすい", "60秒間", [B({ sec: [20, 60], bright: true })]),
  sk("interior_campfire_set", "キャンプファイヤー", "score", "5秒間、アイテムの点数 +30%", "+60%", [B({ sec: 5, itemMul: [1.3, 1.6] })]),
  sk("interior_hut_fireplace", "暖炉でひと休み", "revive", "1回だけ、倒れても暖炉の前で復活（スコア -10%）", "スコアは減らない", [{ op: "revive", keep: 0.9 }]),
  sk("interior_stargazing_telescope", "流れ星観測", "spawn", "夜なら流れ星の粒が5つ降る（1つ +150pt）。昼なら時計が夜まで進む", "10個", [{ op: "clock", night: [5, 10] }]),
  sk("accessory_bear_bell", "ちりんちりん", "guard", "次に来るカラスか猫を1回追い払う", "3回まで", [{ op: "clear", n: [1, 3], kinds: "crowcat", pts: 10 }]),
  sk("accessory_hiking_backpack", "つめこみ", "score", "次の5個のアイテムが +5pt", "次の10個 +10pt", [{ op: "next", n: [5, 10], add: [5, 10] }]),
  sk("accessory_trekking_poles", "4本足+2", "jump", "5秒間、3段ジャンプのあとにもう1回跳べる", "10秒間", [B({ sec: [5, 10], air: 1 })]),
  sk("accessory_hiking_pin_hat", "バッジ集め", "score", "このおさんぽで拾った山道シリーズの種類数 ×20pt", "×60pt", [{ op: "series", series: "hiking", per: [20, 60] }]),
  sk("other_trail_map_compass", "道しるべ", "guard", "10秒間、障害物が光って見やすく、よけ方がわかる", "20秒間", [B({ sec: [10, 20], bright: true })]),
  sk("other_cairn", "積み石", "score", "拾うたびに石が積み上がり、3つ積むと +300pt（ぶつかって守られると崩れる）", "+900pt", [{ op: "cairn", need: 3, pts: [300, 900] }], true),
  sk("other_sunrise_view", "日の出", "weather", "時計が朝6時になって夜が明け、10秒間スコア ×1.5", "×2", [{ op: "clock", set: 6 * 60 }, B({ sec: 10, mul: [1.5, 2], tint: "255,200,150" })]),
  sk("other_sea_of_clouds", "雲の上", "guard", "10秒間、雲の上を走る。地上の障害物は出ず、空にアイテムが並ぶ", "15秒間", [B({ sec: [10, 15], noSpawn: "ground", tint: "235,240,255" }), { op: "spawn", n: 8, shape: "high" }]),
  sk("other_rock_ptarmigan", "雷鳥のみちびき", "guard", "15秒間、雷鳥が先導して、自動でよけさせてくれる", "25秒間", [B({ sec: [15, 25], auto: true })]),
  // ---------- 雪国シリーズ ----------
  sk("snow_frenchie", "雪国ぐらし", "guard", "15秒間、雪でも見やすく、雪だるま（コーン）に当たっても崩して +100pt", "25秒間", [B({ sec: [15, 25], clear: true, smash: 100, smashKinds: "rock" })]),
  sk("toy_sled", "そりすべり", "jump", "5秒間、のれんや低いカラスにそりでくぐり抜ける", "10秒間", [B({ sec: [5, 10], immune: "low" })]),
  sk("toy_snowman_kit", "雪だるまジャンプ台", "jump", "次のジャンプが雪だるまの上から大ジャンプ（1.5倍）", "3回まで", [{ op: "bigJump", n: [1, 3], mul: 1.5 }], true),
  sk("toy_snowball", "雪合戦", "guard", "前のカラスに雪玉を当てて追い払う（+30pt）", "3羽まで", [{ op: "clear", n: [1, 3], kinds: "crow", pts: 30 }]),
  sk("toy_mini_skis", "すいーっ", "score", "5秒間、速さ1.2倍でアイテムの点数 ×1.3", "10秒間・×1.6", [B({ sec: [5, 10], speed: 1.2, itemMul: [1.3, 1.6] })]),
  sk("food_snow_roasted_sweet_potato", "おいも掘り", "spawn", "地面の中からアイテムが3個飛び出す", "6個", [{ op: "spawn", n: [3, 6], shape: "arc" }]),
  sk("food_oshiruko", "おもちがのびる", "collect", "3秒間、おもちがのびて遠くのアイテムまで拾える", "6秒間", [B({ sec: [3, 6], magnet: 150 })], true),
  sk("food_oden", "はふはふ", "score", "熱くて3秒間ぴょんぴょん小ジャンプが止まらない。そのあと +50pt", "+150pt", [B({ sec: 3, hop: true, endPts: [50, 150] })], true),
  sk("food_hot_chocolate", "ほっと一息", "combo", "コンボ倍率 +1（雪の中ならさらに +1）", "+2（雪なら +3）", [{ op: "combo", add: [1, 2], snow: 1 }]),
  sk("interior_yutanpo", "ぬくぬく", "score", "おさんぽが終わったとき、この回でいちばん点の高かったアイテムをもう一度足す", "3回ぶん", [{ op: "keepBest", times: [1, 3] }]),
  sk("interior_fluffy_blanket", "くるまる", "guard", "5秒以内にぶつかったら、1回だけ毛布にくるまって無傷", "10秒以内", [{ op: "guard", n: 1, sec: [5, 10] }]),
  sk("interior_kerosene_stove", "ストーブの前", "weather", "10秒間、雪や雨がやみ、スコア ×1.3", "20秒間・×1.6", [B({ sec: [10, 20], dry: true, mul: [1.3, 1.6] })]),
  sk("interior_kotatsu", "こたつから出られない", "collect", "3秒間こたつに入って動かない。ほねとアイテムのほうから集まってくる", "5秒間", [B({ sec: [3, 5], stop: true, magnet: 260, wide: true }), { op: "spawn", n: 6, shape: "ring" }], true),
  sk("accessory_knit_hat", "あったか帽子", "guard", "5秒間、カラスに当たらない", "15秒間", [B({ sec: [5, 15], immune: "crow" })]),
  sk("accessory_muffler", "ひらひら", "collect", "5秒間、マフラーのぶんだけアイテムを拾える範囲が広がる", "15秒間", [B({ sec: [5, 15], magnet: 80 })]),
  sk("accessory_mittens", "てぶくろキャッチ", "collect", "取りこぼしたアイテムを5個まで自動で拾う", "10個", [{ op: "miss", n: [5, 10] }]),
  sk("accessory_fluffy_boots", "ふみふみ", "collect", "10秒間、近くのアイテムを吸い寄せる", "20秒間", [B({ sec: [10, 20], magnet: 90 })]),
  sk("other_icicle", "ぽきっ", "guard", "前の障害物1つにつららが落ちて壊れる", "3つ", [{ op: "clear", n: [1, 3], kinds: "hard", pts: 20 }]),
  sk("other_snowflake_ornament", "結晶あつめ", "spawn", "空に結晶の粒が10個並ぶ（1個 +20pt）", "20個", [{ op: "spawn", n: [10, 20], shape: "wave", token: 20 }]),
  sk("other_snow_lantern", "灯り", "weather", "このおさんぽ中、夜のあいだずっとスコア ×1.2", "×1.5", [{ op: "nightMul", mul: [1.2, 1.5] }]),
  sk("other_kamakura", "かまくらで休憩", "revive", "1回だけ、倒れてもかまくらで復活。中でおもちを食べて +500pt", "+1500pt", [{ op: "revive", pts: [500, 1500] }]),
  sk("other_diamond_dust", "きらめく空気", "spawn", "15秒間、きらめきの粒が空から降ってくる（1つ +30pt）", "25秒間", [B({ sec: [15, 25], rain: 4, rainToken: 30, tint: "210,240,255" })]),
  // ---------- 夏まつりシリーズ ----------
  sk("summer_frenchie", "まつりの主役", "spawn", "15秒間、屋台からほねとアイテムが投げこまれる（アイテムは3つに1つ）", "25秒間", [B({ sec: [15, 25], rain: 0.8 })]),
  sk("toy_beach_ball", "ぽーん", "jump", "次のジャンプがビーチボールで大ジャンプ（1.5倍）", "3回まで", [{ op: "bigJump", n: [1, 3], mul: 1.5 }]),
  sk("toy_bug_net", "網でキャッチ", "collect", "5秒間、高いところのアイテムも網で拾える", "15秒間", [B({ sec: [5, 15], wide: true })]),
  sk("food_watermelon", "たね飛ばし", "score", "+25pt。種が3つ飛んで、小さな粒になる（1つ +10pt）", "+75pt・6つ", [{ op: "pts", v: [25, 75] }, { op: "spawn", n: [3, 6], shape: "arc", token: 10 }], true),
  sk("food_ramune", "シュワッ", "guard", "2秒間、シュワっと加速して無敵", "5秒間", [B({ sec: [2, 5], inv: true, speed: 1.25 })]),
  sk("food_popsicle", "キーン", "score", "頭がキーンとして1秒止まる。そのあと +40pt", "+120pt", [B({ sec: 1, stop: true, endPts: [40, 120], label: "キーン" })], true),
  sk("toy_water_gun", "ぴゅー", "guard", "前の水たまりやカラスを水で撃って消す", "3つまで", [{ op: "clear", n: [1, 3], kinds: "puddlecrow", pts: 20 }]),
  sk("food_shaved_ice", "ひんやり", "pace", "5秒間、スピードが0.8倍になる", "10秒間", [B({ sec: [5, 10], speed: 0.8 })]),
  sk("food_somen", "流しそうめん", "spawn", "空中にアイテムが1列に流れてくる（8個）", "16個", [{ op: "spawn", n: [8, 16], shape: "line" }]),
  sk("interior_sudare", "すだれの影", "guard", "10秒間、カラスに当たらない", "20秒間", [B({ sec: [10, 20], immune: "crow" })]),
  sk("accessory_straw_hat", "夏の冒険", "score", "10秒間、このおさんぽで初めて拾う種類のアイテムが +50pt", "+150pt", [B({ sec: 10, fresh: [50, 150] })]),
  sk("accessory_sunglasses", "イケてる", "score", "10秒間、障害物を越えるたび +20pt", "+60pt", [B({ sec: 10, over: [20, 60] })], true),
  sk("other_cotton_candy", "ふわふわ", "jump", "3秒間、ふわっと浮いて空中をおさんぽ", "6秒間", [B({ sec: [3, 6], float: true, air: 2 })]),
  sk("accessory_jinbei", "まつり気分", "score", "このおさんぽ中、夏まつりならスコア ×1.2（ほかの道は ×1.1）", "×1.5（ほかは ×1.2）", [{ op: "runMul", mul: [1.1, 1.2], stage: "summer", stageMul: [1.2, 1.5] }]),
  sk("other_sparkler", "ぱちぱち", "collect", "5秒間、拾うたびに火花が散って、近くのアイテムも1個いっしょに拾う", "10秒間", [B({ sec: [5, 10], spark: true })]),
  sk("other_goldfish_scoop", "すくう！", "spawn", "前に金魚の粒が10匹泳いでくる（1匹 +30pt）", "20匹", [{ op: "spawn", n: [10, 20], shape: "wave", token: 30 }]),
  sk("interior_beach_parasol", "パラソル", "weather", "15秒間、雨がやみ、カラスにも当たらない", "30秒間", [B({ sec: [15, 30], dry: true, immune: "crow" })]),
  sk("toy_fireworks_set", "打ち上げ花火", "spawn", "花火が上がり、ほねとアイテムになって9個降ってくる（アイテムは3つに1つ）", "15個", [{ op: "spawn", n: [9, 15], shape: "sky" }]),
  sk("toy_yoyo_scoop", "ヨーヨー", "score", "次に拾うアイテムが、ヨーヨーみたいに戻ってきてもう1個ぶんになる", "3個まで", [{ op: "next", n: [1, 3], dup: 1 }]),
  sk("toy_bubbles", "しゃぼん", "guard", "次の障害物をシャボン玉で包んで浮かせる", "3つまで", [{ op: "clear", n: [1, 3], kinds: "ground", pts: 15 }]),
  sk("toy_water_balloon", "ぱしゃっ", "guard", "3秒間、猫やハトがびっくりして逃げていく", "8秒間", [B({ sec: [3, 8], repel: "cat" })]),
  sk("toy_watermelon_bat", "スイカ割り", "score", "前の少し高いところに大きなスイカの粒が出る。ジャンプで割ると +200pt", "+600pt", [{ op: "spawn", n: 1, shape: "mid", token: [200, 600] }], true),
  sk("food_grilled_corn", "つぶつぶ", "spawn", "小さな粒が10個ばらまかれる（1個 +5pt）", "25個", [{ op: "spawn", n: [10, 25], shape: "wave", token: 5 }]),
  sk("food_takoyaki", "8個入り", "score", "次の8個のアイテムが +10pt", "+25pt", [{ op: "next", n: 8, add: [10, 25] }]),
  sk("food_melon_soda", "しゅわしゅわ", "score", "5秒間、速さ1.2倍でスコア ×1.5", "10秒間・×2", [B({ sec: [5, 10], speed: 1.2, mul: [1.5, 2] })]),
  sk("food_fruit_punch", "ごちゃまぜ", "spawn", "次に出る5個のレアリティがランダムに入れかわる", "10個", [{ op: "reroll", n: [5, 10] }], true),
  sk("food_hiyashi_chuka", "はじめました", "score", "このおさんぽで最初に拾ったときだけ +100pt（2回目からは +30pt）", "+300pt（2回目から +90pt）", [{ op: "first", first: [100, 300], later: [30, 90] }], true),
  sk("interior_uchiwa", "ぱたぱた", "guard", "5秒間、うちわの風でカラスやハトが逃げていく", "15秒間", [B({ sec: [5, 15], repel: "crow" })]),
  sk("interior_mosquito_coil", "虫よけ", "guard", "20秒間、ハトとカラスが出てこない", "40秒間", [B({ sec: [20, 40], noSpawn: "animals" })]),
  sk("interior_hammock", "ゆらゆら", "pace", "ハンモックでひと休みして、スピードが最初の速さに戻る", "戻したあと5秒間 スコア ×1.5", [{ op: "reset" }, B({ sec: [0, 5], mul: 1.5, label: "ゆらゆら" })]),
  sk("accessory_beach_sandals", "足取り軽く", "jump", "10秒間、ジャンプ1.1倍・空中でもう1回跳べる", "20秒間", [B({ sec: [10, 20], jump: 1.1, air: 1 })]),
  sk("accessory_shell_bracelet", "海の音", "spawn", "10秒間、貝がらの粒が空から降る（1個 +20pt）", "20秒間", [B({ sec: [10, 20], rain: 1.5, rainToken: 20 })]),
  sk("accessory_yukata_kanzashi", "花かんざし", "score", "次の10個のうち、いちばん点の高かったアイテムをもう1個ぶん足す", "2個ぶん", [{ op: "best", n: 10, mul: [2, 3] }]),
  sk("other_lantern", "提灯行列", "weather", "20秒間、提灯で障害物が見やすく、アイテムの点数 +30%", "+80%", [B({ sec: 20, bright: true, itemMul: [1.3, 1.8] })]),
  sk("other_shooting_gallery", "射的", "spawn", "空に景品が3つ並ぶ（SR以上）。ジャンプで取る", "5つ", [{ op: "spawn", n: [3, 5], shape: "high", min: "SR" }], true),
  sk("other_milky_way", "天の川をわたる", "spawn", "15秒間、空に星の粒が降り、2段ジャンプで取り放題（1つ +40pt）", "25秒間", [B({ sec: [15, 25], rain: 3, rainToken: 40, air: 1, tint: "140,150,255" })]),
  // ---------- お寿司シリーズ ----------
  sk("sushi_iwashi", "いわしの群れ", "spawn", "小さないわしの粒が5匹泳いでくる（1匹 +5pt）", "15匹", [{ op: "spawn", n: [5, 15], shape: "wave", token: 5 }]),
  sk("sushi_aji", "あじわい", "score", "+20pt", "+60pt", [{ op: "pts", v: [20, 60] }]),
  sk("sushi_saba", "サバを読む", "score", "+50〜150pt のどれかがランダムでもらえる", "+150〜450pt", [{ op: "randPts", min: [50, 150], max: [150, 450] }], true),
  sk("sushi_maguro", "回遊", "score", "5秒間、スコア ×1.2", "×1.5", [B({ sec: 5, mul: [1.2, 1.5] })]),
  sk("sushi_tamago", "甘いたまご", "combo", "コンボ倍率 +1", "+2", [{ op: "combo", add: [1, 2] }]),
  sk("sushi_salmon", "川のぼり", "jump", "5秒間、ジャンプ力1.3倍", "10秒間", [B({ sec: [5, 10], jump: 1.3 })]),
  sk("sushi_maguro_akami", "赤身の力", "score", "2秒間、スコア ×1.2", "×1.5", [B({ sec: 2, mul: [1.2, 1.5] })]),
  sk("sushi_ika", "いかすみ", "guard", "前の障害物1つを墨でぬりつぶして消す", "3つ", [{ op: "clear", n: [1, 3], kinds: "all", pts: 20 }], true),
  sk("sushi_tako", "8本足", "collect", "5秒間、たこ足でアイテムを拾える範囲が広がる", "10秒間", [B({ sec: [5, 10], magnet: 96 })]),
  sk("sushi_hotate", "貝ガード", "guard", "3秒以内にぶつかったら、1回だけ貝がらで防ぐ", "8秒以内", [{ op: "guard", n: 1, sec: [3, 8] }]),
  sk("sushi_chutoro", "とろける", "score", "5秒間、スコア ×1.5", "10秒間・×2", [B({ sec: [5, 10], mul: [1.5, 2] })]),
  sk("sushi_buri", "出世", "score", "次に拾うアイテムが1ランク出世する", "3個まで", [{ op: "next", n: [1, 3], up: 1 }]),
  sk("sushi_kanpachi", "かんぱーい", "combo", "コンボ ×5 のときに拾うと +200pt", "+600pt", [{ op: "maxCombo", pts: [200, 600] }]),
  sk("sushi_ebi", "えびぞりジャンプ", "jump", "次のジャンプで後ろに反って超大ジャンプ（1.7倍）", "3回まで", [{ op: "bigJump", n: [1, 3], mul: 1.7 }], true),
  sk("sushi_aburi_saba", "炙り", "score", "5秒間、拾ったアイテムが炙られて点数 +20%", "+50%", [B({ sec: 5, itemMul: [1.2, 1.5] })]),
  sk("sushi_otoro", "大トロ", "score", "8秒間、スコア ×2", "×3", [B({ sec: 8, mul: [2, 3] })]),
  sk("sushi_anago", "穴にもぐる", "guard", "3秒間、地面にもぐって全部の障害物をやりすごす", "6秒間", [B({ sec: [3, 6], inv: true })], true),
  sk("sushi_uni", "トゲトゲ", "guard", "10秒間、触れた障害物をトゲで壊す（1つ +40pt）", "20秒間", [B({ sec: [10, 20], smash: 40 })]),
  sk("sushi_shirasu", "しらすの群れ", "spawn", "小さなしらすの粒が30匹降ってくる（1匹 +10pt）", "60匹", [B({ sec: 6, rain: [5, 10], rainToken: 10, label: "しらす" })]),
  sk("sushi_nama_ebi", "ぴちぴち", "jump", "5秒間、自動で小ジャンプし続ける（水たまりは平気）", "10秒間", [B({ sec: [5, 10], hop: true, immune: "puddle" })], true),
  sk("sushi_bincho", "炭火焼き", "score", "10秒間、Nアイテムの点数 ×3", "×6", [B({ sec: 10, itemMul: [3, 6], itemFilter: "N" })]),
  sk("sushi_negishio_maguro", "ネギ塩", "combo", "8秒間、スコア ×1.3。コンボが切れるまでの猶予 +1秒", "×1.6・+3秒", [B({ sec: 8, mul: [1.3, 1.6], comboGrace: [1, 3] })]),
  sk("sushi_engawa", "縁側でひなたぼっこ", "score", "2秒間止まってひなたぼっこ。そのあと5秒間スコア ×2", "×3", [B({ sec: 2, stop: true, label: "ひなたぼっこ" }), B({ sec: 7, mul: [2, 3] })], true),
  sk("sushi_onion_salmon", "玉ねぎはダメ！", "score", "犬に玉ねぎは食べさせない。玉ねぎだけよけてサーモンを食べる。+80pt", "+240pt", [{ op: "pts", v: [80, 240] }], true),
  sk("sushi_mirugai", "みるみる", "guard", "10秒間、低い障害物（コーン・水たまり）に当たらない", "20秒間", [B({ sec: [10, 20], immune: "rock" }), B({ sec: [10, 20], immune: "puddle", label: "みるみる" })]),
  sk("sushi_fugu", "ぷくー", "guard", "5秒間、ふくらんで無敵。体が大きいぶん、アイテムも拾いやすい", "10秒間", [B({ sec: [5, 10], inv: true, big: true, magnet: 80 })], true),
  sk("sushi_kani", "カニばさみ", "guard", "前の障害物3つをハサミでちょきん", "8つ", [{ op: "clear", n: [3, 8], kinds: "all", pts: 20 }]),
  sk("sushi_oomonhata", "岩かげの主", "guard", "10秒間、岩や丸太をすり抜けられる（1つ +100pt）", "20秒間", [B({ sec: [10, 20], smash: 100, smashKinds: "rockbike" })]),
  sk("sushi_unagi", "うなぎのぼり", "combo", "10秒間、コンボ倍率が1上がるたびにスコア倍率が +0.2", "+0.5ずつ", [B({ sec: 10, comboStep: [0.2, 0.5] })]),
  sk("sushi_nodoguro", "高級魚", "spawn", "このおさんぽ中、UR以上のアイテムが出る確率 ×1.3", "×2", [{ op: "rare", mul: [1.3, 2] }]),
  sk("sushi_kazunoko", "子だくさん", "score", "次の3個のアイテムが、それぞれ3個ぶんになる", "5個ぶん", [{ op: "next", n: 3, dup: [2, 4] }]),
  sk("sushi_kuruma_ebi", "はねる車海老", "jump", "15秒間、3段ジャンプができて、近くのアイテムを集める", "25秒間", [B({ sec: [15, 25], air: 1, magnet: 90 })]),
  sk("sushi_akagai", "ぱかっ", "score", "貝が開いて真珠が出る。+150pt", "+450pt", [{ op: "pts", v: [150, 450] }]),
  sk("sushi_torafugu", "てっさ", "spawn", "花の形にほねとアイテムが9個並ぶ（アイテムは3つに1つ）", "15個", [{ op: "spawn", n: [9, 15], shape: "ring" }]),
  sk("sushi_awabi", "岩にはりつく", "guard", "次にぶつかったとき、はりついて耐え、そのまま5秒間無敵", "10秒間", [{ op: "guard", n: 1, after: [5, 10] }]),
  sk("sushi_kue", "幻の大物", "score", "15秒間、アイテムの点数 ×3。終わったときに 拾った数 ×30pt", "25秒間・拾った数 ×60pt", [B({ sec: [15, 25], itemMul: 3, countPer: [30, 60] })]),
];

export const OSANPO_RUN_SKILL_BY_ID: ReadonlyMap<string, OsanpoRunSkill> = new Map(OSANPO_RUN_SKILLS.map((s) => [s.id, s]));

export const OSANPO_RUN_SKILL_MAX_LEVEL = 5;

/** [Lv1, Lv.MAX] を、いまのLvの値にする */
export function skillValue(v: Lv, level: number): number {
  if (typeof v === "number") return v;
  const t = (Math.min(Math.max(level, 1), OSANPO_RUN_SKILL_MAX_LEVEL) - 1) / (OSANPO_RUN_SKILL_MAX_LEVEL - 1);
  return v[0] + (v[1] - v[0]) * t;
}
