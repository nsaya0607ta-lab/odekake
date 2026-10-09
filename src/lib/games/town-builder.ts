// OpenTTD-inspired rules implemented independently; no OpenTTD source code is used.
export const MAP_SIZE = 24;
export type Tile = "grass" | "road" | "rail" | "station" | "house" | "shop" | "factory" | "park";
export type Tool = Exclude<Tile, "grass"> | "bulldoze";
export type Town = { tiles: Tile[]; money: number; day: number; paused: boolean; };
export type TownStats = {
  population: number; homes: number; shops: number; factories: number;
  roads: number; rails: number; stations: number; parks: number;
  linkedStations: number; income: number; upkeep: number; happiness: number;
};
export const BUILDINGS: ReadonlyArray<{ id: Tool; title: string; price: number; icon: string; info: string }> = [
  { id: "road", title: "道路", price: 35, icon: "🛣️", info: "住宅や商店にアクセスを届ける" },
  { id: "rail", title: "線路", price: 55, icon: "🛤️", info: "駅と駅をつなぐ" },
  { id: "station", title: "駅", price: 550, icon: "🚉", info: "線路でつながると交通収入が増える" },
  { id: "house", title: "住宅", price: 250, icon: "🏠", info: "道路に面した土地に建設" },
  { id: "shop", title: "商店", price: 400, icon: "🏪", info: "道路に面した土地に建設" },
  { id: "factory", title: "工場", price: 650, icon: "🏭", info: "道路に面した土地に建設" },
  { id: "park", title: "公園", price: 140, icon: "🌳", info: "街の満足度を高める" },
  { id: "bulldoze", title: "撤去", price: 0, icon: "🧹", info: "建設物を撤去する（費用は返還されない）" },
];
const PRICE = Object.fromEntries(BUILDINGS.map(({ id, price }) => [id, price])) as Record<Tool, number>;
const TRANSPORT: Tile[] = ["rail", "station"];

export function indexAt(x: number, y: number): number { return y * MAP_SIZE + x; }
export function neighbours(x: number, y: number): number[] {
  const out: number[] = [];
  if (x > 0) out.push(indexAt(x - 1, y));
  if (x < MAP_SIZE - 1) out.push(indexAt(x + 1, y));
  if (y > 0) out.push(indexAt(x, y - 1));
  if (y < MAP_SIZE - 1) out.push(indexAt(x, y + 1));
  return out;
}
export function createTown(): Town {
  return { tiles: Array<Tile>(MAP_SIZE * MAP_SIZE).fill("grass"), money: 20000, day: 1, paused: false };
}
function touchesRoad(tiles: Tile[], x: number, y: number): boolean {
  return neighbours(x, y).some(i => tiles[i] === "road");
}
function linkedStationCount(tiles: Tile[]): number {
  const visited = new Set<number>();
  let linked = 0;
  for (let start = 0; start < tiles.length; start++) {
    if (tiles[start] !== "station" || visited.has(start)) continue;
    const queue = [start];
    visited.add(start);
    let stations = 0;
    for (let at = 0; at < queue.length; at++) {
      const i = queue[at]!;
      if (tiles[i] === "station") stations++;
      const x = i % MAP_SIZE, y = Math.floor(i / MAP_SIZE);
      for (const next of neighbours(x, y)) {
        if (TRANSPORT.includes(tiles[next] ?? "grass") && !visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    if (stations >= 2) linked += stations;
  }
  return linked;
}
export function getTownStats(tiles: Tile[]): TownStats {
  const count = (kind: Tile) => tiles.filter(t => t === kind).length;
  const homes = count("house"), shops = count("shop"), factories = count("factory");
  const roads = count("road"), rails = count("rail"), stations = count("station"), parks = count("park");
  const linkedStations = linkedStationCount(tiles);
  const homeAccess = tiles.reduce((n, kind, i) => n + (
    kind === "house" && touchesRoad(tiles, i % MAP_SIZE, Math.floor(i / MAP_SIZE)) ? 1 : 0
  ), 0);
  const shopAccess = tiles.reduce((n, kind, i) => n + (
    kind === "shop" && touchesRoad(tiles, i % MAP_SIZE, Math.floor(i / MAP_SIZE)) ? 1 : 0
  ), 0);
  const factoryAccess = tiles.reduce((n, kind, i) => n + (
    kind === "factory" && touchesRoad(tiles, i % MAP_SIZE, Math.floor(i / MAP_SIZE)) ? 1 : 0
  ), 0);
  const population = homeAccess * 18 + (linkedStations ? Math.round(homeAccess * 4) : 0);
  const income = homeAccess * 23 + shopAccess * 48 + factoryAccess * 74 + linkedStations * 110;
  const upkeep = roads * 3 + rails * 4 + stations * 30 + parks * 10 + factories * 8;
  const happiness = Math.max(0, Math.min(100, 50 + parks * 5 + linkedStations * 4 - factories * 3));
  return { population, homes, shops, factories, roads, rails, stations, parks, linkedStations, income, upkeep, happiness };
}
export function buildTile(town: Town, tool: Tool, x: number, y: number): { town: Town; message: string } {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= MAP_SIZE || y >= MAP_SIZE) {
    return { town, message: "マップの範囲外です" };
  }
  const i = indexAt(x, y);
  const existing = town.tiles[i];
  if (tool === "bulldoze") {
    if (existing === "grass") return { town, message: "ここは更地です" };
    const tiles = town.tiles.slice();
    tiles[i] = "grass";
    return { town: { ...town, tiles }, message: "建物・道路を撤去しました" };
  }
  if (existing !== "grass") return { town, message: "ここにはすでに建設物があります。撤去してから建設してください" };
  if (["house", "shop", "factory"].includes(tool) && !touchesRoad(town.tiles, x, y)) {
    return { town, message: "住宅・商店・工場は道路の隣に建ててください" };
  }
  const cost = PRICE[tool];
  if (town.money < cost) return { town, message: "資金が不足しています" };
  const tiles = town.tiles.slice();
  tiles[i] = tool;
  return { town: { ...town, tiles, money: town.money - cost }, message: BUILDINGS.find(b => b.id === tool)?.title + "を建設しました" };
}
function growTown(town: Town): Town {
  const { tiles } = town;
  const stats = getTownStats(tiles);
  if (stats.roads < 5 || stats.homes < 2 || stats.population < 20) return town;
  // A connected railway speeds up growth, while towns can still grow without one.
  if (stats.linkedStations === 0 && town.day % 24 !== 0) return town;
  const choices: number[] = [];
  for (let y = 0; y < MAP_SIZE; y++) for (let x = 0; x < MAP_SIZE; x++) {
    const i = indexAt(x, y);
    if (tiles[i] !== "grass" || !touchesRoad(tiles, x, y)) continue;
    const alreadyDeveloped = neighbours(x, y).some(n => ["house", "shop", "park"].includes(tiles[n] ?? "grass"));
    if (alreadyDeveloped) choices.push(i);
  }
  if (!choices.length) return town;
  const next = tiles.slice();
  // Deterministic choice ensures repeatable simulation and safe save/reload.
  const choice = choices[(town.day * 7919 + stats.population * 17) % choices.length]!;
  next[choice] = stats.shops * 3 < stats.homes ? "shop" : "house";
  return { ...town, tiles: next };
}
export function advanceTown(town: Town): Town {
  if (town.paused) return town;
  let next = { ...town, day: town.day + 1 };
  if (next.day % 6 === 0) {
    const stats = getTownStats(next.tiles);
    next = { ...next, money: next.money + stats.income - stats.upkeep };
  }
  if (next.day % 12 === 0) next = growTown(next);
  return next;
}
export function decodeTown(raw: string | null): Town | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const obj = value as Record<string, unknown>;
    const allowed = new Set<Tile>(["grass", "road", "rail", "station", "house", "shop", "factory", "park"]);
    if (!Array.isArray(obj.tiles) || obj.tiles.length !== MAP_SIZE * MAP_SIZE || !obj.tiles.every(v => allowed.has(v))) return null;
    if (typeof obj.money !== "number" || !Number.isFinite(obj.money) || Math.abs(obj.money) > 1e12) return null;
    if (typeof obj.day !== "number" || !Number.isInteger(obj.day) || obj.day < 1 || obj.day > 1e9) return null;
    return { tiles: obj.tiles as Tile[], money: obj.money, day: obj.day, paused: obj.paused === true };
  } catch {
    return null;
  }
}
