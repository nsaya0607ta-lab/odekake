"use client";

/**
 * 旧リアクションAPI互換用。
 * ゲーム画面では犬リアクションを表示しない方針に変更したため、描画は行わない。
 */
export type DogReactionKind = "idle" | "sad" | "happy" | "veryHappy" | "spare" | "strike" | "turkey";

export function DogReaction(_: { reaction: DogReactionKind }) {
  return null;
}
