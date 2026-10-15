import { MAP_SIZE, PARK_PARTS, getTownStats, houseHappiness, lotTiles, touchesRoad, type Tile, type Town, type TownStats } from "./town-builder";

/**
 * 街を「知る」ための計算：情報マップ（満足度・駅の利用圏・公園の効き目・道路）と、まちの相談役（気になるところの一覧）。
 * 数字はすべて getTownStats と同じ決まりで出す。画面に出すだけで、街も白コインも変えない（サーバーの検証にも関係しない）。
 */

export type TownLayer = "happiness" | "station" | "park" | "road";
export const TOWN_LAYERS: readonly { id: TownLayer; title: string; legend: { color: string; label: string }[] }[] = [
  { id: "happiness", title: "満足度", legend: [{ color: "#4fb37a", label: "80%〜" }, { color: "#e3c04f", label: "60〜79%" }, { color: "#e27d55", label: "〜59%" }] },
  { id: "station", title: "駅の利用圏", legend: [{ color: "#4f9de0", label: "列車が走る駅の3マス" }, { color: "#9aa6ad", label: "線路がつながっていない駅" }] },
  { id: "park", title: "公園の効き目", legend: [{ color: "#58b864", label: "公園から3マス（満足度＋）" }, { color: "#c9b46a", label: "部品がない敷地（効かない）" }] },
  { id: "road", title: "道路のつながり", legend: [{ color: "#4fb37a", label: "道路に面している" }, { color: "#e05c5c", label: "道路がない（人も仕事も生まれない）" }] },
];

/** 情報マップの1マス。fill … 地面に塗る色、pin … 建物の上に出す小さな札 */
export type LayerCell = { tile: number; fill?: string; pin?: { text: string; color: string } };

const BUILT: Tile[] = ["house", "shop", "factory", "home"];
const xy = (i: number) => ({ x: i % MAP_SIZE, y: Math.floor(i / MAP_SIZE) });
const manhattan = (a: number, b: number) => Math.abs(a % MAP_SIZE - b % MAP_SIZE) + Math.abs(Math.floor(a / MAP_SIZE) - Math.floor(b / MAP_SIZE));
const connectedAt = (tiles: Tile[], i: number) => touchesRoad(tiles, i % MAP_SIZE, Math.floor(i / MAP_SIZE));
export const happinessColor = (v: number) => (v >= 80 ? "#4fb37a" : v >= 60 ? "#e3c04f" : "#e27d55");
/** 部品のある（満足度に効く）敷地か。getTownStats の developed と同じ */
const developedLot = (lot: Town["parks"][number]) => lot.parts.some(p => (PARK_PARTS.find(s => s.id === p.kind)?.value ?? 0) >= 2);

/** 列車が走っている駅（路線の端） */
export function servedStations(stats: TownStats) {
  return new Set(stats.routes.flatMap(r => [r[0]!, r[r.length - 1]!]));
}

export function layerCells(town: Town, stats: TownStats, layer: TownLayer): LayerCell[] {
  const { tiles } = town;
  const cells: LayerCell[] = [];
  if (layer === "happiness") {
    tiles.forEach((t, i) => {
      if (t !== "house") return;
      if (!connectedAt(tiles, i)) { cells.push({ tile: i, pin: { text: "道なし", color: "#9aa6ad" } }); return; }
      const h = houseHappiness(tiles, town.parks, town.attachments, i).total;
      cells.push({ tile: i, fill: `${happinessColor(h)}55`, pin: { text: `${h}`, color: happinessColor(h) } });
    });
  } else if (layer === "station") {
    const served = servedStations(stats);
    const stations = tiles.flatMap((t, i) => (t === "station" ? [i] : []));
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i] === "water") continue;
      const near = stations.filter(s => manhattan(s, i) <= 3);
      if (!near.length) continue;
      const live = near.some(s => served.has(s));
      const homeServed = live && tiles[i] === "house" && connectedAt(tiles, i);
      cells.push({ tile: i, fill: live ? "#4f9de044" : "#9aa6ad33", ...(homeServed ? { pin: { text: "駅", color: "#4f9de0" } } : {}) });
    }
    for (const s of stations) cells.push({ tile: s, pin: served.has(s) ? { text: "運行", color: "#4f9de0" } : { text: "線路なし", color: "#9aa6ad" } });
  } else if (layer === "park") {
    const developed = town.parks.filter(developedLot);
    const covered = new Set(town.parks.flatMap(lotTiles));
    const legacy = tiles.flatMap((t, i) => (t === "park" && !covered.has(i) ? [i] : []));
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i] === "water") continue;
      const { x, y } = xy(i);
      const inLot = developed.some(p => Math.max(p.x - x, x - (p.x + p.width - 1), 0) + Math.max(p.y - y, y - (p.y + p.height - 1), 0) <= 3);
      if (inLot || legacy.some(p => manhattan(p, i) <= 3)) cells.push({ tile: i, fill: "#58b86440" });
    }
    for (const lot of town.parks) if (!developedLot(lot)) for (const i of lotTiles(lot)) cells.push({ tile: i, fill: "#c9b46a66" });
    tiles.forEach((t, i) => {
      if (t !== "house" || !connectedAt(tiles, i)) return;
      const park = houseHappiness(tiles, town.parks, town.attachments, i).park;
      if (park > 0) cells.push({ tile: i, pin: { text: `+${park}`, color: "#58b864" } });
    });
  } else {
    tiles.forEach((t, i) => {
      if (!BUILT.includes(t)) return;
      const ok = connectedAt(tiles, i);
      cells.push({ tile: i, fill: ok ? "#4fb37a33" : "#e05c5c66", ...(ok ? {} : { pin: { text: "道なし", color: "#e05c5c" } }) });
    });
  }
  return cells;
}

/* ------------------------------------------------------------ まちの相談役 */

export type Advice = {
  id: string;
  tone: "bad" | "warn" | "tip" | "good";
  title: string;
  detail: string;
  /** 見に行く場所（最初のマスへ移動する） */
  tiles: number[];
  /** いっしょに開くとよい情報マップ */
  layer?: TownLayer;
};

const TITLE: Record<string, string> = { house: "住宅", shop: "商店", factory: "工場", home: "マイホーム" };

/** 街の気になるところ。重いものから順に並べる（だめ → 注意 → ひとこと） */
export function townAdvice(town: Town, stats: TownStats = getTownStats(town.tiles, town.levels, town.parks, town.attachments)): Advice[] {
  const { tiles } = town;
  const out: Advice[] = [];
  // 1. 道路に面していない建物：人口・税・仕事が生まれない
  const cut = tiles.flatMap((t, i) => (BUILT.includes(t) && !connectedAt(tiles, i) ? [i] : []));
  if (cut.length) {
    const kinds = [...new Set(cut.map(i => TITLE[tiles[i]!]))].join("・");
    out.push({ id: "road", tone: "bad", title: `道路に面していない建物が${cut.length}棟`, detail: `${kinds}は、となりのマスに道路がないと人も仕事も生まれません。道路をつなぎましょう。`, tiles: cut, layer: "road" });
  }
  // 2. 線路でつながっていない駅
  const served = servedStations(stats);
  const lonely = tiles.flatMap((t, i) => (t === "station" && !served.has(i) ? [i] : []));
  if (lonely.length) out.push({ id: "station", tone: "bad", title: `列車が走らない駅が${lonely.length}つ`, detail: "駅は、線路でもう1つの駅とつながると列車が走ります。駅どうしがとなりにあるだけでは走りません。", tiles: lonely, layer: "station" });
  // 3. 利用者のいない駅（列車は走るが、3マス以内に道路のある住宅がない）
  const empty = [...served].filter(s => !tiles.some((t, i) => t === "house" && connectedAt(tiles, i) && manhattan(s, i) <= 3));
  if (empty.length) out.push({ id: "riders", tone: "warn", title: `乗る人がいない駅が${empty.length}つ`, detail: "駅の3マス以内に、道路に面した住宅を建てると、乗る人が来て輸送の収入が生まれます。", tiles: empty, layer: "station" });
  // 4. 満足度の低い住宅（いちばんの理由つき）
  const unhappy = tiles
    .flatMap((t, i) => (t === "house" && connectedAt(tiles, i) ? [{ i, h: houseHappiness(tiles, town.parks, town.attachments, i) }] : []))
    .filter(x => x.h.total < 60)
    .sort((a, b) => a.h.total - b.h.total);
  if (unhappy.length) {
    const factory = unhappy.filter(x => x.h.factories > 0).length;
    const detail = factory
      ? `${factory}棟は近くの工場（3マス以内）の煙で満足度が下がっています。工場に「緑化帯」をつけるか、近くに公園をつくりましょう。`
      : "近く（3マス以内）に、部品のある公園や商店をつくると満足度が上がります。";
    out.push({ id: "happy", tone: "warn", title: `満足度が60%より低い住宅が${unhappy.length}棟`, detail, tiles: unhappy.map(x => x.i), layer: "happiness" });
  }
  // 5. 部品のない公園の敷地（満足度に効かない）
  const bare = town.parks.filter(l => !developedLot(l));
  if (bare.length) out.push({ id: "lot", tone: "warn", title: `部品のない公園・広場が${bare.length}か所`, detail: "空の敷地は満足度に効きません。木・噴水・遊具など（花壇・通路・照明より大きな部品）を置くと、まわり3マスの住宅がよろこびます。", tiles: bare.map(l => l.y * MAP_SIZE + l.x), layer: "park" });
  // 6. 仕事が少ない
  if (stats.population >= 90 && stats.jobs < stats.population * 0.4) {
    const work = tiles.flatMap((t, i) => (t === "shop" || t === "factory" ? [i] : []));
    out.push({ id: "jobs", tone: "tip", title: "仕事が少なめです", detail: `人口${stats.population}人に対して、仕事は${stats.jobs}人分。商店や工場を建てたり増築したりすると、街の経済力が上がります。`, tiles: work });
  }
  // 7. 商店がない・公園がない（はじめのころ）
  if (stats.homes >= 3 && !stats.shops) out.push({ id: "shop", tone: "tip", title: "まだ商店がありません", detail: "住宅の近く（3マス以内）に商店があると、1軒ごとに満足度が＋4。", tiles: [] });
  if (stats.homes >= 3 && !stats.parks && !bare.length) out.push({ id: "park", tone: "tip", title: "まだ公園がありません", detail: "建設 → 環境 → 公園・広場 で敷地を買い、木や噴水を置くと、まわりの住宅の満足度が大きく上がります。", tiles: [] });
  if (!out.length) out.push({ id: "fine", tone: "good", title: "いまのところ、困っていることはありません", detail: `住宅${stats.homes}棟・満足度${stats.happiness}%。増築や新しい区画で、街をもっと広げてみよう。`, tiles: [] });
  return out;
}
