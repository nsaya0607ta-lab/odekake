/**
 * 犬スキン
 * =============================================================
 * 見た目の切り替えは「重ね着せ」ではなく、スキンごとに独立した画像セットを
 * まるごと差し替える方式にしてある。
 */

export const DOG_SKIN_IDS = ["default", "hiking", "snow", "summer"] as const;
export type DogSkinId = (typeof DOG_SKIN_IDS)[number];

/** DB migration が未適用でも選択状態を保持できるよう、ブラウザCookieを正とする。 */
export const DOG_SKIN_COOKIE = "odekake_dog_skin";

export function isDogSkinId(value: unknown): value is DogSkinId {
  return typeof value === "string" && (DOG_SKIN_IDS as readonly string[]).includes(value);
}

export type DogSkin = {
  id: DogSkinId;
  name: string;
  description: string;
  /** 図鑑・ガチャの景品 id。null は最初から所持 */
  unlockItemId: string | null;
  /** 犬のすがた選択画面や、ポーズ画像がまだ揃っていないときに使う代表画像 */
  previewImage: string;
  /** アプリで使うポーズ一式が揃っているか */
  hasPoseSet: boolean;
};

export const DOG_SKINS: readonly DogSkin[] = [
  {
    id: "default",
    name: "いつものフレブル",
    description: "最初から一緒にいる相棒",
    unlockItemId: null,
    previewImage: "/characters/default/stand-happy.webp",
    hasPoseSet: true,
  },
  {
    id: "hiking",
    name: "登山のフレブル",
    description: "ガチャで手に入る山すがた",
    unlockItemId: "hiking_frenchie",
    previewImage: "/collection/skins/hiking-frenchie.svg",
    hasPoseSet: false,
  },
  {
    id: "snow",
    name: "雪国のフレブル",
    description: "ガチャで手に入る雪すがた",
    unlockItemId: "snow_frenchie",
    previewImage: "/collection/skins/snow-frenchie.svg",
    hasPoseSet: false,
  },
  {
    id: "summer",
    name: "夏のフレブル",
    description: "ガチャで手に入る夏すがた",
    unlockItemId: "summer_frenchie",
    previewImage: "/collection/skins/summer-frenchie.webp",
    hasPoseSet: true,
  },
] as const;

const SKIN_BY_ID = new Map(DOG_SKINS.map((skin) => [skin.id, skin]));

export function getDogSkin(id: DogSkinId): DogSkin {
  return SKIN_BY_ID.get(id)!;
}

/** default は誰でも、それ以外は対応するガチャ景品を持っていると選べる。 */
export function isSkinUnlocked(skin: DogSkin, ownedItemIds: ReadonlySet<string>): boolean {
  return skin.unlockItemId === null || ownedItemIds.has(skin.unlockItemId);
}

/**
 * 犬の画像URL。
 *
 * default は従来どおり public/characters/default/*.webp を使う。
 * summer は、デフォルトと同じ21ポーズを夏服へ着せ替えたSVGをビルド時に生成して使う。
 * hiking / snow は専用ポーズ画像がまだ未配置なので代表画像へフォールバックする。
 */
export function getFrenchieSrc(skin: DogSkinId, pose: string): string {
  if (skin === "summer") return `/characters/summer/${pose}.svg`;

  const dogSkin = getDogSkin(skin);
  return dogSkin.hasPoseSet ? `/characters/${skin}/${pose}.webp` : dogSkin.previewImage;
}

/** 全スキン共通で必要なポーズファイル名（拡張子なし）の一覧。 */
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
] as const;
