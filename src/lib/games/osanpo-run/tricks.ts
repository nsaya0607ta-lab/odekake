/** 新しい仕掛けの共通仕様。描画・当たり判定は同じ y（下端）/ h を使う。 */
export const TRICK_SPECS = {
  suitcase: { name: "大脱走スーツケース", width: 38, height: 34, from: 22, weight: 0.9, points: 20 },
  surprise: { name: "びっくり宅配便", width: 40, height: 26, from: 36, weight: 0.8, points: 30 },
  drone: { name: "せっかち配達ドローン", width: 52, height: 30, from: 48, weight: 0.7, points: 25 },
} as const;
export type TrickKind = keyof typeof TRICK_SPECS;
export const TRICK_KINDS = Object.keys(TRICK_SPECS) as TrickKind[];
export function isTrickKind(kind: string): kind is TrickKind {
  return kind === "suitcase" || kind === "surprise" || kind === "drone";
}
export const TRICK_WARNING = 0.65;
/**
 * びっくり宅配便が飛び出す高さ（箱の 26 にたす分）。走る速さが 300 になって見えてから届くまでが短くなったので、
 * 2段ジャンプでないと越えられない高さ（以前は 94）から、ふつうのジャンプ（長押し）で越えられる高さにした
 */
export const SURPRISE_POP = 40;
export const SUITCASE_CYCLE = 1.8;
const smooth = (n: number) => { const t = Math.max(0, Math.min(1, n)); return t * t * (3 - 2 * t); };

/** activeTime=-1 は接近前。箱とドローンは0.65秒の予告を挟み、一度だけ変化する。 */
export function trickPose(kind: TrickKind, ground: number, age: number, activeTime: number, phase = 0): { y: number; h: number; warning: number } {
  if (kind === "suitcase") {
    const angle = ((age + phase) % SUITCASE_CYCLE) / SUITCASE_CYCLE * Math.PI * 2;
    return { y: ground - Math.max(0, Math.sin(angle)) * 88, h: TRICK_SPECS.suitcase.height, warning: 0 };
  }
  const warning = activeTime >= 0 && activeTime < TRICK_WARNING ? 1 - activeTime / TRICK_WARNING : 0;
  if (kind === "surprise") {
    const pop = smooth((activeTime - TRICK_WARNING) / 0.18) * (1 - smooth((activeTime - 1.7) / 0.3));
    return { y: ground, h: 26 + SURPRISE_POP * pop, warning };
  }
  return { y: ground - 82 + 50 * smooth((activeTime - TRICK_WARNING) / 0.3), h: TRICK_SPECS.drone.height, warning };
}

export type TrickStats = {
  clears: Record<TrickKind, number>;
  suitcaseJumps: number;
  suitcaseUnder: number;
  openBoxes: number;
  droneSlides: number;
  /** 3種類すべてを1回のおさんぽで回避したステージ */
  routes: string[];
};
export type TrickRun = { kinds: TrickKind[]; streak: number };
export type TrickStyle = { over: boolean; under: boolean; ducked: boolean };
export const newTrickRun = (): TrickRun => ({ kinds: [], streak: 0 });
export const newTrickStats = (): TrickStats => ({ clears: { suitcase: 0, surprise: 0, drone: 0 }, suitcaseJumps: 0, suitcaseUnder: 0, openBoxes: 0, droneSlides: 0, routes: [] });

/** 接触・バリア・すり抜けで助かった障害物は呼び出し側で除外する。獲得済み判定は既存のunlockが行う。 */
export function recordTrickClear(stats: TrickStats, run: TrickRun, kind: TrickKind, style: TrickStyle, stage: string): string[] {
  const unlocked: string[] = [];
  stats.clears[kind]++;
  if (!run.kinds.includes(kind)) run.kinds.push(kind);
  run.streak++;
  if (kind === "suitcase") {
    unlocked.push("suitcaseFirst");
    if (style.over && ++stats.suitcaseJumps >= 5) unlocked.push("suitcaseJumps5");
    if (style.under) { stats.suitcaseUnder++; unlocked.push("suitcaseUnder"); }
  } else if (kind === "surprise") {
    unlocked.push("surpriseFirst");
    if (style.over && ++stats.openBoxes >= 5) unlocked.push("openBoxes5");
  } else {
    unlocked.push("droneFirst");
    if (style.ducked && ++stats.droneSlides >= 10) unlocked.push("droneSlides10");
  }
  if (run.kinds.length === TRICK_KINDS.length) {
    unlocked.push("trickTrio");
    if (!stats.routes.includes(stage)) stats.routes.push(stage);
    if (["town", "hiking", "snow", "summer"].every((id) => stats.routes.includes(id))) unlocked.push("trickTour");
  }
  if (run.streak >= 6) unlocked.push("trickStreak6");
  return unlocked;
}
