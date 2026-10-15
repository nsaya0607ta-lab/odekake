import { getTownStats, type Town, type TownStats } from "./town-builder";

export const TOWN_MAX_LEVEL = 50;
export const WHITE_LOGIN_COINS = 500;
/** Cumulative EXP. Keep in sync with town_level / town_level_xp in migration 0141. */
export function townLevelXp(level: number): number {
  const n = Math.max(1, Math.min(TOWN_MAX_LEVEL, Math.floor(level))) - 1;
  return n * 100 + n * (n - 1) * 25;
}
export function townLevelReward(level: number): number { return 200 + level * 50; }
export function townProgress(xp: number) {
  const total = Number.isSafeInteger(xp) && xp > 0 ? xp : 0;
  let level = 1;
  while (level < TOWN_MAX_LEVEL && total >= townLevelXp(level + 1)) level++;
  const start = townLevelXp(level), max = level === TOWN_MAX_LEVEL;
  const required = max ? 0 : townLevelXp(level + 1) - start;
  return { level, total, current: max ? 0 : total - start, required, ratio: max ? 1 : (total - start) / required, max };
}
export const TOWN_RANKS = [
  { level: 1, title: "見習いの開拓者", color: "#b7c9ab" },
  { level: 5, title: "街の設計士", color: "#a9d9c8" },
  { level: 10, title: "熟練の建築家", color: "#a8cbed" },
  { level: 20, title: "都市の守り手", color: "#c5b5e9" },
  { level: 35, title: "まちづくりの名匠", color: "#e4c88a" },
  { level: 50, title: "伝説のまちづくり", color: "#ffe7ac" },
] as const;
export function townRank(level: number) { return [...TOWN_RANKS].reverse().find(r => level >= r.level) ?? TOWN_RANKS[0]; }
export type TownQuest = { id: string; chapter: string; title: string; detail: string; level: number; target: number; coins: number; xp: number };
/** Quest rewards are awarded once per account. SQL uses the same catalog and metrics. */
export const TOWN_QUESTS: readonly TownQuest[] = [
  { id: "roads", chapter: "はじまりの一歩", title: "街の道しるべ", detail: "道路を10マスつくる", level: 1, target: 10, coins: 300, xp: 40 },
  { id: "homes", chapter: "はじまりの一歩", title: "おかえりの灯り", detail: "住宅を5棟つくる", level: 1, target: 5, coins: 600, xp: 80 },
  { id: "shop", chapter: "はじまりの一歩", title: "最初のお店", detail: "商店を1棟つくる", level: 1, target: 1, coins: 250, xp: 30 },
  { id: "park", chapter: "緑のある暮らし", title: "木陰でひと休み", detail: "部品のある公園・広場を1か所つくる", level: 2, target: 1, coins: 400, xp: 60 },
  { id: "parts", chapter: "緑のある暮らし", title: "小さなこだわり", detail: "公園の部品を合計8点置く", level: 2, target: 8, coins: 500, xp: 80 },
  { id: "people", chapter: "街を育てよう", title: "100人の物語", detail: "道路につながる住宅の人口を100人にする", level: 2, target: 100, coins: 800, xp: 120 },
  { id: "upgrade", chapter: "街を育てよう", title: "空へ、一歩", detail: "建物を建物Lv.2以上へ増築する", level: 3, target: 1, coins: 400, xp: 100 },
  { id: "equipment", chapter: "街を育てよう", title: "暮らしの職人", detail: "建物・道路の部品を合計5点取り付ける", level: 3, target: 5, coins: 600, xp: 100 },
  { id: "rails", chapter: "鉄道のある街", title: "レールの向こうへ", detail: "線路を12マスつくる", level: 3, target: 12, coins: 500, xp: 80 },
  { id: "railway", chapter: "鉄道のある街", title: "出発進行！", detail: "線路で2つの駅をつなぐ", level: 3, target: 2, coins: 1500, xp: 200 },
  { id: "factory", chapter: "にぎわいの種", title: "ものづくりの街", detail: "工場を2棟つくる", level: 4, target: 2, coins: 700, xp: 120 },
  { id: "green", chapter: "にぎわいの種", title: "緑をめぐる散歩道", detail: "部品のある公園・広場を3か所つくる", level: 4, target: 3, coins: 1200, xp: 180 },
  { id: "variety", chapter: "にぎわいの種", title: "庭づくりの達人", detail: "公園に10種類の部品を置く", level: 5, target: 10, coins: 1000, xp: 180 },
  { id: "skyline", chapter: "都市への旅", title: "街の新しいシンボル", detail: "建物Lv.3の建物を1棟つくる", level: 5, target: 1, coins: 1000, xp: 200 },
  { id: "residents", chapter: "都市への旅", title: "300人のおかえり", detail: "人口を300人にする", level: 6, target: 300, coins: 1800, xp: 250 },
  { id: "city", chapter: "都市への旅", title: "ぼくらの小さな都市", detail: "人口を500人にする", level: 8, target: 500, coins: 3000, xp: 400 },
  { id: "metropolis", chapter: "名匠への道", title: "1000人のふるさと", detail: "人口を1000人にする", level: 10, target: 1000, coins: 5000, xp: 650 },
  { id: "master", chapter: "名匠への道", title: "空を彩る街並み", detail: "建物Lv.3の建物を10棟つくる", level: 12, target: 10, coins: 6000, xp: 800 },
];
export function townQuestMetrics(town: Pick<Town, "tiles" | "levels" | "parks" | "attachments">, stats?: TownStats): Record<string, number> {
  const s = stats ?? getTownStats(town.tiles, town.levels, town.parks, town.attachments);
  const buildings = town.tiles.flatMap((t, i) => ["house", "shop", "factory"].includes(t) ? [town.levels[i] || 1] : []);
  return { roads: s.roads, homes: s.homes, shop: s.shops, park: s.parks, parts: town.parks.reduce((n, p) => n + p.parts.length, 0), people: s.population,
    upgrade: buildings.filter(l => l >= 2).length, equipment: town.attachments.reduce((n, a) => n + a.parts.length, 0), rails: s.rails, railway: s.linkedStations,
    factory: s.factories, green: s.parks, variety: new Set(town.parks.flatMap(p => p.parts.map(v => v.kind))).size,
    skyline: buildings.filter(l => l >= 3).length, residents: s.population, city: s.population, metropolis: s.population, master: buildings.filter(l => l >= 3).length };
}

export type TownSnapshot = {
  town: Town | null; balance: number; revision: number; xp: number; maxLevel: number;
  claimedQuests: string[]; canUndo: boolean; dailyClaimed: boolean; dailySpent: number; dailyQuestClaimed: boolean; date: string;
};
