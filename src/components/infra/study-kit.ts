/**
 * 勉強部屋の「設定カード」の共通の形（LDAP・メールサーバーで同じ）。
 * React にも DOM にも依存しない（node でも動く。scripts/fuzz-infra.mjs で確かめる）。
 *
 * どのカードも同じかたち：
 *   1. まず **設定なし** で、本物のコマンドを打ってみる
 *   2. **設定を入れる**
 *   3. **設定あり** で、同じことをもう一度
 *   4. **落とし穴**（書き忘れ・順番・入れる前からのデータ など）
 *   5. 見くらべる → わかったこと → クイズ → 自由に試す
 */
import type { GlyphId } from "./glyphs";

/** learn＝ことばを覚える（はじめに）、off＝設定なしの実演、apply＝設定を入れる、on＝設定ありの実演、trap＝落とし穴 */
export type Phase = "learn" | "off" | "apply" | "on" | "trap";

export type StudyStepOf<L, R, H extends string, P extends string> = {
  say: string;
  host: H;
  /** ボタンで動かすコマンド（本物の形） */
  cmd: string;
  phase: Phase;
  /** cmd の前に動かすコマンド（設定を変える など。ターミナルにも出す） */
  pre?: { host: H; cmd: string };
  /** cmd を動かす前にやること（設定ファイルの書きかえなど、コマンドでないこと） */
  before?: (lab: L) => void;
  /** before でやったことの見出し（ターミナルに「⚙ …を書きかえた」と出す） */
  beforeNote?: string;
  /** 思ったとおりの結果か（ちがえば retry でもう一度） */
  ok?: (r: R) => boolean;
  retry?: string;
  learn: string | ((r: R) => string);
  /** 返事といっしょに開くとよいパネル */
  show?: P[];
  /** 「サーバーの中」で先に見せる説明の目じるし（trace の ref。なければ knob.ref） */
  why?: string;
  /** apply のステップで、cmd が「効き目を見るだけ」のとき false（見くらべる・自由に試すで設定を入れるときは動かさない） */
  prep?: false;
};

export type KnobOf<L> = {
  /** 設定の目じるし（trace の ref と合わせる） */
  ref: string;
  title: string;
  /** どこの設定か */
  where: string;
  off: string;
  on: string;
  /** いまの設定が「あり」か（スイッチに出す） */
  isOn: (lab: L) => boolean;
};

export type Quiz = { q: string; choices: string[]; answer: number; explain: string };
export type CompareRow = { head: string; off: string; on: string };

export type StudyCardOf<L, R, H extends string, P extends string> = {
  id: string;
  /** 0 は はじめに */
  no: number;
  chapter: number;
  icon: GlyphId;
  color: string;
  title: string;
  sub: string;
  /** はじめの説明（フレブル先生） */
  intro: string;
  analogy?: string;
  /** 学ぶ設定（はじめに には、ない） */
  knob?: KnobOf<L>;
  /** シナリオを作る（毎回まっさらから） */
  build: (seed: number) => L;
  steps: StudyStepOf<L, R, H, P>[];
  /** 見くらべる：同じコマンドを、設定なし・ありのまっさらな状態で1回ずつ動かす */
  probe?: { host: H; cmd: string; note?: string; label?: (r: R) => string };
  compare?: CompareRow[];
  /** ことばのまとめ（はじめに） */
  words?: { term: string; mean: string }[];
  /** 自由に試すで出す、ためしてみたいコマンド */
  tries: { label: string; host: H; cmd: string }[];
  summary: string[];
  quiz: Quiz;
};

/** 設定を入れるために動かしたこと（コマンド、または設定ファイルの書きかえ） */
export type PrepRunOf<R, H extends string> = { host: H; cmd: string; run: R } | { note: string };

/** 文の中の **ことば** を分ける */
export const splitStudy = (text: string) => text.split("**");

/**
 * まっさらな状態を作る。on なら、設定を入れるステップ（apply）だけを順に動かして「設定あり」にする
 * （prep: false のステップは、設定ファイルの書きかえ（before）だけ）。見くらべる・自由に試すで使う。
 */
export function prepareWith<L extends { run: (host: H, cmd: string) => R }, R, H extends string, P extends string>(
  card: StudyCardOf<L, R, H, P>,
  on: boolean,
  seed: number,
): { lab: L; runs: PrepRunOf<R, H>[] } {
  const lab = card.build(seed);
  const runs: PrepRunOf<R, H>[] = [];
  if (on)
    for (const st of card.steps) {
      if (st.phase !== "apply") continue;
      if (st.before) {
        st.before(lab);
        if (st.beforeNote) runs.push({ note: st.beforeNote });
      }
      if (st.pre) runs.push({ host: st.pre.host, cmd: st.pre.cmd, run: lab.run(st.pre.host, st.pre.cmd) });
      if (st.prep !== false) runs.push({ host: st.host, cmd: st.cmd, run: lab.run(st.host, st.cmd) });
    }
  return { lab, runs };
}
