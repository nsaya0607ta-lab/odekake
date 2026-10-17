import type { Stage } from "../types";

/**
 * ステージ3「称」。日本の10画の筆順で独自に描いた筆画。
 * 確認資料: https://kakijun.jp/page/10173200.html
 * 7画目は折れない横画。中国簡体字の「尔」の横鉤とは区別する。
 * のぎへんの5画目は短い点。八は、左右に開いて離れる2画として見立てる。
 */
export const STAGE_003_SHOU: Stage = {
  id: "s003-shou",
  number: 3,
  kanji: "称",
  reading: "ショウ",
  difficulty: "上級",
  structure: "左は禾（のぎへん）。その中には千や木がある。右下は小で、その上の横画と組み合わせた形もさがせる。",
  strokes: [
    { id: 1, kind: "左払い", d: "M42 13 C35 19 24 24 15 26", width: 4.8 },
    { id: 2, kind: "横", d: "M10 40 L43 37", width: 4.8 },
    { id: 3, kind: "縦", d: "M29 23 L29 90", width: 5.2 },
    { id: 4, kind: "左払い", d: "M29 39 C27 52 20 65 9 75", width: 5 },
    { id: 5, kind: "点", d: "M34 49 C38 52 41 56 44 60", width: 4.8 },
    { id: 6, kind: "左払い", d: "M63 11 C61 25 55 37 45 47", width: 5.2 },
    { id: 7, kind: "横", d: "M58 34 L88 31", width: 4.8 },
    { id: 8, kind: "縦鉤", d: "M70 33 L70 86 L65 81", width: 5.2 },
    { id: 9, kind: "左払い", d: "M57 52 C56 63 51 70 43 76", width: 5 },
    { id: 10, kind: "点", d: "M82 52 C87 58 92 70 93 76", width: 5.2 },
  ],
  answers: [
    {
      char: "一", readings: ["イチ", "ひと"], meaning: "ひとつ", rule: "strokes",
      strokeSets: [[2], [7]], tier: 1, grade: 1,
      evidence: "左の2画目、または右の7画目の横画を1本えらぶと一になる。日本の称の7画目は、折れない横画。",
      partHint: "左か右にある横画を1本えらぶよ",
      verification: { status: "verified", note: "日本の筆順で独立した横画2本を照合。7画目を中国の字形の横鉤にしない。" },
    },
    {
      char: "十", readings: ["ジュウ", "とお"], meaning: "とお・じゅう", rule: "strokes",
      strokeSets: [[2, 3]], tier: 1, grade: 1,
      evidence: "のぎへんの横画と縦画、2・3画目が交わって十になる。",
      partHint: "左で交わっている横と縦の2本だよ",
      verification: { status: "verified", note: "横・縦の2画。縦画が横画の上下に出て交わることを確認。" },
    },
    {
      char: "千", readings: ["セン", "ち"], meaning: "せん", rule: "strokes",
      strokeSets: [[1, 2, 3]], tier: 2, grade: 1,
      evidence: "のぎへんの最初の3画をえらぶと、十の上に短い左払いが付いた千になる。",
      partHint: "左の十に、一番上の払いを足すよ",
      verification: { status: "verified", note: "左払い・横・縦の3画。上の払いと縦画の接続を照合。" },
    },
    {
      char: "木", readings: ["モク", "ボク", "き"], meaning: "き", rule: "component",
      strokeSets: [[2, 3, 4, 5]], tier: 1, grade: 1,
      evidence: "のぎへんから一番上の払いを外した2〜5画目が木の形。右下が点になった、偏の中の木の形をそのまま取り出す。",
      partHint: "左の部品から、一番上の払いを外すよ",
      verification: { status: "verified", note: "横・縦・左払い・点の4画。木が偏で点になる部品字形を照合。" },
    },
    {
      char: "八", readings: ["ハチ", "や"], meaning: "やっつ", rule: "loose",
      strokeSets: [[4, 5], [4, 10], [9, 10]], tier: 3, grade: 1,
      evidence: "のぎへんの左右4・5画目、小の左右9・10画目、または4・10画目をえらぶ。2本が離れて左下と右下へ開くので、右の画が短い点でも八に見立てる。",
      partHint: "のぎへんの左右か、小の左右の2本をえらぶよ。左右をまたぐ取り方もあるよ",
      verification: { status: "verified", note: "左下へ向かう画と右下へ向かう画の3組。線を動かさず、2本が接せず左右へ開く八の配置を確認。" },
    },
    {
      char: "小", readings: ["ショウ", "ちい"], meaning: "ちいさい", rule: "component",
      strokeSets: [[8, 9, 10]], tier: 1, grade: 1,
      evidence: "右下の8〜10画目がそのまま小になる。中央のまっすぐな縦鉤と、左右のはなれた2画を選ぶ。",
      partHint: "右下にある3画の部品だよ",
      verification: { status: "verified", note: "縦鉤・左払い・点の3画と、左右が中央からはなれる配置を照合。" },
    },
    {
      char: "丁", readings: ["チョウ", "テイ"], meaning: "順序や町の区画を表す字", rule: "strokes",
      strokeSets: [[7, 8]], tier: 2, grade: 3,
      evidence: "右の横画7画目と、そこから下りてはねる8画目をえらぶと丁になる。小の左右の画はえらばない。",
      partHint: "右の横画と、その下の長いはねだけをえらぶよ",
      verification: { status: "verified", note: "横・縦鉤の2画。縦鉤の上端が横画に接することを確認。" },
    },
    {
      char: "下", readings: ["カ", "ゲ", "した"], meaning: "した", rule: "loose",
      strokeSets: [[7, 8, 10]], tier: 3, grade: 1,
      evidence: "右の横画と縦鉤、右側の点をえらぶと下に見立てられる。まっすぐな縦画の小さなはねの有無だけを問わない。左側の払いは選ばない。",
      partHint: "右で丁の形に、右側の点を足すよ",
      verification: { status: "verified", note: "横・縦・点の3画を、縦と縦鉤のはねの有無だけ許容して照合。点が横画の下・縦画の右にある。" },
    },
    {
      char: "禾", readings: ["カ", "のぎ"], meaning: "いね・穀物の穂", rule: "component",
      strokeSets: [[1, 2, 3, 4, 5]], tier: 2, grade: null, rare: true,
      evidence: "左側ののぎへん5画をそのままえらぶと禾になる。禾は部首名だけでなく、いねや穀物を表す単独の漢字でもある。",
      partHint: "左の部品を全部えらぶよ",
      verification: { status: "verified", note: "禾の5画と部品構造を照合。小学校の学年別漢字配当表にない字なのでシークレット。" },
    },
    {
      char: "卜", readings: ["ボク", "うらなう"], meaning: "うらなう", rule: "strokes",
      strokeSets: [[3, 5]], tier: 3, grade: null, rare: true,
      evidence: "のぎへんから、縦画3画目と、その右にある短い点5画目をえらぶ。秋や想から取り出す卜と同じ、縦と点の2画になる。",
      partHint: "左の部品の、長い縦線と右の短い点だけをえらぶよ",
      verification: { status: "verified", note: "縦・点の2画。点が縦画の右側にある卜の配置を確認。" },
    },
  ],
  nearMisses: [
    { char: "二", reading: "ニ（ふたつ）", category: "position", reason: "独立した横画は2本ありますが、左下と右上にはなれていて横の位置が重なりません。線を動かして二にすることはできません。" },
    { char: "人", reading: "ジン（ひと）", category: "missing", reason: "右下の画は短い点で、左払いとも離れています。2本がつながる人にはせず、離れて左右に開く八として見立てます。" },
    { char: "不", reading: "フ（否定する字）", category: "position", reason: "右下の小の左払いは、上の横画からはなれた位置にあります。不にするには左払いの始まる位置を動かす必要があるため、答えにしません。" },
    { char: "少", reading: "ショウ（すくない）", category: "position", reason: "少では小の下に長い左払いが付きます。称の追加の左払いは上や左にあり、小の下にはないので作れません。" },
    { char: "丿", reading: "の（部首）", category: "radical", reason: "払い1本だけの丿は部首の形なので答えにしません。左の5画を全部えらぶ禾は、単独の漢字なので答えになります。" },
  ],
  reward: { coins: 55, exp: 80, replayCoins: 10, replayExp: 20 },
  verification: { status: "verified", checkedOn: "2026-10-17", note: "日本の10画の筆順・教科書体と独自描画を照合。教育漢字8字とシークレット禾・卜。八は短い右下の画も含め、離れて左右に開く3組を認める。卜は別の2画の組として維持。線の移動・切断はしない。" },
};
