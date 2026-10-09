/**
 * ご当地ピンボールの台えらびに出すもの（サーバーで作る）
 * =============================================================
 * ・台はマップ（台の形）ごと（maps.ts・themes.ts）。どのマップも、だれでも遊べる
 * ・台に出るのは、持っているご当地アイテム全部（どの県のものも。犬のすがたは数えない・台にも出さない）
 * ・スキルLvは図鑑のLv（所持数）。Lv MAX のあとに引いたぶんは限界突破の★。バンパーの絵は持っているアイテムのレア度の高い順
 * ・図鑑ボーナス（すべての得点にかける倍率）は、台に出るご当地アイテムを全部で何種類持っているかで決まる（どのマップも同じ）
 * 地図のデータ（geo）を読むので、ブラウザ側のコードからは import しないこと。
 */
import { GACHA_RARITIES, type GachaRarity } from "@/lib/gacha/config";
import { getSkillLevel } from "@/lib/gacha/skill-levels";
import { PREFECTURES } from "@/lib/geo";
import { zukanBonus } from "./config";
import { capsuleItem, type PinballItem } from "./game";
import { pinballItems, pinballPrefCodes } from "./items";
import { PINBALL_MAP_IDS, getPinballTable } from "./maps";
import { getPinballSkill, starsForCount } from "./skills";
import { getPinballPart } from "./stage";

export type PinballShapeData = { paths: string[]; bbox: [number, number, number, number] };

export type PinballLobby = {
  /** 台えらびに並べるマップの id（maps.ts の順） */
  maps: string[];
  /** 台に出るアイテム（持っているもの全部。レア度の高い順） */
  pool: PinballItem[];
  /** バンパーの上にのせるアイテム（いちばんバンパーの多いマップ・ステージのぶん。足りないところは ？カプセル） */
  bumperItems: PinballItem[];
  /** 図鑑ボーナス（すべての得点にかける倍率。アイテムを持っていなければ 1） */
  zukan: number;
  /** 持っているご当地アイテムの種類（犬のすがたをのぞく） */
  ownedCount: number;
  totalCount: number;
  /** 床に描く県の形（ご当地アイテムがある県をまとめて） */
  shape: PinballShapeData | null;
  /** 台えらびに出すアイテム（持っているもののうちレア度の高い順） */
  preview: { id: string; name: string; image: string; rarity: GachaRarity }[];
};

const RANK = (r: GachaRarity) => GACHA_RARITIES.indexOf(r);
/** バンパーの絵が足りないときに使う ？カプセルの色（前からの並び） */
const CAPSULE_ORDER = [5, 2, 4, 1, 3, 6];

/** 床には、ご当地アイテムがある県をまとめて描く */
function shapeOfAll(codes: readonly string[]): PinballShapeData | null {
  const prefs = PREFECTURES.filter((p) => codes.includes(p.code));
  if (!prefs.length) return null;
  const bbox: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of prefs) {
    bbox[0] = Math.min(bbox[0], p.bbox[0]);
    bbox[1] = Math.min(bbox[1], p.bbox[1]);
    bbox[2] = Math.max(bbox[2], p.bbox[2]);
    bbox[3] = Math.max(bbox[3], p.bbox[3]);
  }
  return { paths: prefs.map((p) => p.d), bbox };
}

export function buildPinballLobby(owned: ReadonlyMap<string, number>, optimize: (src: string, width: number) => string): PinballLobby {
  const items = pinballItems();
  const ownedItems = items
    .filter((item) => (owned.get(item.id) ?? 0) > 0)
    .sort((a, b) => RANK(b.rarity) - RANK(a.rarity) || (owned.get(b.id) ?? 0) - (owned.get(a.id) ?? 0));
  const pool: PinballItem[] = ownedItems.map((item) => {
    const count = owned.get(item.id) ?? 0;
    const level = item.rarity === "N" ? 0 : Math.max(1, getSkillLevel(item.rarity, count));
    const stars = starsForCount(item.rarity, count);
    return {
      id: item.id,
      name: item.name,
      rarity: item.rarity,
      level,
      stars,
      skill: getPinballSkill(item.id, item.name, item.rarity, level, stars),
      image: optimize(item.image!, 128),
    };
  });
  // 自分で作るステージは、バンパーを持てる数まで置ける
  const maxBumpers = Math.max(getPinballPart("bumper")?.max ?? 0, ...PINBALL_MAP_IDS.map((id) => getPinballTable(id).bumpers.length));
  const bumperItems = pool.slice(0, maxBumpers);
  for (let i = bumperItems.length; i < maxBumpers; i += 1) {
    const cap = capsuleItem(CAPSULE_ORDER[i % CAPSULE_ORDER.length]!);
    bumperItems.push({ ...cap, image: optimize(cap.image!, 128) });
  }
  return {
    maps: [...PINBALL_MAP_IDS],
    pool,
    bumperItems,
    zukan: zukanBonus(ownedItems.length, items.length),
    ownedCount: ownedItems.length,
    totalCount: items.length,
    shape: shapeOfAll(pinballPrefCodes()),
    preview: ownedItems.slice(0, 5).map((item) => ({ id: item.id, name: item.name, image: optimize(item.image!, 96), rarity: item.rarity })),
  };
}
