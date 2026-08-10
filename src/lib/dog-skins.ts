/**
 * 犬スキン
 * =============================================================
 * 見た目の切り替えは「重ね着せ」ではなく、スキンごとに独立した画像セットを
 * まるごと差し替える方式にしてある。1匹の犬に服を重ねて描くのではなく、
 * 「いつものフレブル」「登山のフレブル」……とスキンそのものが別セットという
 * 扱い。理由は、装備で試した重ね表示（そうび機能）が犬の絵そのものには
 * 反映できず、アイコンを乗せるだけに終わったため（gear-board.tsx 参照）。
 *
 * 各スキンのフォルダには、同じファイル名のポーズ画像を揃える
 * （public/characters/README.md に一覧がある）。ファイル名が全スキンで
 * 共通なので、コード側は「どのフォルダを見るか」を切り替えるだけでよい。
 */

export const DOG_SKIN_IDS = ["default", "hiking", "snow", "summer"] as const;
export type DogSkinId = (typeof DOG_SKIN_IDS)[number];

export function isDogSkinId(value: unknown): value is DogSkinId {
  return typeof value === "string" && (DOG_SKIN_IDS as readonly string[]).includes(value);
}

export type DogSkin = {
  id: DogSkinId;
  name: string;
  description: string;
  /** 図鑑・ガチャの景品 id（src/lib/gacha/prizes.ts）。null は最初から所持 */
  unlockItemId: string | null;
};

export const DOG_SKINS: readonly DogSkin[] = [
  { id: "default", name: "いつものフレブル", description: "最初から一緒にいる相棒", unlockItemId: null },
  {
    id: "hiking",
    name: "登山のフレブル",
    description: "ガチャで手に入る山すがた",
    unlockItemId: "hiking_frenchie",
  },
  {
    id: "snow",
    name: "雪国のフレブル",
    description: "ガチャで手に入る雪すがた",
    unlockItemId: "snow_frenchie",
  },
  {
    id: "summer",
    name: "夏のフレブル",
    description: "ガチャで手に入る夏すがた",
    unlockItemId: "summer_frenchie",
  },
] as const;

const SKIN_BY_ID = new Map(DOG_SKINS.map((skin) => [skin.id, skin]));

export function getDogSkin(id: DogSkinId): DogSkin {
  // DOG_SKINS は DOG_SKIN_IDS と1対1なので必ず見つかる
  return SKIN_BY_ID.get(id)!;
}

/**
 * そのスキンを選べるか。default は誰でも選べる。それ以外は該当の景品 id を
 * 図鑑（user_gacha_items）で持っているかどうかで判定する。
 * supabase/migrations/*_dog_skins.sql の set_dog_skin() と必ず同じ判定にする。
 */
export function isSkinUnlocked(skin: DogSkin, ownedItemIds: ReadonlySet<string>): boolean {
  return skin.unlockItemId === null || ownedItemIds.has(skin.unlockItemId);
}

/**
 * 犬のポーズ画像のURL。スキンごとに同じファイル名を揃えている前提で、
 * 参照先のフォルダだけを切り替える。
 *
 *   getFrenchieSrc("default", "walk") => "/characters/default/walk.webp"
 *   getFrenchieSrc("hiking",  "walk") => "/characters/hiking/walk.webp"
 *
 * pose はモーションの土台絵やページ内の飾りが直接指定するファイル名
 * （拡張子なし）で、DOG_POSE_FILES に載っているものを想定している。
 * 型を絞ると新しいポーズを足すたびにここを直す必要が出るので、あえて
 * string のままにしてある。
 */
export function getFrenchieSrc(skin: DogSkinId, pose: string): string {
  return `/characters/${skin}/${pose}.webp`;
}

/**
 * 全スキン共通で必要なポーズファイル名（拡張子なし）の一覧。
 *
 * アプリのどこかで実際に読み込まれているファイルだけを載せてある
 * （src/components/wandering-frenchie.tsx の POSES・MOTIONS と、
 * coin-hero / coin-shop-preview / gear-board / login-bonus が直接指す
 * ファイル名の合計）。新しいポーズを使うコードを足したら、ここにも足す。
 */
export const DOG_POSE_FILES = [
  "stand",
  "walk",
  "sit",
  "sniff",
  "stand-happy",
  "shake",
  "sleep",
  "wonder",
  "sit-side",
  "wave",
  "wink",
  "smile",
  "bark",
  "cheer",
  "trot",
  "front",
  "yawn",
  "walk-tail",
  "lie-wave",
  "bow-b",
  "bow",
  "lie",
  "doze",
] as const;
