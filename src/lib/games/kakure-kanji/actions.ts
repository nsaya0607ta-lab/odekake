import { z } from "zod";
import { findStage, STAGES } from "./data/index";
import { applyHint, canUseHint, HINTS, newRound, submit } from "./engine";
import { buyHint, claimLoginBonus, completeStage, defaultSave, japanDate, parseSave, reconcileSave, recordAnswers, recordSecret, saveRound, skipStage, type AchievementId, type ClearReward, type SaveData } from "./progress";

export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("initialize"), legacy: z.unknown().optional() }),
  z.object({ type: z.literal("login") }),
  z.object({ type: z.literal("start"), stageId: z.string().max(40), retry: z.boolean().optional() }),
  z.object({ type: z.literal("submit"), stageId: z.string().max(40), strokes: z.array(z.number().int().min(1).max(40)).max(40) }),
  z.object({ type: z.literal("hint"), stageId: z.string().max(40), answer: z.string().max(2), kind: z.enum(["reading", "strokes", "part", "reveal"]) }),
  z.object({ type: z.literal("skip"), stageId: z.string().max(40) }),
  z.object({ type: z.literal("settings"), settings: z.object({ sound: z.boolean(), theme: z.enum(["system", "light", "dark"]) }) }),
  z.object({ type: z.literal("reset") }),
]);
export type KanjiAction = z.infer<typeof actionSchema>;
export type KanjiSnapshot = { save: SaveData | null; balance: number; revision: number };
export type KanjiEvent = { outcome?: ReturnType<typeof submit>; reward?: ClearReward | null; secretCoins?: number; unlocked?: AchievementId[]; bonus?: { coins: number; streak: number } | null };
export type KanjiResponse = { snapshot: KanjiSnapshot; event: KanjiEvent; replayed?: boolean };

/** コインの額・時刻・正解はサーバーが計算する。クライアントは操作だけを送る。 */
export function applyKanjiAction(stored: SaveData | null, balance: number, action: KanjiAction, now: number): { save: SaveData; event: KanjiEvent; delta: number } {
  // 正解表の修正は移行済みアカウントにも適用する。補正でクリアした報酬も
  // この操作の差分として財布・記録と同時に確定し、rewardedAt で二重払いを防ぐ。
  let save = stored ? reconcileSave({ ...stored, coins: balance }, STAGES, now) : null;
  const event: KanjiEvent = {};
  if (action.type === "initialize") {
    if (!save) {
      const legacy = action.legacy === undefined ? null : parseSave(action.legacy);
      if (action.legacy !== undefined && (!legacy || legacy.level > 1000 || legacy.exp > 1_000_000)) throw new Error("以前の記録を読み取れませんでした。端末の記録は残っています。");
      // 発見・クリア記録は移す。ゲーム専用の旧残高を共通財布へ加算しない。
      save = { ...reconcileSave(legacy ?? defaultSave(), STAGES, now), coins: balance };
    }
  } else {
    if (!save) throw new Error("記録を読み込み直してください。");
    if (action.type === "login") {
      const result = claimLoginBonus(save, japanDate(now));
      save = result.save; event.bonus = result.bonus;
    } else if (action.type === "settings") save = { ...save, settings: action.settings };
    else if (action.type === "reset") save = { ...save, rounds: {}, clearStreak: 0 };
    else {
      const stage = findStage(action.stageId);
      if (!stage) throw new Error("ステージが見つかりません。");
      const live = save.rounds[stage.id];
      if (action.type === "start") {
        if (!live || live.completedAt !== null || action.retry) save = saveRound(save, newRound(stage, now));
      } else if (action.type === "skip") save = skipStage(save, stage.id);
      else if (!live) throw new Error("ステージを開き直してください。");
      else if (action.type === "submit") {
        const outcome = submit(stage, live, action.strokes, now);
        event.outcome = outcome;
        if (outcome.result && outcome.result.kind !== "empty") {
          save = saveRound(save, outcome.round);
          const recorded = recordAnswers(save, outcome.gained ? 1 : 0, ["wrong", "whole"].includes(outcome.result.kind) ? 1 : 0, now);
          save = recorded.save; event.unlocked = [...recorded.unlocked]; event.secretCoins = 0;
          // 正解追加で報酬済みラウンドを再開した場合、追加の通常字の点数も記録する。
          const paidRecord = save.stages[stage.id];
          if (outcome.gained && !outcome.gained.secret && live.rewardedAt !== null && paidRecord) {
            save = { ...save, totalPoints: save.totalPoints + outcome.gained.points, stages: {
              ...save.stages, [stage.id]: { ...paidRecord, bestScore: Math.max(paidRecord.bestScore, outcome.round.score) },
            } };
          }
          for (const discovery of outcome.gained?.discoveries ?? []) {
            if (!discovery.secret) continue;
            const secret = recordSecret(save, stage, discovery.answer.char, discovery.points, live.rewardedAt !== null, now);
            save = secret.save; event.secretCoins += secret.coins; event.unlocked.push(...secret.achievements);
          }
          if (outcome.cleared) {
            const done = completeStage(save, stage, outcome.round, now);
            save = done.save; event.reward = done.reward;
          }
        }
      } else if (action.type === "hint") {
        if (!stage.answers.some(a => a.char === action.answer) || !canUseHint(live, action.answer, action.kind) || live.completedAt !== null) throw new Error("このヒントはもう使えません。");
        const bought = buyHint(save, stage.id, action.answer, action.kind, HINTS[action.kind].cost, now);
        if (!bought.ok) throw new Error("青コインが足りません。");
        const round = applyHint(stage, live, action.answer, action.kind, now);
        save = saveRound(bought.save, round);
        if (round.clearedAt !== null && live.clearedAt === null) {
          const done = completeStage(save, stage, round, now); save = done.save; event.reward = done.reward;
        }
      }
    }
  }
  return { save, event, delta: save.coins - balance };
}
