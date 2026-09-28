/**
 * おさんぽフレンチーの「今日のミッション」
 * =============================================================
 * 日本時間の日付から毎日3つを選ぶ（同じ日は誰でも同じお題）。お題の難しさは混ぜて出し、表示もしない。
 * 1つ達成するごとに MISSION_COINS、3つそろうと MISSION_ALL_BONUS のコイン。
 * 判定はゲーム（engine.ts）、選び方の確認は API（/api/games/osanpo-run/mission）、
 * コインの付与は DB の record_osanpo_run_mission が行う（金額はDB側と同じ値）。
 */

/** 1回のおさんぽで数える値 */
export type OsanpoRunMissionMetric =
  | "bones" | "meters" | "items" | "rarePlus" | "pigeons" | "slides" | "greets" | "rushes"
  | "combo" | "closes" | "skills" | "score" | "routeCalm" | "routeRisky" | "bonusGot";

export type OsanpoRunMission = {
  id: string;
  /** 同じ日に同じグループのお題は出さない（「300m歩く」と「1200m歩く」が並ばないように） */
  group: string;
  text: string;
  metric: OsanpoRunMissionMetric;
  target: number;
};

export const OSANPO_RUN_MISSIONS: readonly OsanpoRunMission[] = [
  { id: "bones50", group: "bones", text: "1回のおさんぽで、ほねを50本拾う", metric: "bones", target: 50 },
  { id: "bones120", group: "bones", text: "1回のおさんぽで、ほねを120本拾う", metric: "bones", target: 120 },
  { id: "m300", group: "meters", text: "1回で300m歩く", metric: "meters", target: 300 },
  { id: "m700", group: "meters", text: "1回で700m歩く", metric: "meters", target: 700 },
  { id: "m1200", group: "meters", text: "1回で1200m歩く", metric: "meters", target: 1200 },
  { id: "items10", group: "items", text: "1回で図鑑アイテムを10個拾う", metric: "items", target: 10 },
  { id: "items25", group: "items", text: "1回で図鑑アイテムを25個拾う", metric: "items", target: 25 },
  { id: "sr2", group: "rare", text: "1回でSR以上のアイテムを2個拾う", metric: "rarePlus", target: 2 },
  { id: "sr5", group: "rare", text: "1回でSR以上のアイテムを5個拾う", metric: "rarePlus", target: 5 },
  { id: "pigeons3", group: "pigeons", text: "ハトを3回飛び立たせる", metric: "pigeons", target: 3 },
  { id: "slides3", group: "slides", text: "スライディングで3回くぐる", metric: "slides", target: 3 },
  { id: "greets2", group: "greets", text: "ほかのフレブルに2回あいさつする", metric: "greets", target: 2 },
  { id: "rush1", group: "rush", text: "ラッシュを乗り切る", metric: "rushes", target: 1 },
  { id: "rush2", group: "rush", text: "1回でラッシュを2回乗り切る", metric: "rushes", target: 2 },
  { id: "combo5", group: "combo", text: "×5コンボを出す", metric: "combo", target: 5 },
  { id: "closes3", group: "closes", text: "1回で「ギリギリ！」を3回出す", metric: "closes", target: 3 },
  { id: "skills5", group: "skills", text: "1回でスキルを5種類発動させる", metric: "skills", target: 5 },
  { id: "score2000", group: "score", text: "スコア2000点以上で帰る", metric: "score", target: 2000 },
  { id: "score5000", group: "score", text: "スコア5000点以上で帰る", metric: "score", target: 5000 },
  { id: "routeCalm", group: "route", text: "分かれ道で、跳んで上の道に進む", metric: "routeCalm", target: 1 },
  { id: "routeRisky", group: "route", text: "分かれ道で、そのまま下の道に進む", metric: "routeRisky", target: 1 },
  { id: "bonus10", group: "bonus", text: "1回のボーナスタイムで10個拾う", metric: "bonusGot", target: 10 },
];

export const OSANPO_RUN_MISSION_BY_ID: ReadonlyMap<string, OsanpoRunMission> = new Map(OSANPO_RUN_MISSIONS.map((m) => [m.id, m]));

export const OSANPO_RUN_DAILY_MISSION_COUNT = 3;
export const MISSION_COINS = 30;
export const MISSION_ALL_BONUS = 100;

/** 日付の文字列から決まる乱数（同じ日付なら同じ並び） */
function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** その日（日本時間の YYYY-MM-DD）のミッション3つ */
export function getDailyMissions(date: string): OsanpoRunMission[] {
  const rand = seededRandom(`osanpo-run:${date}`);
  const pool = [...OSANPO_RUN_MISSIONS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const picked: OsanpoRunMission[] = [];
  for (const m of pool) {
    if (picked.some((p) => p.group === m.group)) continue;
    picked.push(m);
    if (picked.length === OSANPO_RUN_DAILY_MISSION_COUNT) break;
  }
  return picked;
}
