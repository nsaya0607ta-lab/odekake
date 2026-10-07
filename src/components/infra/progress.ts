/**
 * アプリ「インフラ」の進み具合（この端末に覚える）。
 * ★の数・いちばんよかった成績・クイズに正解したか・説明を見たか・音のオン／オフ。
 */
import type { PartKind } from "./model";
import { STAGES } from "./stages";

export type Best = { success: number; latency: number; cost: number };

export type Progress = {
  stars: Record<string, number>;
  best: Record<string, Best>;
  quiz: Record<string, boolean>;
  seenIntro: Record<string, boolean>;
  sound: boolean;
};

const KEY = "odekake_infra_progress_v1";

export const emptyProgress = (): Progress => ({ stars: {}, best: {}, quiz: {}, seenIntro: {}, sound: true });

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export function loadProgress(): Progress {
  try {
    const raw = obj(JSON.parse(window.localStorage.getItem(KEY) ?? "null"));
    const p = emptyProgress();
    for (const [k, v] of Object.entries(obj(raw.stars))) if (typeof v === "number" && v >= 0 && v <= 3) p.stars[k] = Math.floor(v);
    for (const [k, v] of Object.entries(obj(raw.best))) {
      const b = obj(v);
      if (typeof b.success === "number" && typeof b.latency === "number" && typeof b.cost === "number") p.best[k] = { success: b.success, latency: b.latency, cost: b.cost };
    }
    for (const [k, v] of Object.entries(obj(raw.quiz))) if (v === true) p.quiz[k] = true;
    for (const [k, v] of Object.entries(obj(raw.seenIntro))) if (v === true) p.seenIntro[k] = true;
    if (raw.sound === false) p.sound = false;
    return p;
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(p: Progress) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // 覚えられなくても、この画面のあいだはそのまま遊べる
  }
}

/** そのステージを遊べるか（ひとつ前のステージをクリアしていれば） */
export function isUnlocked(p: Progress, index: number): boolean {
  if (index <= 0) return true;
  const prev = STAGES[index - 1];
  return Boolean(prev && (p.stars[prev.id] ?? 0) >= 1);
}

export const isCleared = (p: Progress, id: string) => (p.stars[id] ?? 0) >= 1;

/** 図鑑に入っている用語 */
export function unlockedTerms(p: Progress): Set<string> {
  const out = new Set<string>();
  for (const s of STAGES) if (isCleared(p, s.id)) for (const t of s.terms) out.add(t);
  return out;
}

/** ラボで使えるパーツ（クリアしたステージに出てきたもの。サーバーははじめから） */
export function unlockedParts(p: Progress): Set<PartKind> {
  const out = new Set<PartKind>(["app"]);
  for (const s of STAGES) {
    if (!isCleared(p, s.id)) continue;
    for (const k of s.newParts) out.add(k);
    for (const f of s.fixed) out.add(f.kind);
  }
  return out;
}

export const totalStars = (p: Progress) => STAGES.reduce((sum, s) => sum + (p.stars[s.id] ?? 0), 0);
