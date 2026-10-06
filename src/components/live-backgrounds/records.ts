/**
 * 記録で育つ背景（あなたの日本地図・おでかけ星図）が使う「行った場所」。
 * - "mine" は /api/app-background/places から読む（10分は覚えておき、画面を移るたびに問い合わせない）
 * - ショップの見本の "few" / "some" / "all" は、決まった並びの見本の記録
 */
import { MUNICIPALITIES, PREFECTURES } from "@/lib/geo";
import type { RecordsKind } from "@/lib/app-backgrounds";
import { seededRandom } from "./engine";

export type PlaceData = { prefectures: Record<string, number>; municipalities: Record<string, number> };

const EMPTY: PlaceData = { prefectures: {}, municipalities: {} };
const CACHE_MS = 10 * 60_000;
let cached: { at: number; data: PlaceData } | null = null;
let pending: Promise<PlaceData> | null = null;

async function fetchMine(): Promise<PlaceData> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.data;
  pending ??= fetch("/api/app-background/places", { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : null))
    .then((body: { ok?: boolean; prefectures?: Record<string, number>; municipalities?: Record<string, number> } | null) => {
      const data = body?.ok ? { prefectures: body.prefectures ?? {}, municipalities: body.municipalities ?? {} } : (cached?.data ?? EMPTY);
      cached = { at: Date.now(), data };
      return data;
    })
    .catch(() => cached?.data ?? EMPTY)
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** 見本の記録。行った県の中で、市区町村をいくつか選ぶ */
function sample(kind: Exclude<RecordsKind, "mine">): PlaceData {
  const rand = seededRandom(kind === "few" ? 11 : kind === "some" ? 23 : 37);
  const prefCodes =
    kind === "all"
      ? PREFECTURES.map((p) => p.code)
      : kind === "some"
        ? ["01", "04", "07", "09", "12", "13", "14", "15", "17", "20", "22", "23", "26", "27", "28", "32", "34", "38", "40", "43", "47"]
        : ["13", "14", "11", "20", "22"];
  const prefectures: Record<string, number> = {};
  const municipalities: Record<string, number> = {};
  const perPref = kind === "all" ? 0.42 : kind === "some" ? 0.2 : 0.12;
  for (const code of prefCodes) {
    let total = 0;
    for (const m of MUNICIPALITIES) {
      if (m.prefectureCode !== code || m.lat === null) continue;
      if (rand() < perPref) {
        const count = 1 + Math.floor(rand() ** 3 * 9);
        municipalities[m.code] = count;
        total += count;
      }
    }
    prefectures[code] = Math.max(1, total);
  }
  return { prefectures, municipalities };
}

export function loadPlaces(kind: RecordsKind): Promise<PlaceData> {
  return kind === "mine" ? fetchMine() : Promise.resolve(sample(kind));
}

/** 画面に戻ってきたときに、覚えている記録が古ければ読みなおす */
export function placesAreStale(): boolean {
  return !cached || Date.now() - cached.at >= CACHE_MS;
}
