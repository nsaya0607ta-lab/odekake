/**
 * かくれ漢字（漢字発見パズル）の問題データの型。
 * 問題データ（data/）とゲームの処理（judge.ts・engine.ts）はこの型だけでつながる。
 * くわしい決まりは docs/kakure-kanji.md。
 */

/** 筆画の種類（日本の楷書の呼び方）。構造データの照合に使う */
export type StrokeKind =
  | "横" // よこ画
  | "縦" // たて画
  | "左払い" // ノ
  | "右払い"
  | "点" // 丶
  | "横折" // 𠃍（口の右上の角）
  | "横折鉤" // 𠃌（はね付きの角）
  | "斜め鉤" // 戈の長い斜めのはね
  | "臥鉤" // 心の底の、ねかせたはね
  | "縦鉤" // 亅
  | "縦曲がり"; // 七の2画目（たてにおりて右へまがる）

export type Stroke = {
  /** 書き順の番号（1から） */
  id: number;
  kind: StrokeKind;
  /** viewBox 0 0 100 100 の SVG path。見た目と、タップ・なぞりの当たり判定（線からの距離）に使う */
  d: string;
  /** 線の太さ（viewBox の単位） */
  width?: number;
};

/**
 * 答えの取り出し方。
 * - component: 部品をそのまま取り出す（例：感 → 心）
 * - strokes: 筆画をえらんで取り出す。形と位置関係はそのまま（例：感 → 戈）
 * - loose: 見立て。線の長さ・比率・曲がりぐあい・はねの有無は問わないが、線の本数・向き（↙か↘か）・
 *   まがるかどうか・交わる／つく／はなれる・上下左右の位置関係は守る（例：感の2画目と7画目 → 八）
 */
export type ExtractRule = "component" | "strokes" | "loose";

export type Difficulty = "初級" | "中級" | "上級" | "超上級" | "達人";

export type Answer = {
  char: string;
  /** 読み（音読み・訓読み）。ヒントにも使う */
  readings: string[];
  /** 意味のひとこと */
  meaning: string;
  rule: ExtractRule;
  /** 使う筆画（Stroke.id）。取り出し方が何通りかあるときは全部書く。1つ目を絵の説明に使う */
  strokeSets: number[][];
  /** 構造上の根拠（なぜ取り出せるか） */
  evidence: string;
  /** 見つけやすさ 1=やさしい 2=ふつう 3=むずかしい */
  tier: 1 | 2 | 3;
  /**
   * 小学校で習う学年（教育漢字の配当学年 1〜6）。小学校で習わない字は null で、シークレット枠になる。
   * クリアに必要なのは学年のある字だけ。シークレットはクリアのあとでもさがせる、おまけの難しい字。
   */
  grade: 1 | 2 | 3 | 4 | 5 | 6 | null;
  /** 常用漢字表に無い字（ふだん見かけない字）。表示に「めずらしい字」と出す */
  rare?: boolean;
  /** ヒント「一部を表示」で見せる説明 */
  partHint: string;
  /**
   * 検証のようす。verified 以外は判定に使わない（不確かな字を正解にしない）。
   * reviewer には誰がどう確かめたかを書く。
   */
  verification: { status: "verified" | "pending"; note: string };
};

/** 似ているけれど答えにならない字（解説で、なぜ作れないかを出す） */
export type NearMiss = {
  char: string;
  reading: string;
  /**
   * - shape: 字形がちがう（点と横画、長さの比率など）
   * - position: 筆画はあるが位置関係がちがう
   * - missing: 必要な筆画が無い
   * - radical: 部首の形で、単独の漢字としては扱わない
   */
  category: "shape" | "position" | "missing" | "radical";
  reason: string;
};

export type Stage = {
  id: string;
  /** 表示するステージ番号 */
  number: number;
  /** 出題漢字 */
  kanji: string;
  reading: string;
  difficulty: Difficulty;
  /** 出題漢字の筆画（書き順どおり） */
  strokes: Stroke[];
  /** 部品の分け方（解説に出す） */
  structure: string;
  answers: Answer[];
  nearMisses: NearMiss[];
  reward: { coins: number; exp: number; replayCoins: number; replayExp: number };
  /** 問題全体の検証のようす */
  verification: { status: "verified" | "pending"; checkedOn: string; note: string };
};
