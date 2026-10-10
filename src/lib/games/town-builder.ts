// Independent simulation; OpenTTD code and assets are not used.
export const MAP_SIZE = 24;
export type Tile = "grass" | "water" | "road" | "rail" | "station" | "house" | "shop" | "factory" | "park";
export type Tool = Exclude<Tile, "grass" | "water"> | "bulldoze";
export type Town = { tiles: Tile[]; money: number; day: number; paused: boolean; levels: number[]; terrain: boolean[]; rewards: string[] };
export type TownStats = {
  population: number; homes: number; shops: number; factories: number; roads: number; rails: number;
  stations: number; parks: number; linkedStations: number; income: number; upkeep: number;
  happiness: number; jobs: number; routes: number[][];
};
export const BUILDINGS: ReadonlyArray<{ id: Tool; title: string; price: number; info: string; category: "交通" | "建物" | "環境" }> = [
  { id: "road", title: "道路", price: 35, info: "タップで1マス配置。「連続敷設」で道路を延ばせます。川の上は橋（¥120）。", category: "交通" },
  { id: "rail", title: "線路", price: 55, info: "タップで1マス配置。「連続敷設」で駅を結べます。川の上は鉄道橋（¥160）。", category: "交通" },
  { id: "station", title: "駅", price: 550, info: "2駅を線路で結ぶと列車が運行。周囲3マスの住民を輸送します。", category: "交通" },
  { id: "house", title: "住宅", price: 250, info: "道路沿いに建設。公園と仕事があると集合住宅へ育ちます。", category: "建物" },
  { id: "shop", title: "商店", price: 400, info: "道路沿いに建設。街に仕事と買い物の楽しみを届けます。", category: "建物" },
  { id: "factory", title: "工場", price: 650, info: "収入と雇用を増やします。住宅から離すと住民も快適。", category: "建物" },
  { id: "park", title: "公園", price: 140, info: "噴水や花壇で街を彩ります。近所の住宅の満足度が上がります。", category: "環境" },
  { id: "bulldoze", title: "撤去", price: 0, info: "タップで撤去。直前の工事は「元に戻す」で取り消せます。", category: "環境" },
];
const PRICE = Object.fromEntries(BUILDINGS.map(b => [b.id, b.price])) as Record<Tool, number>;
export function indexAt(x: number, y: number) { return y * MAP_SIZE + x; }
export function neighbours(x: number, y: number): number[] {
  return [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]
    .filter(([a, b]) => a! >= 0 && b! >= 0 && a! < MAP_SIZE && b! < MAP_SIZE)
    .map(([a, b]) => indexAt(a!, b!));
}
export function riverAt(x: number, y: number) { return Math.abs(x - (18 + Math.sin(y * .32) * 1.4)) < 1.35; }
export function createTown(starter = true): Town {
  const terrain = Array.from({ length: MAP_SIZE ** 2 }, (_, i) => riverAt(i % MAP_SIZE, Math.floor(i / MAP_SIZE)));
  const tiles: Tile[] = terrain.map(w => w ? "water" : "grass");
  if (starter) {
    for (let x = 6; x <= 13; x++) tiles[indexAt(x, 10)] = "road";
    for (let y = 7; y <= 14; y++) tiles[indexAt(9, y)] = "road";
    for (const [x, y, kind] of [[7, 9, "house"], [8, 11, "house"], [10, 8, "house"], [10, 12, "shop"], [8, 8, "park"]] as const) tiles[indexAt(x, y)] = kind;
  }
  return { tiles, terrain, levels: tiles.map(t => ["house", "shop", "factory"].includes(t) ? 1 : 0), money: 20000, day: 1, paused: false, rewards: [] };
}
export function touchesRoad(tiles: Tile[], x: number, y: number) { return neighbours(x, y).some(i => tiles[i] === "road"); }
function near(tiles: Tile[], i: number, kinds: Tile[], radius: number) {
  const x = i % MAP_SIZE, y = Math.floor(i / MAP_SIZE);
  let count = 0;
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
    if (Math.abs(dx) + Math.abs(dy) > radius || x + dx < 0 || y + dy < 0 || x + dx >= MAP_SIZE || y + dy >= MAP_SIZE) continue;
    if (kinds.includes(tiles[indexAt(x + dx, y + dy)]!)) count++;
  }
  return count;
}
// BFS returns an actual station-to-station rail path. Adjacent stations alone never earn revenue.
export function railRoutes(tiles: Tile[]): number[][] {
  const stations = tiles.flatMap((t, i) => t === "station" ? [i] : []);
  const routes: number[][] = [], paired = new Set<string>();
  for (const start of stations) {
    const parents = new Map<number, number>([[start, -1]]), queue = [start];
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q]!;
      if (i !== start && tiles[i] === "station") {
        const id = [start, i].sort((a, b) => a - b).join(":");
        const path: number[] = []; let at = i;
        while (at >= 0) { path.push(at); at = parents.get(at) ?? -1; }
        if (path.some(n => tiles[n] === "rail") && !paired.has(id)) { paired.add(id); routes.push(path.reverse()); }
        continue; // Stations terminate a route; another train can connect the next leg.
      }
      for (const n of neighbours(i % MAP_SIZE, Math.floor(i / MAP_SIZE))) {
        if (parents.has(n) || !["station", "rail"].includes(tiles[n]!)) continue;
        if (tiles[i] === "station" && tiles[n] === "station") continue;
        parents.set(n, i); queue.push(n);
      }
    }
    if (routes.length >= 32) break;
  }
  return routes;
}
export function getTownStats(tiles: Tile[], levels: number[] = []): TownStats {
  const count = (t: Tile) => tiles.filter(v => v === t).length;
  const homes = count("house"), shops = count("shop"), factories = count("factory"), roads = count("road"), rails = count("rail"), stations = count("station"), parks = count("park");
  const routes = railRoutes(tiles), linkedStations = new Set(routes.flatMap(r => [r[0]!, r[r.length - 1]!])).size;
  let population = 0, income = 0, jobs = 0, satisfaction = 0, occupied = 0;
  tiles.forEach((t, i) => {
    if (!touchesRoad(tiles, i % MAP_SIZE, Math.floor(i / MAP_SIZE))) return;
    const level = levels[i] || 1;
    if (t === "house") {
      const happy = Math.max(20, Math.min(100, 60 + near(tiles, i, ["park"], 3) * 12 + near(tiles, i, ["shop"], 3) * 4 - near(tiles, i, ["factory"], 3) * 10));
      population += 18 * level; income += 23 * level; satisfaction += happy; occupied++;
    }
    if (t === "shop") { income += 48 * level; jobs += 14 * level; }
    if (t === "factory") { income += 74 * level; jobs += 32 * level; }
  });
  const railPassengers = new Set(routes.flatMap(r => [r[0]!, r[r.length - 1]!])).size;
  // Empty disconnected stations do not produce passenger income.
  const servedHomes = tiles.reduce((sum, t, i) => sum + (t === "house" && routes.some(r => [r[0]!, r[r.length - 1]!].some(s => Math.abs(s % MAP_SIZE - i % MAP_SIZE) + Math.abs(Math.floor(s / MAP_SIZE) - Math.floor(i / MAP_SIZE)) <= 3)) && touchesRoad(tiles, i % MAP_SIZE, Math.floor(i / MAP_SIZE)) ? (levels[i] || 1) : 0), 0);
  income += Math.min(railPassengers * 110, servedHomes * 65);
  const upkeep = roads * 3 + rails * 4 + stations * 30 + parks * 10 + factories * 8;
  const happiness = occupied ? Math.round(satisfaction / occupied) : 60;
  return { population, homes, shops, factories, roads, rails, stations, parks, linkedStations, income, upkeep, happiness, jobs, routes };
}
export function buildTile(town: Town, tool: Tool, x: number, y: number): { town: Town; message: string } {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= MAP_SIZE || y >= MAP_SIZE) return { town, message: "マップの範囲外です" };
  const i = indexAt(x, y), existing = town.tiles[i];
  if (tool === "bulldoze") {
    if (existing === "grass" || existing === "water") return { town, message: "ここには建設物がありません" };
    const tiles = town.tiles.slice(), levels = town.levels.slice(); tiles[i] = town.terrain[i] ? "water" : "grass"; levels[i] = 0;
    return { town: { ...town, tiles, levels }, message: "撤去しました" };
  }
  if (existing !== "grass" && !(existing === "water" && ["road", "rail"].includes(tool))) return { town, message: existing === "water" ? "川には道路・線路で橋を架けられます" : "建設物があります。撤去するか、別の場所を選んでください" };
  if (["house", "shop", "factory"].includes(tool) && !touchesRoad(town.tiles, x, y)) return { town, message: "道路の隣に建ててください" };
  const cost = town.terrain[i] ? tool === "road" ? 120 : 160 : PRICE[tool];
  if (town.money < cost) return { town, message: "資金が不足しています" };
  const tiles = town.tiles.slice(), levels = town.levels.slice(); tiles[i] = tool; levels[i] = ["house", "shop", "factory"].includes(tool) ? 1 : 0;
  return { town: { ...town, tiles, levels, money: town.money - cost }, message: `${BUILDINGS.find(b => b.id === tool)?.title}を建設しました −¥${cost}` };
}
export function lineTiles(from: number, to: number): number[] {
  let x = from % MAP_SIZE, y = Math.floor(from / MAP_SIZE);
  const tx = to % MAP_SIZE, ty = Math.floor(to / MAP_SIZE), result = [from];
  // Connected L-shaped placement: no diagonal gaps in a road/rail stroke.
  while (x !== tx) { x += Math.sign(tx - x); result.push(indexAt(x, y)); }
  while (y !== ty) { y += Math.sign(ty - y); result.push(indexAt(x, y)); }
  return result;
}
export function buildLine(town: Town, tool: Tool, path: number[]) {
  let next = town, built = 0; let lastError = "建設できる場所がありません";
  for (const i of path) {
    const result = buildTile(next, tool, i % MAP_SIZE, Math.floor(i / MAP_SIZE));
    if (result.town !== next) { next = result.town; built++; }
    else if (next.tiles[i] !== tool && !(tool === "bulldoze" && ["grass", "water"].includes(next.tiles[i]!))) {
      // A stroke is atomic: blockers or insufficient funds leave the entire road unchanged.
      return { town, message: result.message };
    } else lastError = result.message;
  }
  return { town: next, message: built ? `${built}マスを工事しました${tool === "bulldoze" ? "" : ` −¥${town.money - next.money}`}` : lastError };
}
export function upgradeTile(town: Town, i: number) {
  if (!["house", "shop", "factory"].includes(town.tiles[i]!) || (town.levels[i] || 1) >= 3) return { town, message: "この建物はこれ以上増築できません" };
  if (!touchesRoad(town.tiles, i % MAP_SIZE, Math.floor(i / MAP_SIZE))) return { town, message: "増築するには道路が必要です" };
  const cost = (town.levels[i] || 1) * 450;
  if (town.money < cost) return { town, message: "増築の資金が不足しています" };
  const levels = town.levels.slice(); levels[i] = (levels[i] || 1) + 1;
  return { town: { ...town, levels, money: town.money - cost }, message: `Lv.${levels[i]}へ増築しました −¥${cost}` };
}
export const MILESTONES = [
  { id: "settle", title: "小さな街のはじまり", detail: "住宅5棟と商店1棟をつくる", reward: 1200, progress: (s: TownStats) => Math.min(s.homes / 5, s.shops) },
  { id: "green", title: "緑のある暮らし", detail: "公園3か所・人口150人", reward: 2000, progress: (s: TownStats) => Math.min(s.parks / 3, s.population / 150) },
  { id: "railway", title: "最初の鉄道開通", detail: "線路で2駅を結ぶ", reward: 3000, progress: (s: TownStats) => s.linkedStations / 2 },
  { id: "city", title: "活気のある街へ", detail: "人口500人・満足度75%以上", reward: 5000, progress: (s: TownStats) => Math.min(s.population / 500, s.happiness / 75) },
] as const;
export function advanceTown(town: Town): Town {
  if (town.paused) return town;
  let next = { ...town, day: town.day + 1 };
  let stats = getTownStats(next.tiles, next.levels);
  if (next.day % 6 === 0) next = { ...next, money: next.money + stats.income - stats.upkeep };
  if (next.day % (stats.linkedStations ? 12 : 24) === 0 && stats.homes >= 2 && stats.roads >= 5 && stats.happiness >= 45) {
    const choices = next.tiles.flatMap((t, i) => t === "grass" && touchesRoad(next.tiles, i % MAP_SIZE, Math.floor(i / MAP_SIZE)) && near(next.tiles, i, ["house", "shop"], 2) ? [i] : []);
    if (choices.length) {
      const i = choices[(next.day * 7919 + stats.population * 17) % choices.length]!;
      const tiles = next.tiles.slice(), levels = next.levels.slice();
      tiles[i] = stats.jobs < stats.population * .5 && stats.shops * 3 < stats.homes ? "shop" : "house"; levels[i] = 1;
      next = { ...next, tiles, levels };
    }
    if (stats.jobs >= stats.population * .4 && stats.happiness >= 70) {
      const i = next.tiles.findIndex((t, n) => t === "house" && (next.levels[n] || 1) < 3 && touchesRoad(next.tiles, n % MAP_SIZE, Math.floor(n / MAP_SIZE)));
      if (i >= 0) { const levels = next.levels.slice(); levels[i] = (levels[i] || 1) + 1; next = { ...next, levels }; }
    }
  }
  stats = getTownStats(next.tiles, next.levels);
  for (const m of MILESTONES) if (!next.rewards.includes(m.id) && m.progress(stats) >= 1) next = { ...next, money: next.money + m.reward, rewards: [...next.rewards, m.id] };
  return next;
}
export function decodeTown(raw: string | null): Town | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    if (!obj || typeof obj !== "object") return null;
    const allowed = new Set(["grass", "water", "road", "rail", "station", "house", "shop", "factory", "park"]);
    if (!Array.isArray(obj.tiles) || obj.tiles.length !== MAP_SIZE ** 2 || !obj.tiles.every(v => allowed.has(v))) return null;
    if (typeof obj.money !== "number" || !Number.isFinite(obj.money) || Math.abs(obj.money) > 1e12) return null;
    if (typeof obj.day !== "number" || !Number.isInteger(obj.day) || obj.day < 1 || obj.day > 1e9) return null;
    const tiles = obj.tiles as Tile[];
    const levels = Array.isArray(obj.levels) && obj.levels.length === tiles.length && obj.levels.every(v => Number.isInteger(v) && v >= 0 && v <= 3) ? obj.levels as number[] : tiles.map(t => ["house", "shop", "factory"].includes(t) ? 1 : 0);
    // Existing v1 saves retain every tile; no river is inserted into an old city.
    const terrain = Array.isArray(obj.terrain) && obj.terrain.length === tiles.length && obj.terrain.every(v => typeof v === "boolean") ? obj.terrain as boolean[] : tiles.map(t => t === "water");
    const rewards = Array.isArray(obj.rewards) ? obj.rewards.filter((v): v is string => typeof v === "string" && MILESTONES.some(m => m.id === v)) : [];
    return { tiles, levels, terrain, rewards, money: obj.money, day: obj.day, paused: obj.paused === true };
  } catch { return null; }
}
