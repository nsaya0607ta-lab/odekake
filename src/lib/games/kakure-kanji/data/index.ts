import type { Stage } from "../types";
import { STAGE_001_KAN } from "./stage-001-kan";
import { STAGE_002_KAN } from "./stage-002-kan";
import { STAGE_003_SHOU } from "./stage-003-shou";
import { STAGES_004_010 } from "./stages-004-010";

/**
 * 遊べるステージの一覧（並び順＝ステージ番号順）。
 * 新しい問題は data/stage-XXX-*.ts を作ってここに足す。手順は docs/kakure-kanji.md。
 * verification.status が "verified" でない問題は一覧に出さない。
 */
const ALL_STAGES: Stage[] = [STAGE_001_KAN, STAGE_002_KAN, STAGE_003_SHOU, ...STAGES_004_010];

export const STAGES: Stage[] = ALL_STAGES.filter((stage) => stage.verification.status === "verified");

export function findStage(id: string): Stage | undefined {
  return STAGES.find((stage) => stage.id === id);
}

export { ALL_STAGES };
