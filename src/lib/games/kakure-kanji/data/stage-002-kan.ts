import type { Stage } from "../types";

/**
 * ステージ2「漢」。日本の13画の筆順で独自に描いた筆画。
 * 確認資料: https://kakijun.jp/page/1377200.html
 * 12画目は口の中から下へ続く1本の左払い。途中で切って「中」にはしない。
 * 右上の十は5画目・6画目のどちらでも取れる。横画4本から二・三も取れる。
 */
export const STAGE_002_KAN: Stage = {
  id: "s002-kan",
  number: 2,
  kanji: "漢",
  reading: "カン",
  difficulty: "上級",
  structure: "左はさんずい。右には、くさかんむり・口・二・人の形がある。下の払いは口の中からつながる1本の線なので、切り分けずにえらぼう。",
  strokes: [
    { id: 1, kind: "点", d: "M13 17 C17 19 21 22 23 26", width: 5.2 },
    { id: 2, kind: "点", d: "M9 40 C13 41 18 44 20 47", width: 5.2 },
    { id: 3, kind: "提", d: "M10 84 C13 83 18 73 23 62", width: 5.4 },
    { id: 4, kind: "横", d: "M33 20 C49 19.5 70 18 87 18", width: 4.6 },
    { id: 5, kind: "縦", d: "M47 10 L49 27", width: 4.8 },
    { id: 6, kind: "縦", d: "M69 8 L67 25", width: 4.8 },
    { id: 7, kind: "縦", d: "M39 33 L41 48", width: 4.6 },
    { id: 8, kind: "横折", d: "M39 33 L78 30 L76 46", width: 4.6 },
    { id: 9, kind: "横", d: "M41 48 L76 46", width: 4.6 },
    { id: 10, kind: "横", d: "M39 58 L80 55.5", width: 4.6 },
    { id: 11, kind: "横", d: "M32 71 L87 68", width: 4.8 },
    { id: 12, kind: "左払い", d: "M58 32 C59 46 60 65 56 75 C52 83 42 89 31 92", width: 5.2 },
    { id: 13, kind: "右払い", d: "M58 70 C67 78 77 86 92 90", width: 5.4 },
  ],
  answers: [
    {
      char: "一", readings: ["イチ", "ひと"], meaning: "ひとつ", rule: "strokes",
      strokeSets: [[4], [9], [10], [11]], tier: 1, grade: 1,
      evidence: "4・9・10・11画目はそれぞれ独立した横画で、どの1本でも一になる。8画目は折れた1画なので、横の部分だけを取り出すことはできない。",
      partHint: "右にある横画を1本だけえらぶよ",
      verification: { status: "verified", note: "日本の13画の筆順で、独立した横画4本を照合。折れた画は除外。" },
    },
    {
      char: "二", readings: ["ニ", "ふた"], meaning: "ふたつ", rule: "loose",
      strokeSets: [[4, 9], [4, 10], [4, 11], [9, 10], [9, 11], [10, 11]], tier: 1, grade: 1,
      evidence: "右側の横画4本から、上下にはなれた2本をえらぶ。どの組も横の位置が重なり、長さの比率だけを見立てると二になる。",
      partHint: "右の横画を2本だけえらぶよ",
      verification: { status: "verified", note: "4本から2本を選ぶ6通りを、横の重なり・上下の順序で確認。" },
    },
    {
      char: "三", readings: ["サン", "み"], meaning: "みっつ", rule: "loose",
      strokeSets: [[4, 9, 10], [4, 9, 11], [4, 10, 11], [9, 10, 11]], tier: 2, grade: 1,
      evidence: "右側の横画4本から3本をえらぶ。横の位置が重なった3本が上下にならび、三に見立てられる。",
      partHint: "右の横画を3本だけえらぶよ",
      verification: { status: "verified", note: "4本から3本を選ぶ4通りを確認。口の上辺は折れた画なので含めない。" },
    },
    {
      char: "十", readings: ["ジュウ", "とお"], meaning: "とお・じゅう", rule: "loose",
      strokeSets: [[4, 5], [4, 6]], tier: 2, grade: 1,
      evidence: "くさかんむりの横画と、それを横切る短い縦画を1本えらぶ。5画目でも6画目でも十に見立てられる。",
      partHint: "右上の横画と、それを横切る短い線だよ",
      verification: { status: "verified", note: "横1本・縦1本。両方の縦画が横画の上下に突き出して交わることを確認。" },
    },
    {
      char: "口", readings: ["コウ", "くち"], meaning: "くち", rule: "component",
      strokeSets: [[7, 8, 9]], tier: 1, grade: 1,
      evidence: "右側の四角い部分、7〜9画目をそのままえらぶと口になる。中を通る12画目はえらばない。",
      partHint: "右のまんなかにある四角い部品だよ",
      verification: { status: "verified", note: "縦・横折・横の3画。四角のつながりと日本の筆順を照合。" },
    },
    {
      char: "人", readings: ["ジン", "ニン", "ひと"], meaning: "ひと", rule: "component",
      strokeSets: [[12, 13]], tier: 2, grade: 1,
      evidence: "12画目の左払いと、そこから右下へ分かれる13画目をえらぶと人になる。上でつながるので、はなれた2本の八とは区別する。",
      partHint: "下で左右に分かれる2本だよ",
      verification: { status: "verified", note: "左払い・右払いの2画。13画目が12画目に接し、左払いがその上にも続く人の形。" },
    },
    {
      char: "大", readings: ["ダイ", "タイ", "おお"], meaning: "おおきい", rule: "loose",
      strokeSets: [[11, 12, 13]], tier: 2, grade: 1,
      evidence: "12画目の左払いは11画目の横画より上へ突き出し、横画の近くで13画目の右払いと分かれる。横画と左右の払い3画を、そのまま大として取り出せる。",
      partHint: "左右の払いに、下の長い横画を足すよ",
      verification: { status: "verified", note: "横・左払い・右払いの3画。左払いの上端y32は横画のy68〜71より上にあり、大に必要な上への突き出しと払いの分岐を確認。" },
    },
    {
      char: "夫", readings: ["フ", "フウ", "おっと"], meaning: "おっと", rule: "loose",
      strokeSets: [[10, 11, 12, 13]], tier: 3, grade: 4,
      evidence: "下の大の形に10画目の横画を足すと夫に見立てられる。左払いは上の横画より上に突き出すので、天とは区別する。",
      partHint: "大の形に、その上の横画を足すよ",
      verification: { status: "verified", note: "横2本・左払い・右払いの4画。左払いが上の横画を越える夫の配置を確認。" },
    },
    {
      char: "汁", readings: ["ジュウ", "しる"], meaning: "しる・液体", rule: "loose",
      strokeSets: [[1, 2, 3, 4, 5], [1, 2, 3, 4, 6]], tier: 3, grade: null,
      evidence: "左のさんずい3画と右上の十2画をえらぶ。十が小さく上に寄るが、左右の部品の大きさの比率を問わない見立てでは汁になる。",
      partHint: "左のさんずいに、右上の十を組み合わせるよ",
      verification: { status: "verified", note: "氵+十の5画を2通りで照合。小学校の学年別漢字配当表にはない常用漢字なのでシークレット。" },
    },
  ],
  nearMisses: [
    { char: "天", reading: "テン（あめ）", category: "shape", reason: "天では左払いが一番上の横画より上に出ません。漢の12画目は口の中から下へ続く1画なので、途中で切って天にすることはできません。" },
    { char: "中", reading: "チュウ（なか）", category: "shape", reason: "四角を通る12画目は、下で左へ長くはらう1本の線です。中のまっすぐな縦画にするために、途中で切ったり向きを変えたりはできません。" },
    { char: "八", reading: "ハチ（やっつ）", category: "position", reason: "下の左右の払いは途中でくっついていて、人の形です。八にするには左右の2本がはなれている必要があります。" },
    { char: "日", reading: "ニチ（ひ）", category: "position", reason: "口の中には横画がありません。近くの独立した横画は四角の外にあるので、動かして日にはできません。" },
    { char: "氵", reading: "さんずい", category: "radical", reason: "さんずいだけの形は部首なので答えにはしません。右上の十と組み合わせた汁なら、単独の漢字になります。" },
    { char: "艹", reading: "くさかんむり", category: "radical", reason: "くさかんむりだけの形は部首なので答えにはしません。その中の交わる2本を選んだ十なら答えになります。" },
  ],
  reward: { coins: 55, exp: 80, replayCoins: 10, replayExp: 20 },
  verification: { status: "verified", checkedOn: "2026-10-17", note: "日本の13画の筆順・教科書体と独自描画を照合。教育漢字8字とシークレット汁の画数・本数・向き・接続を確認。横画の組は全通り登録し、天・中・八・日と区別。" },
};
