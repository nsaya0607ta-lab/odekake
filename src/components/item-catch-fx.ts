/**
 * アイテムキャッチの演出（見た目だけ。点数・出現・時間にはさわらない）。
 * - catchBurst：キャッチした場所で粒がはじけ、点数が浮かぶ（レア度が高いほど派手）
 * - squashBox：段ボールが「ぷにっ」とつぶれて戻る
 * - shakeBoard：うんちなどを取ったとき、画面がぶるっとゆれる
 * どれも要素を足して CSS アニメーションで動かし、終わったら消す（ゲームの毎フレームの処理には入れない）。
 */
import fx from "@/components/item-catch-fx.module.css";

export type FxRarity = "N" | "R" | "SR" | "SSR" | "UR" | "LR" | "MR";

/** レア度ごとの色と、はじける粒の数 */
const RARITY_FX: Record<FxRarity, { color: string; count: number; ring: boolean; stars: boolean }> = {
  N: { color: "#f0b44a", count: 6, ring: false, stars: false },
  R: { color: "#5fb0e8", count: 7, ring: false, stars: false },
  SR: { color: "#e9b232", count: 10, ring: true, stars: true },
  SSR: { color: "#b170dc", count: 12, ring: true, stars: true },
  UR: { color: "#e2463b", count: 14, ring: true, stars: true },
  LR: { color: "#e6b43c", count: 16, ring: true, stars: true },
  MR: { color: "#5a6eff", count: 16, ring: true, stars: true },
};
const BAD_COLOR = "#8a6a55";

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);

const removeWhenDone = (el: HTMLElement) => el.addEventListener("animationend", () => el.remove(), { once: true });

/**
 * キャッチした場所（ボードに対する %）で、粒をはじけさせて点数を浮かべる。
 * bad は、うんちなど取ってはいけないものを取ったとき（茶色の粒・赤い点数）。
 */
export function catchBurst(layer: HTMLElement | null, { x, y, points, rarity, bad = false }: { x: number; y: number; points: number; rarity: FxRarity | null; bad?: boolean }) {
  if (!layer) return;
  const style = RARITY_FX[rarity ?? "N"];
  const color = bad ? BAD_COLOR : style.color;
  const frag = document.createDocumentFragment();
  const reduced = prefersReducedMotion();

  if (!reduced) {
    const count = bad ? 8 : style.count;
    for (let i = 0; i < count; i += 1) {
      const p = document.createElement("span");
      const star = !bad && style.stars && i % 2 === 0;
      p.className = star ? `${fx.particle} ${fx.star}` : fx.particle!;
      // 上向き（はこから飛び出す向き）を中心に、扇形に散らす
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.25;
      const dist = 26 + Math.random() * (bad ? 22 : 30 + style.count * 2);
      const size = star ? 10 + Math.random() * 6 : 4 + Math.random() * 5;
      p.style.cssText = `left:${x}%;top:${y}%;--dx:${(Math.cos(angle) * dist).toFixed(1)}px;--dy:${(Math.sin(angle) * dist).toFixed(1)}px;--c:${color};--size:${size.toFixed(1)}px;animation-delay:${(Math.random() * 40).toFixed(0)}ms`;
      removeWhenDone(p);
      frag.appendChild(p);
    }
    if (style.ring && !bad) {
      const ring = document.createElement("span");
      ring.className = fx.ring!;
      ring.style.cssText = `left:${x}%;top:${y}%;--c:${color}`;
      removeWhenDone(ring);
      frag.appendChild(ring);
    }
  }

  if (points !== 0) {
    const pop = document.createElement("span");
    const big = !bad && (rarity === "UR" || rarity === "LR" || rarity === "MR" || Math.abs(points) >= 300);
    pop.className = big ? `${fx.pop} ${fx.popBig}` : fx.pop!;
    pop.textContent = `${points > 0 ? "+" : ""}${points.toLocaleString("ja-JP")}`;
    pop.style.cssText = `left:${x}%;top:${y}%;--c:${points < 0 ? "#d24a3c" : bad ? BAD_COLOR : style.color}`;
    removeWhenDone(pop);
    frag.appendChild(pop);
  }

  layer.appendChild(frag);
}

/** 段ボールが「ぷにっ」とつぶれて戻る（下を軸に） */
export function squashBox(box: HTMLElement | null | undefined, strong = false) {
  if (!box || prefersReducedMotion() || typeof box.animate !== "function") return;
  const s = strong ? 1.6 : 1;
  box.style.transformOrigin = "50% 100%";
  box.animate(
    [
      { transform: "scale(1, 1)" },
      { transform: `scale(${1 + 0.08 * s}, ${1 - 0.12 * s})` },
      { transform: `scale(${1 - 0.04 * s}, ${1 + 0.05 * s})` },
      { transform: "scale(1, 1)" },
    ],
    { duration: 320, easing: "ease-out" },
  );
}

/** 画面がぶるっとゆれる */
export function shakeBoard(board: HTMLElement | null) {
  if (!board || prefersReducedMotion() || typeof board.animate !== "function") return;
  board.animate(
    [
      { transform: "translate(0, 0)" },
      { transform: "translate(-6px, 2px)" },
      { transform: "translate(5px, -3px)" },
      { transform: "translate(-4px, 1px)" },
      { transform: "translate(3px, 2px)" },
      { transform: "translate(-1px, -1px)" },
      { transform: "translate(0, 0)" },
    ],
    { duration: 380, easing: "ease-out" },
  );
}

export const fxClasses = fx;
