/**
 * ご当地ピンボールの台えらびに出す一覧（サーバーで作る）
 * =============================================================
 * ・いつもの台（ガチャカプセルの台）はだれでも遊べる
 * ・県の台は、その県のご当地アイテムを1つでも持っていれば遊べる（犬のすがたは数えない・台にも出さない）
 * ・スキルLvは図鑑のLv（所持数）。Lv MAX のあとに引いたぶんは限界突破の★。バンパーの絵は持っているアイテムのレア度の高い順に3つ
 * ・図鑑ボーナス（すべての得点にかける倍率）は、その県のアイテムを何種類持っているかで決まる
 * 地図のデータ（geo）を読むので、ブラウザ側のコードからは import しないこと。
 */
import { GACHA_RARITIES, type GachaRarity } from "@/lib/gacha/config";
import { getSkillLevel } from "@/lib/gacha/skill-levels";
import { PREFECTURES } from "@/lib/geo";
import { zukanBonus } from "./config";
import { capsuleItem, type PinballItem } from "./game";
import { pinballPrefCodes, pinballPrefItems } from "./items";
import { getPinballSkill, starsForCount } from "./skills";
import { DEFAULT_TABLE_ID, getPinballTheme } from "./themes";

export type PinballShapeData = { paths: string[]; bbox: [number, number, number, number] };

export type PinballTableInfo = {
  id: string;
  name: string;
  title: string;
  lead: string;
  unlocked: boolean;
  /** 持っているご当地アイテムの種類（犬のすがたをのぞく） */
  ownedCount: number;
  totalCount: number;
  /** 図鑑ボーナス（すべての得点にかける倍率。いつもの台は 1） */
  zukan: number;
  /** 台に出るアイテム（持っているもの） */
  pool: PinballItem[];
  /** バンパーの上にのせる3つ */
  bumperItems: PinballItem[];
  shape: PinballShapeData | null;
  /** 台えらびのカードに出すアイテム（持っているもののうちレア度の高い順） */
  preview: { id: string; name: string; image: string; rarity: GachaRarity }[];
};

const RANK = (r: GachaRarity) => GACHA_RARITIES.indexOf(r);

function shapeOfPref(code: string): PinballShapeData | null {
  const pref = PREFECTURES.find((p) => p.code === code);
  if (!pref) return null;
  return { paths: [pref.prefecture.d], bbox: [...pref.prefecture.bbox] as [number, number, number, number] };
}

/** いつもの台の床には、ご当地アイテムがある県をまとめて描く */
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

export function buildPinballTables(owned: ReadonlyMap<string, number>, optimize: (src: string, width: number) => string): PinballTableInfo[] {
  const codes = pinballPrefCodes();
  const tables: PinballTableInfo[] = [];
  const base = getPinballTheme(DEFAULT_TABLE_ID);
  tables.push({
    id: DEFAULT_TABLE_ID,
    name: base.name,
    title: base.title,
    lead: base.lead,
    unlocked: true,
    ownedCount: 0,
    totalCount: 0,
    zukan: 1,
    pool: [],
    bumperItems: [5, 2, 4].map((i) => ({ ...capsuleItem(i), image: optimize(capsuleItem(i).image!, 128) })),
    shape: shapeOfAll(codes),
    preview: [],
  });

  for (const code of codes) {
    const items = pinballPrefItems(code);
    const pref = PREFECTURES.find((p) => p.code === code);
    const theme = getPinballTheme(code, pref?.name);
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
    const bumperItems = [...pool.slice(0, 3)];
    for (let i = bumperItems.length; i < 3; i += 1) {
      const cap = capsuleItem([5, 2, 4][i]!);
      bumperItems.push({ ...cap, image: optimize(cap.image!, 128) });
    }
    // バンパーは上の2つにレアなもの、下のまんなかに3番目
    tables.push({
      id: code,
      name: theme.name,
      title: theme.title,
      lead: theme.lead,
      unlocked: ownedItems.length > 0,
      ownedCount: ownedItems.length,
      totalCount: items.length,
      zukan: zukanBonus(ownedItems.length, items.length),
      pool,
      bumperItems,
      shape: shapeOfPref(code),
      preview: ownedItems.slice(0, 4).map((item) => ({ id: item.id, name: item.name, image: optimize(item.image!, 96), rarity: item.rarity })),
    });
  }
  return tables;
}
