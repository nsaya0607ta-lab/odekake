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
  /** public/characters/<skin>/ に必要なポーズ画像一式が揃っているか */
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
    hasPoseSet: false,
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
 * default はポーズ画像が揃っているので従来どおりポーズ別画像を返す。
 * 登山・雪国・夏は、専用ポーズ画像セットがまだ未配置なので代表画像へ
 * フォールバックする。これにより選択直後に404で犬が消えることを防ぐ。
 * 各スキンの画像セットを配置できたら hasPoseSet を true にするだけで、
 * 同じコードのままポーズ別画像へ切り替わる。
 */
export function getFrenchieSrc(skin: DogSkinId, pose: string): string {
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
  "lie",
  "doze",
] as const;
