// Independent simulation; OpenTTD code and assets are not used.
export const MAP_SIZE = 24;
export type Tile = "grass" | "water" | "road" | "rail" | "station" | "house" | "shop" | "factory" | "park";
export type Tool = Exclude<Tile, "grass" | "water"> | "bulldoze";
export type ParkPart = "tree" | "flowers" | "bench" | "fountain" | "playground" | "path" | "light" | "cherry" | "pine" | "hedge" | "pond" | "gazebo" | "picnic" | "swings" | "sandbox" | "sculpture" | "clock" | "trash" | "bikeRack" | "stones" | "arch";
export type ParkLot = { id: number; x: number; y: number; width: number; height: number; kind: "park" | "plaza"; parts: { tile: number; kind: ParkPart; rotation: number }[] };
export type FacilityPart = "garden" | "terrace" | "light" | "sign" | "storage" | "greenbelt" | "solar" | "bench" | "vending" | "canopy" | "planter";
export type FacilityAttachment = { tile: number; kind: Tile; parts: FacilityPart[] };
export type Town = { tiles: Tile[]; money: number; day: number; paused: boolean; levels: number[]; terrain: boolean[]; rewards: string[]; parks: ParkLot[]; attachments: FacilityAttachment[] };
export const PARK_SIZES = [
  { id: "small", width: 2, height: 2, price: 580, title: "2×2" },
  { id: "medium", width: 3, height: 3, price: 1150, title: "3×3" },
  { id: "large", width: 4, height: 3, price: 1500, title: "4×3" },
] as const;
export type ParkSize = typeof PARK_SIZES[number]["id"];
export const PARK_CATEGORIES = ["植栽", "遊具", "休憩", "景観"] as const;
export type ParkCategory = typeof PARK_CATEGORIES[number];
export const PARK_PARTS: ReadonlyArray<{ id: ParkPart; title: string; price: number; category: ParkCategory; layer: "ground" | "object"; value: number }> = [
  { id: "tree", title: "木", price: 70, category: "植栽", layer: "object", value: 3 },
  { id: "flowers", title: "花壇", price: 60, category: "植栽", layer: "object", value: 2 },
  { id: "bench", title: "ベンチ", price: 80, category: "休憩", layer: "object", value: 2 },
  { id: "fountain", title: "噴水", price: 180, category: "景観", layer: "object", value: 3 },
  { id: "playground", title: "遊具", price: 240, category: "遊具", layer: "object", value: 4 },
  { id: "path", title: "通路", price: 25, category: "景観", layer: "ground", value: 0 },
  { id: "light", title: "照明", price: 90, category: "休憩", layer: "object", value: 1 },
  { id: "cherry", title: "桜", price: 130, category: "植栽", layer: "object", value: 4 },
  { id: "pine", title: "針葉樹", price: 90, category: "植栽", layer: "object", value: 3 },
  { id: "hedge", title: "生垣", price: 65, category: "植栽", layer: "object", value: 2 },
  { id: "arch", title: "花のアーチ", price: 180, category: "植栽", layer: "object", value: 4 },
  { id: "swings", title: "ブランコ", price: 220, category: "遊具", layer: "object", value: 4 },
  { id: "sandbox", title: "砂場", price: 120, category: "遊具", layer: "object", value: 3 },
  { id: "picnic", title: "ピクニック", price: 150, category: "休憩", layer: "object", value: 3 },
  { id: "gazebo", title: "東屋", price: 320, category: "休憩", layer: "object", value: 5 },
  { id: "trash", title: "ごみ箱", price: 45, category: "休憩", layer: "object", value: 1 },
  { id: "bikeRack", title: "駐輪ラック", price: 100, category: "休憩", layer: "object", value: 2 },
  { id: "pond", title: "池", price: 260, category: "景観", layer: "object", value: 4 },
  { id: "sculpture", title: "モニュメント", price: 210, category: "景観", layer: "object", value: 3 },
  { id: "clock", title: "時計塔", price: 190, category: "景観", layer: "object", value: 2 },
  { id: "stones", title: "飛び石", price: 40, category: "景観", layer: "ground", value: 0 },
];
export const FACILITY_PARTS: ReadonlyArray<{ id: FacilityPart; title: string; price: number; kinds: Tile[]; info: string }> = [
  { id: "garden", title: "植栽・花壇", price: 90, kinds: ["house", "shop"], info: "庭先を彩る" },
  { id: "terrace", title: "テラス", price: 220, kinds: ["house", "shop"], info: "住宅の定員＋6人・商店の収入＋¥14" },
  { id: "light", title: "照明", price: 70, kinds: ["house", "shop", "station", "road"], info: "夜の街を照らす" },
  { id: "sign", title: "看板", price: 120, kinds: ["shop"], info: "商店の収入＋¥8" },
  { id: "storage", title: "資材置き場", price: 220, kinds: ["factory"], info: "工場の収入＋¥18" },
  { id: "greenbelt", title: "緑化帯", price: 140, kinds: ["factory"], info: "近所への影響を和らげる" },
  { id: "solar", title: "太陽光パネル", price: 260, kinds: ["factory"], info: "工場の収入＋¥8・維持費−¥4" },
  { id: "bench", title: "待合ベンチ", price: 90, kinds: ["station"], info: "ホームに休憩場所を追加" },
  { id: "vending", title: "自販機", price: 160, kinds: ["shop", "station"], info: "飲み物を買える場所" },
  { id: "canopy", title: "日よけ", price: 180, kinds: ["house", "shop"], info: "庭先に日陰をつくる" },
  { id: "planter", title: "プランター", price: 80, kinds: ["house", "shop", "station"], info: "入口に緑を添える" },
];
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
  { id: "park", title: "公園・広場", price: 580, info: "敷地を購入し、木・噴水・ベンチなどを買って配置します。", category: "環境" },
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
    for (const [x, y, kind] of [[7, 9, "house"], [8, 11, "house"], [10, 8, "house"], [10, 12, "shop"]] as const) tiles[indexAt(x, y)] = kind;
    for (const i of lotTiles({ x: 7, y: 7, width: 2, height: 2 })) tiles[i] = "park";
  }
  const parks: ParkLot[] = starter ? [{ id: indexAt(7, 7), x: 7, y: 7, width: 2, height: 2, kind: "park", parts: [{ tile: indexAt(7, 7), kind: "tree", rotation: 0 }, { tile: indexAt(8, 7), kind: "bench", rotation: 0 }, { tile: indexAt(7, 8), kind: "flowers", rotation: 0 }, { tile: indexAt(8, 8), kind: "path", rotation: 0 }] }] : [];
  return { tiles, terrain, levels: tiles.map(t => ["house", "shop", "factory"].includes(t) ? 1 : 0), money: 20000, day: 1, paused: false, rewards: [], parks, attachments: [] };
}
export function lotTiles(lot: Pick<ParkLot, "x" | "y" | "width" | "height">): number[] {
  return Array.from({ length: lot.width * lot.height }, (_, n) => indexAt(lot.x + n % lot.width, lot.y + Math.floor(n / lot.width)));
}
export function parkAt(town: Town, tile: number): ParkLot | undefined {
  const x = tile % MAP_SIZE, y = Math.floor(tile / MAP_SIZE);
  return town.parks?.find(p => x >= p.x && x < p.x + p.width && y >= p.y && y < p.y + p.height);
}
export function parkFootprint(x: number, y: number, size: ParkSize, rotate = false) {
  const shape = PARK_SIZES.find(s => s.id === size)!;
  return { x, y, width: rotate ? shape.height : shape.width, height: rotate ? shape.width : shape.height };
}
export function canBuyPark(town: Town, x: number, y: number, size: ParkSize, rotate = false) {
  const shape = PARK_SIZES.find(s => s.id === size); if (!shape) return false;
  const lot = parkFootprint(x, y, size, rotate);
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x + lot.width <= MAP_SIZE && y + lot.height <= MAP_SIZE && lotTiles(lot).every(i => town.tiles[i] === "grass" && !town.terrain[i]);
}
export function buyParkLot(town: Town, x: number, y: number, size: ParkSize, kind: ParkLot["kind"] = "park", rotate = false): { town: Town; message: string; lotId?: number } {
  const shape = PARK_SIZES.find(s => s.id === size);
  if (!shape || !canBuyPark(town, x, y, size, rotate)) return { town, message: "敷地全体を空いている陸地に置いてください" };
  if (town.money < shape.price) return { town, message: "敷地を購入する資金が不足しています" };
  const lot: ParkLot = { id: indexAt(x, y), ...parkFootprint(x, y, size, rotate), kind, parts: [] }, tiles = town.tiles.slice();
  for (const i of lotTiles(lot)) tiles[i] = "park";
  return { town: { ...town, tiles, parks: [...(town.parks ?? []), lot], money: town.money - shape.price }, lotId: lot.id, message: `${kind === "park" ? "公園" : "広場"}の敷地を購入しました −¥${shape.price}` };
}
export function expandParkLot(town: Town, id: number, size: ParkSize) {
  const lot = town.parks.find(p => p.id === id), target = PARK_SIZES.find(p => p.id === size);
  if (!lot || !target) return { town, message: "敷地が見つかりません" };
  const next = parkFootprint(lot.x, lot.y, size, lot.width < lot.height);
  if (next.width < lot.width || next.height < lot.height || next.width * next.height <= lot.width * lot.height) return { town, message: "今より大きな敷地を選んでください" };
  const occupied = new Set(lotTiles(lot));
  if (next.x + next.width > MAP_SIZE || next.y + next.height > MAP_SIZE || lotTiles(next).some(i => !occupied.has(i) && (town.tiles[i] !== "grass" || town.terrain[i]))) return { town, message: "広げる先に建物・道路・川があります" };
  const oldPrice = PARK_SIZES.find(p => p.width * p.height === lot.width * lot.height)?.price ?? 140, cost = target.price - oldPrice;
  if (town.money < cost) return { town, message: "敷地を広げる資金が不足しています" };
  const tiles = town.tiles.slice(); for (const i of lotTiles(next)) tiles[i] = "park";
  return { town: { ...town, tiles, parks: town.parks.map(p => p.id === id ? { ...p, ...next } : p), money: town.money - cost }, message: `敷地を${next.width}×${next.height}へ広げました −¥${cost}` };
}
export function canPlaceParkPart(lot: ParkLot, tile: number, kind: ParkPart) {
  const part = PARK_PARTS.find(p => p.id === kind);
  return Boolean(part && lotTiles(lot).includes(tile) && !lot.parts.some(p => p.tile === tile && PARK_PARTS.find(s => s.id === p.kind)?.layer === part.layer));
}
export function placeParkPart(town: Town, lotId: number, tile: number, kind: ParkPart, rotation = 0) {
  const lot = town.parks.find(p => p.id === lotId), part = PARK_PARTS.find(p => p.id === kind);
  if (!lot || !part || !lotTiles(lot).includes(tile) || !Number.isInteger(rotation)) return { town, message: "購入した敷地の中に置いてください" };
  if (!canPlaceParkPart(lot, tile, kind)) return { town, message: "ここには設備があります。撤去するか別のマスを選んでください" };
  if (town.money < part.price) return { town, message: "部品を購入する資金が不足しています" };
  const parks = town.parks.map(p => p.id === lotId ? { ...p, parts: [...p.parts, { tile, kind, rotation: ((rotation % 4) + 4) % 4 }] } : p);
  return { town: { ...town, parks, money: town.money - part.price }, message: `${part.title}を配置しました −¥${part.price}` };
}
export function removeParkPart(town: Town, lotId: number, tile: number) {
  const lot = town.parks.find(p => p.id === lotId);
  const part = lot?.parts.find(p => p.tile === tile && PARK_PARTS.find(s => s.id === p.kind)?.layer === "object") ?? lot?.parts.find(p => p.tile === tile);
  if (!part) return { town, message: "ここには部品がありません" };
  return { town: { ...town, parks: town.parks.map(p => p.id === lotId ? { ...p, parts: p.parts.filter(s => s !== part) } : p) }, message: "部品を撤去しました。敷地は残ります" };
}
export function removeParkLot(town: Town, lotId: number) {
  const lot = town.parks.find(p => p.id === lotId); if (!lot) return { town, message: "敷地が見つかりません" };
  const tiles = town.tiles.slice(), levels = town.levels.slice();
  for (const i of lotTiles(lot)) { tiles[i] = town.terrain[i] ? "water" : "grass"; levels[i] = 0; }
  return { town: { ...town, tiles, levels, parks: town.parks.filter(p => p.id !== lotId) }, message: "敷地と設備を撤去しました" };
}
export function buyFacilityPart(town: Town, tile: number, id: FacilityPart) {
  const part = FACILITY_PARTS.find(p => p.id === id), kind = town.tiles[tile], old = town.attachments.find(a => a.tile === tile);
  if (!part || !kind || !part.kinds.includes(kind)) return { town, message: "この施設には取り付けられません" };
  if (old?.parts.includes(id)) return { town, message: "購入済みです" };
  if (town.money < part.price) return { town, message: "部品を購入する資金が不足しています" };
  const next = { tile, kind, parts: [...(old?.parts ?? []), id] };
  return { town: { ...town, attachments: [...town.attachments.filter(a => a.tile !== tile), next], money: town.money - part.price }, message: `${part.title}を取り付けました −¥${part.price}` };
}
export function removeFacilityPart(town: Town, tile: number, id: FacilityPart) {
  const attachment = town.attachments.find(a => a.tile === tile);
  if (!attachment?.parts.includes(id)) return { town, message: "部品がありません" };
  const parts = attachment.parts.filter(p => p !== id);
  return { town: { ...town, attachments: town.attachments.flatMap(a => a.tile === tile ? parts.length ? [{ ...a, parts }] : [] : [a]) }, message: "部品を取り外しました" };
}
type MetadataEdit<T> = { before?: T; after?: T; index: number };
export type TownEdit = {
  changes: { i: number; before: Tile; after: Tile; beforeLevel: number; afterLevel: number }[];
  parks: (MetadataEdit<ParkLot> & { id: number })[];
  attachments: (MetadataEdit<FacilityAttachment> & { tile: number })[];
  cost: number;
};
export function recordTownEdit(before: Town, after: Town): TownEdit {
  const parks = [...new Set([...before.parks, ...after.parks].map(p => p.id))].flatMap(id => {
    const a = before.parks.find(p => p.id === id), b = after.parks.find(p => p.id === id);
    return JSON.stringify(a) === JSON.stringify(b) ? [] : [{ id, before: a, after: b, index: before.parks.findIndex(p => p.id === id) }];
  });
  const attachments = [...new Set([...before.attachments, ...after.attachments].map(a => a.tile))].flatMap(tile => {
    const a = before.attachments.find(p => p.tile === tile), b = after.attachments.find(p => p.tile === tile);
    return JSON.stringify(a) === JSON.stringify(b) ? [] : [{ tile, before: a, after: b, index: before.attachments.findIndex(p => p.tile === tile) }];
  });
  return { changes: before.tiles.flatMap((tile, i) => tile !== after.tiles[i] || before.levels[i] !== after.levels[i] ? [{ i, before: tile, after: after.tiles[i]!, beforeLevel: before.levels[i]!, afterLevel: after.levels[i]! }] : []), parks, attachments, cost: before.money - after.money };
}
export function undoTownEdit(current: Town, edit: TownEdit): Town {
  const tiles = edit.changes.some(c => c.before !== c.after) ? current.tiles.slice() : current.tiles;
  const levels = edit.changes.some(c => c.beforeLevel !== c.afterLevel) ? current.levels.slice() : current.levels;
  for (const c of edit.changes) { if (c.before !== c.after) tiles[c.i] = c.before; if (c.beforeLevel !== c.afterLevel) levels[c.i] = c.beforeLevel; }
  let parks = current.parks, attachments = current.attachments;
  for (const c of edit.parks) {
    if (!c.before) parks = parks.filter(p => p.id !== c.id);
    else if (parks.some(p => p.id === c.id)) parks = parks.map(p => p.id === c.id ? c.before! : p);
    else { parks = parks.slice(); parks.splice(Math.max(0, Math.min(c.index, parks.length)), 0, c.before); }
  }
  for (const c of edit.attachments) {
    if (!c.before) attachments = attachments.filter(a => a.tile !== c.tile);
    else if (attachments.some(a => a.tile === c.tile)) attachments = attachments.map(a => a.tile === c.tile ? c.before! : a);
    else { attachments = attachments.slice(); attachments.splice(Math.max(0, Math.min(c.index, attachments.length)), 0, c.before); }
  }
  return { ...current, tiles, levels, parks, attachments, money: current.money + edit.cost };
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
export function getTownStats(tiles: Tile[], levels: number[] = [], lots: ParkLot[] = [], attachments: FacilityAttachment[] = []): TownStats {
  const count = (t: Tile) => tiles.filter(v => v === t).length;
  const covered = new Set(lots.flatMap(lotTiles)), legacyParks = tiles.flatMap((t, i) => t === "park" && !covered.has(i) ? [i] : []);
  const developed = lots.filter(l => l.parts.some(p => (PARK_PARTS.find(s => s.id === p.kind)?.value ?? 0) >= 2));
  const homes = count("house"), shops = count("shop"), factories = count("factory"), roads = count("road"), rails = count("rail"), stations = count("station"), parks = legacyParks.length + developed.length;
  const routes = railRoutes(tiles), linkedStations = new Set(routes.flatMap(r => [r[0]!, r[r.length - 1]!])).size;
  const extras = new Map(attachments.map(a => [a.tile, a.parts]));
  const parkBonus = (i: number) => {
    const x = i % MAP_SIZE, y = Math.floor(i / MAP_SIZE);
    const legacy = legacyParks.filter(p => Math.abs(x - p % MAP_SIZE) + Math.abs(y - Math.floor(p / MAP_SIZE)) <= 3).length * 12;
    return legacy + developed.reduce((value, p) => {
      const distance = Math.max(p.x - x, x - (p.x + p.width - 1), 0) + Math.max(p.y - y, y - (p.y + p.height - 1), 0);
      const score = p.parts.reduce((sum, part) => sum + (PARK_PARTS.find(s => s.id === part.kind)?.value ?? 0), 0);
      return value + (distance <= 3 ? Math.min(24, 6 + score * 2) : 0);
    }, 0);
  };
  let population = 0, income = 0, jobs = 0, satisfaction = 0, occupied = 0;
  tiles.forEach((t, i) => {
    if (!touchesRoad(tiles, i % MAP_SIZE, Math.floor(i / MAP_SIZE))) return;
    const level = levels[i] || 1;
    if (t === "house") {
      const greenFactories = attachments.filter(a => a.kind === "factory" && a.parts.includes("greenbelt") && Math.abs(i % MAP_SIZE - a.tile % MAP_SIZE) + Math.abs(Math.floor(i / MAP_SIZE) - Math.floor(a.tile / MAP_SIZE)) <= 3).length;
      const happy = Math.max(20, Math.min(100, 60 + parkBonus(i) + (extras.get(i)?.includes("garden") ? 3 : 0) + near(tiles, i, ["shop"], 3) * 4 - near(tiles, i, ["factory"], 3) * 10 + greenFactories * 7));
      population += 18 * level + (extras.get(i)?.includes("terrace") ? 6 : 0); income += 23 * level; satisfaction += happy; occupied++;
    }
    if (t === "shop") { income += 48 * level + (extras.get(i)?.includes("terrace") ? 14 : 0) + (extras.get(i)?.includes("sign") ? 8 : 0); jobs += 14 * level; }
    if (t === "factory") { income += 74 * level + (extras.get(i)?.includes("storage") ? 18 : 0) + (extras.get(i)?.includes("solar") ? 8 : 0); jobs += 32 * level; }
  });
  const railPassengers = new Set(routes.flatMap(r => [r[0]!, r[r.length - 1]!])).size;
  // Empty disconnected stations do not produce passenger income.
  const servedHomes = tiles.reduce((sum, t, i) => sum + (t === "house" && routes.some(r => [r[0]!, r[r.length - 1]!].some(s => Math.abs(s % MAP_SIZE - i % MAP_SIZE) + Math.abs(Math.floor(s / MAP_SIZE) - Math.floor(i / MAP_SIZE)) <= 3)) && touchesRoad(tiles, i % MAP_SIZE, Math.floor(i / MAP_SIZE)) ? (levels[i] || 1) : 0), 0);
  income += Math.min(railPassengers * 110, servedHomes * 65);
  const upkeep = roads * 3 + rails * 4 + stations * 30 + legacyParks.length * 10 + lots.reduce((sum, l) => sum + Math.ceil(l.width * l.height / 4) * 4 + l.parts.length, 0) + factories * 8 - attachments.filter(a => a.kind === "factory" && a.parts.includes("solar")).length * 4;
  const happiness = occupied ? Math.round(satisfaction / occupied) : 60;
  return { population, homes, shops, factories, roads, rails, stations, parks, linkedStations, income, upkeep, happiness, jobs, routes };
}
export function buildTile(town: Town, tool: Tool, x: number, y: number): { town: Town; message: string } {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= MAP_SIZE || y >= MAP_SIZE) return { town, message: "マップの範囲外です" };
  if (tool === "park") return buyParkLot(town, x, y, "small");
  const i = indexAt(x, y), existing = town.tiles[i];
  if (tool === "bulldoze") {
    const lot = parkAt(town, i);
    if (lot) return removeParkPart(town, lot.id, i);
    if (existing === "grass" || existing === "water") return { town, message: "ここには建設物がありません" };
    const tiles = town.tiles.slice(), levels = town.levels.slice(); tiles[i] = town.terrain[i] ? "water" : "grass"; levels[i] = 0;
    return { town: { ...town, tiles, levels, attachments: town.attachments.filter(a => a.tile !== i) }, message: "撤去しました" };
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
  let stats = getTownStats(next.tiles, next.levels, next.parks, next.attachments);
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
  stats = getTownStats(next.tiles, next.levels, next.parks, next.attachments);
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
    const parks: ParkLot[] = [], occupied = new Set<number>();
    if (obj.parks !== undefined && !Array.isArray(obj.parks)) return null;
    for (const raw of obj.parks as unknown[] ?? []) {
      if (!raw || typeof raw !== "object") return null;
      const p = raw as ParkLot;
      if (![p.id, p.x, p.y, p.width, p.height].every(Number.isInteger) || p.id !== indexAt(p.x, p.y) || !["park", "plaza"].includes(p.kind) || p.x < 0 || p.y < 0 || p.x + p.width > MAP_SIZE || p.y + p.height > MAP_SIZE || !(p.width === 1 && p.height === 1 || PARK_SIZES.some(s => s.width === p.width && s.height === p.height || s.width === p.height && s.height === p.width)) || !Array.isArray(p.parts)) return null;
      const cells = lotTiles(p), used = new Set<string>();
      if (cells.some(i => occupied.has(i) || tiles[i] !== "park" || terrain[i])) return null;
      const parts: ParkLot["parts"] = [];
      for (const part of p.parts) {
        if (!part || typeof part !== "object") return null;
        const detail = PARK_PARTS.find(s => s.id === part.kind), key = `${part.tile}:${detail?.layer}`;
        if (!detail || !cells.includes(part.tile) || !Number.isInteger(part.rotation) || part.rotation < 0 || part.rotation > 3 || used.has(key)) return null;
        used.add(key); parts.push({ tile: part.tile, kind: part.kind, rotation: part.rotation });
      }
      cells.forEach(i => occupied.add(i)); parks.push({ id: p.id, x: p.x, y: p.y, width: p.width, height: p.height, kind: p.kind, parts });
    }
    // Old one-tile parks keep their place and value, and become editable without charging again.
    tiles.forEach((t, i) => { if (t === "park" && !occupied.has(i)) parks.push({ id: i, x: i % MAP_SIZE, y: Math.floor(i / MAP_SIZE), width: 1, height: 1, kind: "park", parts: [{ tile: i, kind: "fountain", rotation: 0 }] }); });
    const attachments: FacilityAttachment[] = [], attached = new Set<number>();
    if (obj.attachments !== undefined && !Array.isArray(obj.attachments)) return null;
    for (const raw of obj.attachments as unknown[] ?? []) {
      if (!raw || typeof raw !== "object") return null;
      const a = raw as FacilityAttachment;
      if (!Number.isInteger(a.tile) || a.tile < 0 || a.tile >= MAP_SIZE ** 2 || tiles[a.tile] !== a.kind || attached.has(a.tile) || !Array.isArray(a.parts) || new Set(a.parts).size !== a.parts.length || a.parts.some(id => !FACILITY_PARTS.some(p => p.id === id && p.kinds.includes(a.kind)))) return null;
      attached.add(a.tile); if (a.parts.length) attachments.push({ tile: a.tile, kind: a.kind, parts: [...a.parts] });
    }
    return { tiles, levels, terrain, rewards, parks, attachments, money: obj.money, day: obj.day, paused: obj.paused === true };
  } catch { return null; }
}
