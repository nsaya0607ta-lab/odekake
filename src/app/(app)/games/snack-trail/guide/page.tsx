import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import styles from "@/components/games/snack-trail.module.css";
import { SnackTrailGuide } from "@/components/games/snack-trail-guide";
import {
  BOOST_INTERVAL,
  COIN_SCORE_DENOMINATOR,
  COIN_SCORE_NUMERATOR,
  GOLDEN_POINT,
  HAZARD_PENALTY,
  ITEMS_ON_BOARD,
  MAX_WALL_GUARD_USES,
  NORMAL_POINT,
  PLAYABLE_ITEM_COUNT,
  WALL_SPAWN_INTERVAL_MS,
  WALL_WARNING_LEAD_MS,
} from "@/lib/games/snack-trail-config";
import { canSeeSnackTrail } from "@/lib/games/snack-trail-access";
import { requireUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "わんこのおやつ道の説明書 | おでかけ記録",
  description: "わんこのおやつ道の遊びかたと、得点のしくみ。",
};
export const dynamic = "force-dynamic";

export default async function SnackTrailGuidePage() {
  const { user } = await requireUser();
  if (!canSeeSnackTrail(user.displayName)) redirect("/games");

  return (
    <div className={styles.shell}>
      <div className={styles.ambient} aria-hidden="true"><i /><i /><i /><i /><i /></div>

      <header className={styles.header}>
        <Link href="/games/snack-trail" className={styles.backButton} aria-label="わんこのおやつ道へ戻る">‹</Link>
        <div className={styles.titleBlock}><span>おでかけ ミニゲーム 03</span><h1>説明書</h1></div>
        <span aria-hidden="true" />
      </header>

      <main className={styles.main}>
        <SnackTrailGuide
          hazardPenalty={HAZARD_PENALTY}
          wallIntervalMinutes={Math.round(WALL_SPAWN_INTERVAL_MS / 60_000)}
          wallWarningSeconds={Math.round(WALL_WARNING_LEAD_MS / 1_000)}
          maxWallGuardUses={MAX_WALL_GUARD_USES}
          boostInterval={BOOST_INTERVAL}
          itemKindCount={PLAYABLE_ITEM_COUNT}
          itemsOnBoard={ITEMS_ON_BOARD}
          normalPoint={NORMAL_POINT}
          goldenPoint={GOLDEN_POINT}
          coinScoreNumerator={COIN_SCORE_NUMERATOR}
          coinScoreDenominator={COIN_SCORE_DENOMINATOR}
        />
      </main>
    </div>
  );
}
