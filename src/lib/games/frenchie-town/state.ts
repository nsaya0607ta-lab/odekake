/** 街づくりの試作版。白コインと街はユーザーごとにこの端末で保存する。 */
export const SIZE = 9;
export const TILE = 1.5;
export const MAX_BUILDINGS = 52;
export const INCOME_PERIOD = 60_000;
export const CATALOG = [
  { id: "house", name: "小さなおうち", caption: "住人がふえる", price: 120, income: 0, color: "#ef9c89", category: "建物" },
  { id: "bakery", name: "パン屋さん", caption: "焼きたてのしあわせ", price: 180, income: 12, color: "#e7b064", category: "建物" },
  { id: "cafe", name: "わんこカフェ", caption: "みんなのたまり場", price: 240, income: 16, color: "#93bec1", category: "建物" },
  { id: "onsen", name: "ぽかぽか温泉", caption: "湯けむりでひと休み", price: 340, income: 22, color: "#c9a5cd", category: "建物" },
  { id: "windmill", name: "風のアトリエ", caption: "風車がくるくる", price: 280, income: 18, color: "#e8cea0", category: "建物" },
  { id: "tree", name: "まんまるの木", caption: "木かげでおひるね", price: 35, income: 0, color: "#71b595", category: "自然" },
  { id: "flowers", name: "お花の花だん", caption: "街に彩りを", price: 25, income: 0, color: "#e5a7bf", category: "自然" },
  { id: "bench", name: "ひだまりベンチ", caption: "ゆっくりひと休み", price: 45, income: 0, color: "#c69771", category: "飾り" },
  { id: "fountain", name: "きらきら噴水", caption: "小さな広場を作ろう", price: 180, income: 0, color: "#82c7d8", category: "飾り" },
  { id: "lamp", name: "星あかりの街灯", caption: "夜の街がきらめく", price: 55, income: 0, color: "#e6c47b", category: "飾り" },
] as const;
export type Kind = (typeof CATALOG)[number]["id"];
export type Building = { id: string; kind: Kind; x: number; z: number; rotation: number; level: number; harvestedAt: number };
export type CityState = { v: 1; name: string; coins: number; buildings: Building[]; claimed: string[]; pets: Record<string, number>; petCount: number; updatedAt: number };
export type SharedTown = { v: 1; name: string; buildings: Building[] };
export const definition = (kind: Kind) => CATALOG.find((item) => item.id === kind)!;
export const road = (x: number, z: number) => x === 4 || z === 4;
export const storageKey = (userId: string) => `odekake_frenchie_town_v1:${userId}`;
const integer = (n: unknown, min: number, max: number): n is number => typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;
const record = (value: unknown): Record<string, unknown> | null => typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
const timestamp = (n: unknown, now: number) => typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.min(n, now) : now;
export const cleanName = (value: string) => value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 16) || "フレンチーの街";

export function initialTown(now = Date.now()): CityState {
  const make = (id: string, kind: Kind, x: number, z: number): Building => ({ id, kind, x, z, rotation: 0, level: 1, harvestedAt: now });
  return { v: 1, name: "フレンチーの街", coins: 800, buildings: [make("home", "house", 2, 2), make("garden-a", "tree", 1, 6), make("garden-b", "flowers", 2, 6)], claimed: [], pets: {}, petCount: 0, updatedAt: now };
}

export function parseBuildings(value: unknown, now = Date.now()): Building[] | null {
  if (!Array.isArray(value) || value.length > MAX_BUILDINGS) return null;
  const ids = new Set<string>(), cells = new Set<string>(), result: Building[] = [];
  for (const raw of value) {
    const b = record(raw);
    if (!b || typeof b.id !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(b.id) || !CATALOG.some((c) => c.id === b.kind) || !integer(b.x, 0, SIZE - 1) || !integer(b.z, 0, SIZE - 1) || !integer(b.rotation, 0, 3) || !integer(b.level, 1, 3)) return null;
    const cell = `${b.x}:${b.z}`;
    if (road(b.x, b.z) || ids.has(b.id) || cells.has(cell)) return null;
    ids.add(b.id); cells.add(cell);
    result.push({ id: b.id, kind: b.kind as Kind, x: b.x, z: b.z, rotation: b.rotation, level: b.level, harvestedAt: timestamp(b.harvestedAt, now) });
  }
  return result;
}

export function parseTown(value: unknown, now = Date.now()): CityState | null {
  const s = record(value);
  if (!s || s.v !== 1 || typeof s.name !== "string" || !integer(s.coins, 0, 9_999_999) || !integer(s.petCount, 0, 999_999)) return null;
  const buildings = parseBuildings(s.buildings, now);
  if (!buildings || !Array.isArray(s.claimed) || !s.claimed.every((id) => typeof id === "string" && MISSIONS.some((m) => m.id === id))) return null;
  const pets: Record<string, number> = {};
  for (const [id, time] of Object.entries(record(s.pets) ?? {})) if (/^dog-[0-7]$/.test(id)) pets[id] = timestamp(time, now);
  return { v: 1, name: cleanName(s.name), coins: s.coins, buildings, claimed: [...new Set(s.claimed as string[])], pets, petCount: s.petCount, updatedAt: timestamp(s.updatedAt, now) };
}

export const residents = (s: { buildings: readonly Building[] }) => Math.min(8, 2 + s.buildings.filter((b) => b.kind === "house").reduce((n, b) => n + b.level, 0));
export const townLevel = (s: Pick<CityState, "buildings">) => 1 + Math.floor(s.buildings.length / 6);
export const townRank = (s: Pick<CityState, "buildings">) => ["小さな集落", "にぎやかな街", "わんこの楽園", "みんなのふるさと"][Math.min(3, townLevel(s) - 1)];
export const availableIncome = (b: Building, now: number) => Math.min(5, Math.max(0, Math.floor((now - b.harvestedAt) / INCOME_PERIOD))) * definition(b.kind).income * b.level;
export const totalIncome = (s: Pick<CityState, "buildings">, now: number) => s.buildings.reduce((n, b) => n + availableIncome(b, now), 0);
export const upgradeCost = (b: Building) => Math.ceil(definition(b.kind).price * 0.6 * b.level);
export const sellValue = (b: Building) => Math.floor((definition(b.kind).price + (b.level >= 2 ? Math.ceil(definition(b.kind).price * 0.6) : 0) + (b.level >= 3 ? Math.ceil(definition(b.kind).price * 1.2) : 0)) * 7 / 10);

export function placeProblem(s: Pick<CityState, "buildings">, x: number, z: number, movingId?: string): string | null {
  if (!integer(x, 0, SIZE - 1) || !integer(z, 0, SIZE - 1)) return "島の中に置いてね";
  if (road(x, z)) return "ここはわんこの通り道だよ";
  if (s.buildings.some((b) => b.id !== movingId && b.x === x && b.z === z)) return "ここにはもう建物があるよ";
  if (!movingId && s.buildings.length >= MAX_BUILDINGS) return "街がいっぱいになったよ";
  return null;
}

export const MISSIONS = [
  { id: "bakery", title: "焼きたてパンの街にしよう", detail: "パン屋さんを1つ建てよう", target: 1, reward: 150, progress: (s: CityState) => s.buildings.filter((b) => b.kind === "bakery").length, kind: "bakery" as Kind },
  { id: "green", title: "わんこに木かげを", detail: "木・花だんを合わせて4つ置こう", target: 4, reward: 120, progress: (s: CityState) => s.buildings.filter((b) => b.kind === "tree" || b.kind === "flowers").length, kind: "tree" as Kind },
  { id: "neighbors", title: "新しいおともだち", detail: "街の住人を5匹に増やそう", target: 5, reward: 200, progress: residents, kind: "house" as Kind },
  { id: "shops", title: "お店めぐりを楽しもう", detail: "種類の違うお店を3つ建てよう", target: 3, reward: 250, progress: (s: CityState) => new Set(s.buildings.filter((b) => definition(b.kind).income > 0).map((b) => b.kind)).size, kind: "cafe" as Kind },
  { id: "friends", title: "街のみんなと仲良く", detail: "わんこを5回なでよう", target: 5, reward: 100, progress: (s: CityState) => s.petCount, kind: null },
  { id: "town", title: "にぎやかな街のできあがり", detail: "建物や飾りを12個置こう", target: 12, reward: 300, progress: (s: CityState) => s.buildings.length, kind: "fountain" as Kind },
] as const;

export type Action =
  | { type: "load"; state: CityState }
  | { type: "build"; kind: Kind; x: number; z: number; rotation: number; id: string; now: number }
  | { type: "move"; id: string; x: number; z: number; rotation: number; now: number }
  | { type: "rotate" | "upgrade" | "sell"; id: string; now: number }
  | { type: "harvest"; now: number }
  | { type: "claim"; id: string; now: number }
  | { type: "pet"; id: string; now: number }
  | { type: "rename"; name: string; now: number };

export function townReducer(s: CityState, a: Action): CityState {
  if (a.type === "load") return a.state;
  const done = (next: CityState): CityState => ({ ...next, coins: Math.min(9_999_999, next.coins), updatedAt: Math.max(s.updatedAt + 1, a.now) });
  if (a.type === "build") {
    const item = CATALOG.find((c) => c.id === a.kind);
    if (!item || s.coins < item.price || placeProblem(s, a.x, a.z) || s.buildings.some((b) => b.id === a.id)) return s;
    return done({ ...s, coins: s.coins - item.price, buildings: [...s.buildings, { id: a.id, kind: a.kind, x: a.x, z: a.z, rotation: a.rotation % 4, level: 1, harvestedAt: a.now }] });
  }
  if (a.type === "move") {
    if (!s.buildings.some((b) => b.id === a.id) || placeProblem(s, a.x, a.z, a.id)) return s;
    return done({ ...s, buildings: s.buildings.map((b) => b.id === a.id ? { ...b, x: a.x, z: a.z, rotation: a.rotation % 4 } : b) });
  }
  if (a.type === "rename") return done({ ...s, name: cleanName(a.name) });
  if (a.type === "claim") {
    const m = MISSIONS.find((m) => m.id === a.id);
    if (!m || s.claimed.includes(a.id) || m.progress(s) < m.target) return s;
    return done({ ...s, coins: s.coins + m.reward, claimed: [...s.claimed, m.id] });
  }
  if (a.type === "pet") {
    if (!/^dog-[0-7]$/.test(a.id) || Number(a.id.slice(4)) >= residents(s) || (s.pets[a.id] !== undefined && a.now - s.pets[a.id]! < 60_000)) return s;
    return done({ ...s, coins: s.coins + 10, pets: { ...s.pets, [a.id]: a.now }, petCount: Math.min(999_999, s.petCount + 1) });
  }
  if (a.type === "harvest") {
    const coins = totalIncome(s, a.now);
    if (!coins) return s;
    return done({ ...s, coins: s.coins + coins, buildings: s.buildings.map((b) => availableIncome(b, a.now) > 0 ? { ...b, harvestedAt: a.now } : b) });
  }
  const building = s.buildings.find((b) => b.id === a.id);
  if (!building) return s;
  if (a.type === "sell") return done({ ...s, coins: s.coins + sellValue(building), buildings: s.buildings.filter((b) => b.id !== a.id) });
  if (a.type === "rotate") return done({ ...s, buildings: s.buildings.map((b) => b.id === a.id ? { ...b, rotation: (b.rotation + 1) % 4 } : b) });
  const cost = upgradeCost(building);
  if (building.level >= 3 || s.coins < cost) return s;
  return done({ ...s, coins: s.coins - cost + availableIncome(building, a.now), buildings: s.buildings.map((b) => b.id === a.id ? { ...b, level: b.level + 1, harvestedAt: a.now } : b) });
}

/** 犬は4方向のマス目で、建物を通らない道を探す。道がなければ動かない。 */
export function walkingPath(buildings: readonly Building[], from: { x: number; z: number }, to: { x: number; z: number }): { x: number; z: number }[] {
  const blocked = new Set(buildings.map((b) => b.z * SIZE + b.x));
  const start = Math.round(from.z) * SIZE + Math.round(from.x), end = to.z * SIZE + to.x;
  if (!integer(to.x, 0, SIZE - 1) || !integer(to.z, 0, SIZE - 1) || blocked.has(end)) return [];
  const queue = [start], previous = new Map<number, number>([[start, -1]]);
  for (let k = 0; k < queue.length; k++) {
    const current = queue[k]!;
    if (current === end) break;
    const x = current % SIZE, z = Math.floor(current / SIZE);
    for (const [nx, nz] of [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]]) {
      if (!integer(nx, 0, SIZE - 1) || !integer(nz, 0, SIZE - 1)) continue;
      const next = nz * SIZE + nx;
      if (blocked.has(next) || previous.has(next)) continue;
      previous.set(next, current); queue.push(next);
    }
  }
  if (!previous.has(end)) return [];
  const result: { x: number; z: number }[] = [];
  for (let cell = end; cell !== start && cell !== -1; cell = previous.get(cell) ?? -1) result.unshift({ x: cell % SIZE, z: Math.floor(cell / SIZE) });
  return result;
}

export function encodeTown(s: SharedTown): string {
  const shared = { v: 1, name: s.name, buildings: s.buildings.map((b) => ({ ...b, harvestedAt: 0 })) };
  const bytes = new TextEncoder().encode(JSON.stringify(shared));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function decodeTown(encoded: string, now = Date.now()): SharedTown | null {
  if (encoded.length > 14000 || !/^[a-zA-Z0-9_-]+$/.test(encoded)) return null;
  try {
    const value = record(JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encoded.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)))));
    if (!value || value.v !== 1 || typeof value.name !== "string") return null;
    const buildings = parseBuildings(value.buildings, now);
    return buildings ? { v: 1, name: cleanName(value.name), buildings } : null;
  } catch { return null; }
}
